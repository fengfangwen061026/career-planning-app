import httpx
import pytest

from app.ai.embedding import EmbeddingProvider


@pytest.mark.asyncio
async def test_embed_batch_preserves_result_order_with_cached_entries(monkeypatch) -> None:
    provider = EmbeddingProvider()
    provider._put_cache("cached-skill", [9.0, 9.0])

    async def fake_request_embeddings(client, payload_input):
        assert payload_input == ["new-skill-a", "new-skill-b"]
        return {
            "data": [
                {"index": 0, "embedding": [1.0, 0.0]},
                {"index": 1, "embedding": [0.0, 1.0]},
            ]
        }

    monkeypatch.setattr(provider, "_request_embeddings", fake_request_embeddings)

    result = await provider.embed_batch(["cached-skill", "new-skill-a", "new-skill-b"])

    assert result == [
        [9.0, 9.0],
        [1.0, 0.0],
        [0.0, 1.0],
    ]


@pytest.mark.asyncio
async def test_embed_batch_falls_back_to_single_requests_on_provider_4xx(monkeypatch) -> None:
    provider = EmbeddingProvider()

    async def fake_request_embeddings(client, payload_input):
        request = httpx.Request("POST", "https://example.com/embeddings")
        response = httpx.Response(400, request=request, text='{"error":"bad request"}')
        raise httpx.HTTPStatusError("bad request", request=request, response=response)

    async def fake_embed(text: str) -> list[float]:
        return [float(len(text))]

    monkeypatch.setattr(provider, "_request_embeddings", fake_request_embeddings)
    monkeypatch.setattr(provider, "embed", fake_embed)

    result = await provider.embed_batch(["alpha", "beta"])

    assert result == [[5.0], [4.0]]
