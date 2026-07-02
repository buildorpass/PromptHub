import time
import logging
from typing import Optional, List

from app.adapters.base import BaseLLMAdapter, LLMResponse
from app.config import settings

logger = logging.getLogger(__name__)

ANTHROPIC_MODELS = [
    "claude-sonnet-4-6",
    "claude-haiku-4-5-20251001",
    "claude-opus-4-8",
]


class AnthropicAdapter(BaseLLMAdapter):
    def __init__(self):
        self._client = None

    def _get_client(self):
        if self._client is None:
            if not settings.anthropic_api_key:
                raise ValueError(
                    "Anthropic API key not configured. Set ANTHROPIC_API_KEY in your .env file."
                )
            from anthropic import AsyncAnthropic
            self._client = AsyncAnthropic(api_key=settings.anthropic_api_key)
        return self._client

    @property
    def provider(self) -> str:
        return "anthropic"

    def supported_models(self) -> List[str]:
        return ANTHROPIC_MODELS

    async def complete(
        self,
        prompt: str,
        system_prompt: Optional[str],
        model: str,
        max_tokens: int = 2048,
        temperature: float = 0.7,
    ) -> LLMResponse:
        client = self._get_client()

        kwargs = {
            "model": model,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "messages": [{"role": "user", "content": prompt}],
        }
        if system_prompt:
            kwargs["system"] = system_prompt

        start = time.monotonic()
        try:
            response = await client.messages.create(**kwargs)
        except Exception as exc:
            elapsed_ms = int((time.monotonic() - start) * 1000)
            logger.error("Anthropic API error: %s", exc)
            return LLMResponse(
                output_text="",
                input_tokens=0,
                output_tokens=0,
                latency_ms=elapsed_ms,
                error=str(exc),
            )

        elapsed_ms = int((time.monotonic() - start) * 1000)

        output_text = ""
        for block in response.content:
            if hasattr(block, "text"):
                output_text += block.text

        error = None
        if response.stop_reason not in ("end_turn", "max_tokens", None):
            error = f"Unexpected stop_reason: {response.stop_reason}"

        return LLMResponse(
            output_text=output_text,
            input_tokens=response.usage.input_tokens if response.usage else 0,
            output_tokens=response.usage.output_tokens if response.usage else 0,
            latency_ms=elapsed_ms,
            error=error,
        )
