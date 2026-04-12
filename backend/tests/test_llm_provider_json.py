from types import SimpleNamespace

import pytest

from app.ai.llm_provider import LLMProvider, _parse_json_tolerant
from app.config import _normalize_stepfun_base_url


def test_parse_json_tolerant_accepts_trailing_text() -> None:
    payload = '{"skills": [{"name": "Python"}]}\n\n补充说明：以上为解析结果。'
    assert _parse_json_tolerant(payload) == {"skills": [{"name": "Python"}]}


def test_parse_json_tolerant_accepts_code_fence() -> None:
    payload = '```json\n{"parse_confidence": 0.8, "missing_fields": []}\n```'
    assert _parse_json_tolerant(payload) == {
        "parse_confidence": 0.8,
        "missing_fields": [],
    }


def test_parse_json_tolerant_accepts_trailing_commas() -> None:
    payload = '{"education": [{"school": "X",}], "missing_fields": [],}'
    assert _parse_json_tolerant(payload) == {
        "education": [{"school": "X"}],
        "missing_fields": [],
    }


def test_parse_json_tolerant_raises_without_json() -> None:
    with pytest.raises(ValueError):
        _parse_json_tolerant("not json")


def test_normalize_stepfun_base_url_rewrites_legacy_path() -> None:
    assert _normalize_stepfun_base_url("https://api.stepfun.com/step_plan/v1") == "https://api.stepfun.com/v1"


def test_get_client_disables_env_proxy_inheritance(monkeypatch: pytest.MonkeyPatch) -> None:
    provider = LLMProvider()
    monkeypatch.setattr(
        provider,
        "_provider_config",
        lambda _provider: ("https://api.stepfun.com/v1", "test-key", "step-3.5-flash"),
    )

    client = provider._get_client("default")

    assert client._client._trust_env is False


@pytest.mark.asyncio
async def test_chat_drops_unsupported_stepfun_reasoning_controls(monkeypatch: pytest.MonkeyPatch) -> None:
    class DummyCreate:
        def __init__(self) -> None:
            self.kwargs: dict | None = None

        async def create(self, **kwargs):
            self.kwargs = kwargs
            return SimpleNamespace(
                choices=[
                    SimpleNamespace(
                        message=SimpleNamespace(content='{"ok": true}'),
                        finish_reason="stop",
                    )
                ]
            )

    dummy_create = DummyCreate()
    dummy_client = SimpleNamespace(
        chat=SimpleNamespace(
            completions=SimpleNamespace(create=dummy_create.create)
        )
    )

    provider = LLMProvider()
    monkeypatch.setattr(
        provider,
        "_provider_config",
        lambda _provider: ("https://api.stepfun.com/v1", "test-key", "step-3.5-flash"),
    )
    monkeypatch.setattr(provider, "_get_client", lambda _provider: dummy_client)

    await provider.chat(
        [{"role": "user", "content": "test"}],
        disable_reasoning=True,
        enable_thinking=False,
        reasoning_effort="low",
        verbosity="low",
        timeout=7,
    )

    assert dummy_create.kwargs is not None
    assert dummy_create.kwargs["timeout"] == 7
    assert "extra_body" not in dummy_create.kwargs
    assert "enable_thinking" not in dummy_create.kwargs
    assert "reasoning_effort" not in dummy_create.kwargs
    assert "verbosity" not in dummy_create.kwargs
