"""Embedding provider - Unified interface for embedding calls with caching."""

import hashlib
import logging
from collections import OrderedDict
from typing import Any

from openai import AsyncOpenAI

from app.config import settings

logger = logging.getLogger(__name__)

# LRU-style in-memory cache (text hash → embedding vector)
_CACHE_MAX_SIZE = 2048


class EmbeddingProvider:
    """Unified embedding provider using OpenAI-compatible SDK with caching."""

    def __init__(self) -> None:
        self.client = AsyncOpenAI(
            base_url=settings.embedding_base_url,
            api_key=settings.embedding_api_key,
        )
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

        response = await self.client.embeddings.create(
            model=self.model,
            input=text,
        )
        vec = response.data[0].embedding
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
            response = await self.client.embeddings.create(
                model=self.model,
                input=uncached_texts,
            )
            for data_item in response.data:
                idx = uncached_indices[data_item.index]
                vec = data_item.embedding
                results[idx] = vec
                self._put_cache(uncached_texts[data_item.index], vec)

        return results  # type: ignore[return-value]

    async def embed_documents(self, documents: list[dict[str, Any]]) -> list[list[float]]:
        """Generate embeddings for documents with a 'content' key."""
        texts = [doc.get("content", "") for doc in documents]
        return await self.embed_batch(texts)


# Singleton instance
embedding = EmbeddingProvider()
