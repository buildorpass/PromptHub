from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional, List


@dataclass
class LLMResponse:
    output_text: str
    input_tokens: int
    output_tokens: int
    latency_ms: int
    error: Optional[str] = None


class BaseLLMAdapter(ABC):
    @abstractmethod
    async def complete(
        self,
        prompt: str,
        system_prompt: Optional[str],
        model: str,
        max_tokens: int = 2048,
        temperature: float = 0.7,
    ) -> LLMResponse: ...

    @property
    @abstractmethod
    def provider(self) -> str: ...

    @abstractmethod
    def supported_models(self) -> List[str]: ...
