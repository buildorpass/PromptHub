import time
import logging
from typing import Optional, List

from app.adapters.base import BaseLLMAdapter, LLMResponse
from app.config import settings

logger = logging.getLogger(__name__)

DEEPSEEK_MODELS = ["deepseek-chat", "deepseek-reasoner"]


class DeepSeekAdapter(BaseLLMAdapter):
    def __init__(self):
        self._client = None

    def _get_client(self):
        if self._client is None:
            if not settings.deepseek_api_key:
                raise ValueError(
                    "DeepSeek API key not configured. Set DEEPSEEK_API_KEY in your .env file."
                )
            from openai import AsyncOpenAI
            self._client = AsyncOpenAI(
                api_key=settings.deepseek_api_key,
                base_url="https://api.deepseek.com",
            )
        return self._client

    @property
    def provider(self) -> str:
        return "deepseek"

    def supported_models(self) -> List[str]:
        return DEEPSEEK_MODELS

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
            logger.error("DeepSeek API error: %s", exc)
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
