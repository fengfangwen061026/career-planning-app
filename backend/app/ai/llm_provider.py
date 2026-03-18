"""LLM Provider - Unified interface for LLM calls."""

import asyncio
import json
import logging
import re
from typing import Any, AsyncIterator, Literal

from openai import APIConnectionError, APIStatusError, AsyncOpenAI, RateLimitError

from app.config import settings

logger = logging.getLogger(__name__)

ProviderName = Literal["default", "profile"]
_RETRYABLE_STATUS_CODES = {405, 408, 409, 429, 500, 502, 503, 504}


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
        kwargs.update(extra_kwargs)

        for attempt in range(1, max_retries + 1):
            try:
                response = await client.chat.completions.create(**kwargs)
                content = response.choices[0].message.content or ""
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
        stream = await client.chat.completions.create(
            model=model or default_model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=True,
            **extra_kwargs,
        )
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

    fence_match = re.search(r"```(?:json)?\s*\n?(.*?)\n?\s*```", text, re.DOTALL)
    if fence_match:
        text = fence_match.group(1).strip()

    try:
        result = json.loads(text)
        if isinstance(result, dict):
            return result
    except json.JSONDecodeError:
        pass

    brace_match = re.search(r"\{.*\}", text, re.DOTALL)
    if brace_match:
        result = json.loads(brace_match.group())
        if isinstance(result, dict):
            return result

    raise ValueError(f"Could not extract JSON object from response: {text[:200]}...")


def _strip_reasoning(text: str) -> str:
    """Strip reasoning tags from model output when providers include them in content."""
    cleaned = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL)
    return cleaned.strip()


llm = LLMProvider()
