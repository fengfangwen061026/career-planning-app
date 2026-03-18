"""LLM Provider - Unified interface for LLM calls."""

import json
import logging
import re
from typing import Any, AsyncIterator

from openai import AsyncOpenAI

from app.config import settings

logger = logging.getLogger(__name__)


class LLMProvider:
    """Unified LLM provider using OpenAI-compatible SDK."""

    def __init__(self) -> None:
        self.client = AsyncOpenAI(
            base_url=settings.llm_base_url,
            api_key=settings.llm_api_key,
        )
        self.model = settings.llm_model

    # ------------------------------------------------------------------
    # Core: low-level chat
    # ------------------------------------------------------------------

    async def chat(
        self,
        messages: list[dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int | None = None,
        disable_reasoning: bool = False,
    ) -> str:
        kwargs: dict = dict(
            model=self.model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        response = await self.client.chat.completions.create(**kwargs)
        content = response.choices[0].message.content or ""
        return _strip_reasoning(content)

    async def chat_stream(
        self,
        messages: list[dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int | None = None,
    ) -> AsyncIterator[str]:
        stream = await self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=True,
        )
        async for chunk in stream:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content

    # ------------------------------------------------------------------
    # High-level helpers
    # ------------------------------------------------------------------

    async def generate(
        self,
        prompt: str,
        system_prompt: str = "",
        temperature: float = 0.7,
        max_tokens: int | None = None,
        disable_reasoning: bool = False,
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
    ) -> dict[str, Any]:
        """Generate a structured JSON response with retry & parse tolerance.

        Attempts to use the API's native json_object response_format first.
        Falls back to extracting JSON from free-text on parse failure.
        Retries up to *max_retries* times on JSON decode errors.
        """
        messages: list[dict[str, str]] = []

        # Build system prompt – always instruct JSON output
        sys_parts: list[str] = []
        if system_prompt:
            sys_parts.append(system_prompt)
        sys_parts.append("You MUST respond with valid JSON only. No extra text before or after the JSON.")
        if json_schema:
            sys_parts.append(f"The JSON must conform to this schema:\n{json.dumps(json_schema, ensure_ascii=False, indent=2)}")
        messages.append({"role": "system", "content": "\n\n".join(sys_parts)})
        messages.append({"role": "user", "content": prompt})

        last_error: Exception | None = None
        for attempt in range(1, max_retries + 1):
            try:
                raw = await self.chat(
                    messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    disable_reasoning=disable_reasoning,
                )
                return _parse_json_tolerant(raw)
            except (json.JSONDecodeError, ValueError) as exc:
                last_error = exc
                logger.warning("generate_json attempt %d/%d failed: %s", attempt, max_retries, exc)
                # Add a retry hint as an assistant→user exchange
                if attempt < max_retries:
                    messages.append({"role": "assistant", "content": raw})
                    messages.append({
                        "role": "user",
                        "content": "Your previous response was not valid JSON. Please reply with ONLY a valid JSON object.",
                    })

        raise ValueError(f"Failed to get valid JSON after {max_retries} attempts: {last_error}")


def _parse_json_tolerant(text: str) -> dict[str, Any]:
    """Parse JSON from text, tolerating markdown fences and leading/trailing junk."""
    text = text.strip()

    # Strip markdown code fences: ```json ... ``` or ``` ... ```
    fence_match = re.search(r"```(?:json)?\s*\n?(.*?)\n?\s*```", text, re.DOTALL)
    if fence_match:
        text = fence_match.group(1).strip()

    # Try direct parse first
    try:
        result = json.loads(text)
        if isinstance(result, dict):
            return result
    except json.JSONDecodeError:
        pass

    # Try to find the first { ... } block
    brace_match = re.search(r"\{.*\}", text, re.DOTALL)
    if brace_match:
        result = json.loads(brace_match.group())
        if isinstance(result, dict):
            return result

    raise ValueError(f"Could not extract JSON object from response: {text[:200]}...")


def _strip_reasoning(text: str) -> str:
    """清除推理模型输出中的思维链标签（<think>...</think>）。

    Step-3.5-Flash 等推理模型在非流式调用时可能将思考过程混入 content。
    此函数确保返回内容只包含最终答案部分。
    """
    # 移除 <think>...</think> 块（含跨行情况）
    cleaned = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL)
    return cleaned.strip()


# Singleton instance
llm = LLMProvider()
