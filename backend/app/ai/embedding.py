"""Embedding provider - Unified interface for embedding calls with caching."""

import hashlib
import logging
from collections import OrderedDict
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

# LRU-style in-memory cache (text hash → embedding vector)
_CACHE_MAX_SIZE = 2048


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
    # Public API
    # ------------------------------------------------------------------

    async def embed(self, text: str) -> list[float]:
        """Generate embedding for a single text (cached)."""
        cached = self._get_cached(text)
        if cached is not None:
            return cached

        async with httpx.AsyncClient() as client:
            data = await self._request_embeddings(client, text)
            vec = self._extract_embedding(data, expected_index=0)

        self._put_cache(text, vec)
        return vec

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        """Generate embeddings for multiple texts, using cache where possible.

        Only calls the API for texts not already cached.
        """
        results: list[list[float] | None] = [None] * len(texts)
        uncached_indices: list[int] = []
        uncached_texts: list[str] = []

        for i, t in enumerate(texts):
            cached = self._get_cached(t)
            if cached is not None:
                results[i] = cached
            else:
                uncached_indices.append(i)
                uncached_texts.append(t)

        if uncached_texts:
            logger.debug("Embedding batch: %d cached, %d to fetch", len(texts) - len(uncached_texts), len(uncached_texts))
            async with httpx.AsyncClient() as client:
                try:
                    data = await self._request_embeddings(client, uncached_texts)
                    for item in self._extract_embeddings(data, expected_count=len(uncached_texts)):
                        item_idx = item["index"]
                        idx = uncached_indices[item_idx]
                        vec = item["embedding"]
                        results[idx] = vec
                        self._put_cache(uncached_texts[item_idx], vec)
                except httpx.HTTPStatusError as exc:
                    logger.warning(
                        "Embedding batch request rejected with status %s for model %s; falling back to single requests. Response: %s",
                        exc.response.status_code,
                        self.model,
                        exc.response.text[:200],
                    )
                    for item_idx, text_value in enumerate(uncached_texts):
                        vec = await self.embed(text_value)
                        results[uncached_indices[item_idx]] = vec

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
