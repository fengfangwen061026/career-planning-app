"""Embedding provider - Unified interface for embedding calls with caching."""

import hashlib
import logging
import re
from collections import OrderedDict
from typing import Any

import httpx
from sqlalchemy import select

from app.config import settings
from app.models.skill_embedding import SkillEmbedding

logger = logging.getLogger(__name__)

# LRU-style in-memory cache (text hash → embedding vector)
_CACHE_MAX_SIZE = 2048

# Normalize text for consistent cache keys
_NORMALIZE_RE = re.compile(r"\s+")


def _normalize_for_cache(text: str) -> str:
    """Normalize text for consistent cache key generation."""
    return _NORMALIZE_RE.sub("", text.strip().lower())


class EmbeddingProvider:
    """Unified embedding provider using httpx for Alibaba Cloud Bailian with caching."""

    def __init__(self) -> None:
        self.base_url = settings.embedding_base_url
        self.api_key = settings.embedding_api_key
        self.model = settings.embedding_model
        self._cache: OrderedDict[str, list[float]] = OrderedDict()

    # ------------------------------------------------------------------
    # Cache helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _cache_key(text: str) -> str:
        return hashlib.sha256(text.encode()).hexdigest()

    def _get_cached(self, text: str) -> list[float] | None:
        key = self._cache_key(text)
        if key in self._cache:
            self._cache.move_to_end(key)
            return self._cache[key]
        return None

    def _put_cache(self, text: str, embedding: list[float]) -> None:
        key = self._cache_key(text)
        self._cache[key] = embedding
        self._cache.move_to_end(key)
        if len(self._cache) > _CACHE_MAX_SIZE:
            self._cache.popitem(last=False)

    # ------------------------------------------------------------------
    # Database-backed persistent cache (L2 cache)
    # ------------------------------------------------------------------

    async def _get_from_db(self, normalized_name: str) -> list[float] | None:
        """Get embedding from database cache by normalized skill name."""
        from app.database import async_session_factory

        async with async_session_factory() as session:
            result = await session.execute(
                select(SkillEmbedding).where(
                    SkillEmbedding.skill_name_normalized == normalized_name
                )
            )
            db_embedding = result.scalar_one_or_none()
            if db_embedding is not None:
                # Convert JSON array to list[float]
                return db_embedding.embedding
            return None

    async def _put_to_db(self, normalized_name: str, original_name: str, embedding: list[float]) -> None:
        """Store embedding in database cache."""
        from app.database import async_session_factory

        async with async_session_factory() as session:
            # Check if already exists
            result = await session.execute(
                select(SkillEmbedding).where(
                    SkillEmbedding.skill_name_normalized == normalized_name
                )
            )
            existing = result.scalar_one_or_none()

            if existing is None:
                db_embedding = SkillEmbedding(
                    skill_name_normalized=normalized_name,
                    skill_name_original=original_name,
                    embedding=embedding,
                    model_name=self.model,
                )
                session.add(db_embedding)
            else:
                existing.embedding = embedding
                existing.model_name = self.model

            await session.commit()

    async def _get_db_batch(
        self, normalized_names: list[str]
    ) -> dict[str, list[float]]:
        """Get multiple embeddings from database in one query."""
        from app.database import async_session_factory

        result_map: dict[str, list[float]] = {}
        try:
            async with async_session_factory() as session:
                result = await session.execute(
                    select(SkillEmbedding).where(
                        SkillEmbedding.skill_name_normalized.in_(normalized_names)
                    )
                )
                for db_embedding in result.scalars().all():
                    result_map[db_embedding.skill_name_normalized] = db_embedding.embedding
        except Exception as exc:
            logger.warning("Embedding DB batch cache lookup failed, falling back to provider-only path: %s", exc)
        return result_map

    async def _put_db_batch(
        self, entries: list[tuple[str, str, list[float]]]
    ) -> None:
        """Store multiple embeddings in database."""
        from app.database import async_session_factory

        try:
            async with async_session_factory() as session:
                for normalized_name, original_name, embedding in entries:
                    # Check if already exists
                    result = await session.execute(
                        select(SkillEmbedding).where(
                            SkillEmbedding.skill_name_normalized == normalized_name
                        )
                    )
                    existing = result.scalar_one_or_none()

                    if existing is None:
                        db_embedding = SkillEmbedding(
                            skill_name_normalized=normalized_name,
                            skill_name_original=original_name,
                            embedding=embedding,
                            model_name=self.model,
                        )
                        session.add(db_embedding)

                await session.commit()
        except Exception as exc:
            logger.warning("Embedding DB batch cache write failed, continuing without persistence: %s", exc)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def embed(self, text: str) -> list[float]:
        """Generate embedding for a single text (L1 + L2 cache, then API)."""
        # Check L1 in-memory cache first
        cached = self._get_cached(text)
        if cached is not None:
            return cached

        # Check L2 database cache
        normalized_name = _normalize_for_cache(text)
        db_cached = await self._get_from_db(normalized_name)
        if db_cached is not None:
            self._put_cache(text, db_cached)
            return db_cached

        # Call API
        async with httpx.AsyncClient() as client:
            data = await self._request_embeddings(client, text)
            vec = self._extract_embedding(data, expected_index=0)

        # Store in both L1 and L2 caches
        self._put_cache(text, vec)
        await self._put_to_db(normalized_name, text, vec)
        return vec

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        """Generate embeddings for multiple texts, using L1 + L2 cache.

        Only calls the API for texts not already cached.
        """
        results: list[list[float] | None] = [None] * len(texts)
        uncached_indices: list[int] = []
        uncached_texts: list[str] = []
        uncached_normalized: list[str] = []

        # Check L1 cache first
        for i, t in enumerate(texts):
            cached = self._get_cached(t)
            if cached is not None:
                results[i] = cached
            else:
                uncached_indices.append(i)
                uncached_texts.append(t)
                uncached_normalized.append(_normalize_for_cache(t))

        if not uncached_texts:
            return results  # type: ignore[return-value]

        # Check L2 database cache for remaining
        db_cache = await self._get_db_batch(uncached_normalized)
        still_uncached_indices: list[int] = []
        still_uncached_texts: list[str] = []
        still_uncached_normalized: list[str] = []

        for j, (idx, norm_name) in enumerate(zip(uncached_indices, uncached_normalized)):
            if norm_name in db_cache:
                vec = db_cache[norm_name]
                results[idx] = vec
                self._put_cache(uncached_texts[j], vec)
            else:
                still_uncached_indices.append(idx)
                still_uncached_texts.append(uncached_texts[j])
                still_uncached_normalized.append(norm_name)

        if not still_uncached_texts:
            logger.debug(
                "Embedding batch: %d L1 hit, %d L2 hit, %d to fetch",
                len(texts) - len(uncached_texts),
                len(uncached_texts) - len(still_uncached_texts),
                0,
            )
            return results  # type: ignore[return-value]

        logger.debug(
            "Embedding batch: %d L1 hit, %d L2 hit, %d to fetch",
            len(texts) - len(uncached_texts),
            len(uncached_texts) - len(still_uncached_texts),
            len(still_uncached_texts),
        )

        # Call API for remaining
        async with httpx.AsyncClient() as client:
            try:
                data = await self._request_embeddings(client, still_uncached_texts)
                db_entries: list[tuple[str, str, list[float]]] = []

                for item in self._extract_embeddings(data, expected_count=len(still_uncached_texts)):
                    item_idx = item["index"]
                    idx = still_uncached_indices[item_idx]
                    vec = item["embedding"]
                    results[idx] = vec
                    self._put_cache(still_uncached_texts[item_idx], vec)
                    db_entries.append((still_uncached_normalized[item_idx], still_uncached_texts[item_idx], vec))

                # Store new embeddings in L2 database cache
                if db_entries:
                    await self._put_db_batch(db_entries)

            except httpx.HTTPStatusError as exc:
                logger.warning(
                    "Embedding batch request rejected with status %s for model %s; falling back to single requests. Response: %s",
                    exc.response.status_code,
                    self.model,
                    exc.response.text[:200],
                )
                for item_idx, text_value in enumerate(still_uncached_texts):
                    vec = await self.embed(text_value)
                    results[still_uncached_indices[item_idx]] = vec

        return results  # type: ignore[return-value]

    async def embed_documents(self, documents: list[dict[str, Any]]) -> list[list[float]]:
        """Generate embeddings for documents with a 'content' key."""
        texts = [doc.get("content", "") for doc in documents]
        return await self.embed_batch(texts)

    async def _request_embeddings(self, client: httpx.AsyncClient, payload_input: str | list[str]) -> dict[str, Any]:
        response = await client.post(
            f"{self.base_url}/embeddings",
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": self.model,
                "input": payload_input,
            },
            timeout=30.0,
        )
        try:
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            if 400 <= exc.response.status_code < 500:
                logger.error(
                    "Embedding request rejected by provider. model=%s status=%s body=%s",
                    self.model,
                    exc.response.status_code,
                    exc.response.text[:300],
                )
            raise

        data = response.json()
        if not isinstance(data, dict) or not isinstance(data.get("data"), list):
            raise ValueError(f"Embedding API returned unexpected payload: {str(data)[:200]}")
        return data

    @staticmethod
    def _extract_embedding(data: dict[str, Any], expected_index: int) -> list[float]:
        items = EmbeddingProvider._extract_embeddings(data, expected_count=expected_index + 1)
        for item in items:
            if item["index"] == expected_index:
                return item["embedding"]
        raise ValueError(f"Embedding API payload missing expected index {expected_index}")

    @staticmethod
    def _extract_embeddings(data: dict[str, Any], expected_count: int) -> list[dict[str, Any]]:
        items: list[dict[str, Any]] = []
        for raw_item in data.get("data", []):
            if not isinstance(raw_item, dict):
                raise ValueError(f"Embedding item is not an object: {raw_item!r}")
            item_idx = raw_item.get("index")
            embedding = raw_item.get("embedding")
            if not isinstance(item_idx, int) or not 0 <= item_idx < expected_count:
                raise ValueError(
                    f"Embedding API returned invalid index {item_idx}; expected range 0-{expected_count - 1}"
                )
            if not isinstance(embedding, list) or not embedding:
                raise ValueError(f"Embedding API returned invalid vector for index {item_idx}")
            items.append({"index": item_idx, "embedding": embedding})

        if len(items) != expected_count:
            raise ValueError(f"Embedding API returned {len(items)} vectors, expected {expected_count}")

        return sorted(items, key=lambda item: item["index"])


# Singleton instance
embedding = EmbeddingProvider()
