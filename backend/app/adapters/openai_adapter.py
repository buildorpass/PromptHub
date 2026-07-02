import time
import logging
from typing import Optional, List

from app.adapters.base import BaseLLMAdapter, LLMResponse
from app.config import settings

logger = logging.getLogger(__name__)

OPENAI_MODELS = ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"]


class OpenAIAdapter(BaseLLMAdapter):
    def __init__(self):
        self._client = None

    def _get_client(self):
        if self._client is None:
            if not settings.openai_api_key:
                raise ValueError(
                    "OpenAI API key not configured. Set OPENAI_API_KEY in your .env file."
                )
            from openai import AsyncOpenAI
            self._client = AsyncOpenAI(api_key=settings.openai_api_key)
        return self._client

    @property
    def provider(self) -> str:
        return "openai"

    def supported_models(self) -> List[str]:
        return OPENAI_MODELS

    async def complete(
        self,
        prompt: str,
        system_prompt: Optional[str],
        model: str,
        max_tokens: int = 2048,
        temperature: float = 0.7,
    ) -> LLMResponse:
        client = self._get_client()

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        start = time.monotonic()
        try:
            response = await client.chat.completions.create(
                model=model,
                messages=messages,
                max_tokens=max_tokens,
                temperature=temperature,
            )
        except Exception as exc:
            elapsed_ms = int((time.monotonic() - start) * 1000)
            logger.error("OpenAI API error: %s", exc)
            return LLMResponse(
                output_text="",
                input_tokens=0,
                output_tokens=0,
                latency_ms=elapsed_ms,
                error=str(exc),
            )

        elapsed_ms = int((time.monotonic() - start) * 1000)
        choice = response.choices[0]
        output_text = choice.message.content or ""

        error = None
        if choice.finish_reason not in ("stop", "length", None):
            error = f"Unexpected finish_reason: {choice.finish_reason}"

        return LLMResponse(
            output_text=output_text,
            input_tokens=response.usage.prompt_tokens if response.usage else 0,
            output_tokens=response.usage.completion_tokens if response.usage else 0,
            latency_ms=elapsed_ms,
            error=error,
        )
