"""LLM Provider - Unified interface for LLM calls."""

import asyncio
import inspect
import json
import logging
import re
from typing import Any, AsyncIterator, Literal

from openai import APIConnectionError, APIStatusError, AsyncOpenAI, RateLimitError
from openai.resources.chat.completions.completions import AsyncCompletions

from app.config import settings

logger = logging.getLogger(__name__)

ProviderName = Literal["default", "profile"]
_RETRYABLE_STATUS_CODES = {405, 408, 409, 429, 500, 502, 503, 504}
_CHAT_COMPLETION_CREATE_PARAMS = {
    name for name in inspect.signature(AsyncCompletions.create).parameters if name != "self"
}


class LLMProvider:
    """Unified LLM provider using OpenAI-compatible SDK."""

    def __init__(self) -> None:
        self._clients: dict[ProviderName, AsyncOpenAI] = {}

    def _provider_config(self, provider: ProviderName) -> tuple[str, str, str]:
        if provider == "profile":
            return (
                settings.profile_llm_base_url or settings.llm_base_url,
                settings.profile_llm_api_key or settings.llm_api_key,
                settings.profile_llm_model or settings.llm_model,
            )
        return (
            settings.llm_base_url,
            settings.llm_api_key,
            settings.llm_model,
        )

    def _provider_headers(self, provider: ProviderName) -> dict[str, str] | None:
        base_url, _, _ = self._provider_config(provider)
        if "openrouter.ai" in base_url:
            return {
                "HTTP-Referer": "https://career-planning-app.local",
                "X-Title": "Career Planning App",
            }
        return None

    def _get_client(self, provider: ProviderName) -> AsyncOpenAI:
        client = self._clients.get(provider)
        if client is None:
            base_url, api_key, _ = self._provider_config(provider)
            headers = self._provider_headers(provider)
            client = AsyncOpenAI(
                base_url=base_url,
                api_key=api_key,
                default_headers=headers,
            )
            self._clients[provider] = client
        return client

    @staticmethod
    def _merge_extra_body(kwargs: dict[str, Any], extra_kwargs: dict[str, Any]) -> None:
        extra_body = dict(kwargs.get("extra_body") or {})
        for key, value in extra_kwargs.items():
            if key in _CHAT_COMPLETION_CREATE_PARAMS:
                kwargs[key] = value
            else:
                extra_body[key] = value
        if extra_body:
            kwargs["extra_body"] = extra_body

    async def chat(
        self,
        messages: list[dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int | None = None,
        disable_reasoning: bool = False,
        max_retries: int = 3,
        provider: ProviderName = "default",
        model: str | None = None,
        **extra_kwargs: Any,
    ) -> str:
        client = self._get_client(provider)
        _, _, default_model = self._provider_config(provider)
        kwargs: dict[str, Any] = dict(
            model=model or default_model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        self._merge_extra_body(kwargs, extra_kwargs)

        for attempt in range(1, max_retries + 1):
            try:
                response = await client.chat.completions.create(**kwargs)
                choice = response.choices[0]
                content = choice.message.content or ""
                finish_reason = getattr(choice, "finish_reason", None)
                log_fn = logger.warning if finish_reason and finish_reason != "stop" else logger.info
                log_fn(
                    "LLM chat completed: provider=%s model=%s finish_reason=%s content_len=%d",
                    provider,
                    model or default_model,
                    finish_reason,
                    len(content),
                )
                return _strip_reasoning(content)
            except (RateLimitError, APIConnectionError) as exc:
                if attempt >= max_retries:
                    raise
                wait_seconds = min(2 ** (attempt - 1), 8)
                logger.warning(
                    "LLM chat attempt %d/%d failed with retryable connection error: %s; retrying in %ss",
                    attempt, max_retries, exc, wait_seconds,
                )
                await asyncio.sleep(wait_seconds)
            except APIStatusError as exc:
                if exc.status_code not in _RETRYABLE_STATUS_CODES or attempt >= max_retries:
                    raise
                wait_seconds = min(2 ** (attempt - 1), 8)
                logger.warning(
                    "LLM chat attempt %d/%d failed with status %s; retrying in %ss",
                    attempt, max_retries, exc.status_code, wait_seconds,
                )
                await asyncio.sleep(wait_seconds)

        raise RuntimeError("LLM chat failed unexpectedly after retries")

    async def chat_stream(
        self,
        messages: list[dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int | None = None,
        provider: ProviderName = "default",
        model: str | None = None,
        **extra_kwargs: Any,
    ) -> AsyncIterator[str]:
        client = self._get_client(provider)
        _, _, default_model = self._provider_config(provider)
        kwargs: dict[str, Any] = dict(
            model=model or default_model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=True,
        )
        self._merge_extra_body(kwargs, extra_kwargs)
        stream = await client.chat.completions.create(**kwargs)
        async for chunk in stream:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content

    async def generate(
        self,
        prompt: str,
        system_prompt: str = "",
        temperature: float = 0.7,
        max_tokens: int | None = None,
        disable_reasoning: bool = False,
        max_retries: int = 3,
        provider: ProviderName = "default",
        model: str | None = None,
        **extra_kwargs: Any,
    ) -> str:
        """Generate a plain-text response from a prompt."""
        messages: list[dict[str, str]] = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        return await self.chat(
            messages,
            temperature=temperature,
            max_tokens=max_tokens,
            disable_reasoning=disable_reasoning,
            max_retries=max_retries,
            provider=provider,
            model=model,
            **extra_kwargs,
        )

    async def generate_json(
        self,
        prompt: str,
        system_prompt: str = "",
        json_schema: dict[str, Any] | None = None,
        max_retries: int = 3,
        temperature: float = 0.3,
        max_tokens: int | None = None,
        disable_reasoning: bool = False,
        provider: ProviderName = "default",
        model: str | None = None,
        enable_thinking: bool | None = None,
        **extra_kwargs: Any,
    ) -> dict[str, Any]:
        """Generate a structured JSON response with retry & parse tolerance."""
        messages: list[dict[str, str]] = []

        sys_parts: list[str] = []
        if system_prompt:
            sys_parts.append(system_prompt)
        sys_parts.append("You MUST respond with valid JSON only. No extra text before or after the JSON.")
        if json_schema:
            sys_parts.append(
                f"The JSON must conform to this schema:\n{json.dumps(json_schema, ensure_ascii=False, indent=2)}"
            )
        messages.append({"role": "system", "content": "\n\n".join(sys_parts)})
        messages.append({"role": "user", "content": prompt})

        if enable_thinking is not None:
            extra_kwargs["enable_thinking"] = enable_thinking

        last_error: Exception | None = None
        raw = ""
        for attempt in range(1, max_retries + 1):
            try:
                raw = await self.chat(
                    messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    disable_reasoning=disable_reasoning,
                    max_retries=max_retries,
                    provider=provider,
                    model=model,
                    **extra_kwargs,
                )
                return _parse_json_tolerant(raw)
            except (json.JSONDecodeError, ValueError) as exc:
                last_error = exc
                logger.warning("generate_json attempt %d/%d failed: %s", attempt, max_retries, exc)
                if attempt < max_retries:
                    messages.append({"role": "assistant", "content": raw})
                    messages.append(
                        {
                            "role": "user",
                            "content": "Your previous response was not valid JSON. Please reply with ONLY a valid JSON object.",
                        }
                    )

        raise ValueError(f"Failed to get valid JSON after {max_retries} attempts: {last_error}")


def _parse_json_tolerant(text: str) -> dict[str, Any]:
    """Parse JSON from text, tolerating markdown fences and leading/trailing junk."""
    text = text.strip()
    candidates: list[str] = []

    fence_match = re.search(r"```(?:json)?\s*\n?(.*?)\n?\s*```", text, re.DOTALL)
    if fence_match:
        candidates.append(fence_match.group(1).strip())

    candidates.append(text)

    decoder = json.JSONDecoder()
    seen: set[str] = set()
    for candidate in candidates + list(_iter_json_object_candidates(text)):
        candidate = candidate.strip()
        if not candidate or candidate in seen:
            continue
        seen.add(candidate)

        for normalized in (candidate, re.sub(r",\s*([}\]])", r"\1", candidate)):
            try:
                result = json.loads(normalized)
                if isinstance(result, dict):
                    return result
            except json.JSONDecodeError:
                try:
                    result, _ = decoder.raw_decode(normalized)
                except json.JSONDecodeError:
                    continue
                if isinstance(result, dict):
                    return result

    raise ValueError(f"Could not extract JSON object from response: {text[:200]}...")


def _iter_json_object_candidates(text: str) -> list[str]:
    """Extract balanced JSON object substrings from arbitrary model output."""
    candidates: list[str] = []
    for start, char in enumerate(text):
        if char != "{":
            continue

        depth = 0
        in_string = False
        escaped = False
        for end in range(start, len(text)):
            current = text[end]
            if in_string:
                if escaped:
                    escaped = False
                elif current == "\\":
                    escaped = True
                elif current == '"':
                    in_string = False
                continue

            if current == '"':
                in_string = True
            elif current == "{":
                depth += 1
            elif current == "}":
                depth -= 1
                if depth == 0:
                    candidates.append(text[start:end + 1])
                    break

    return candidates


def _strip_reasoning(text: str) -> str:
    """Strip reasoning tags from model output when providers include them in content."""
    cleaned = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL)
    return cleaned.strip()


llm = LLMProvider()
