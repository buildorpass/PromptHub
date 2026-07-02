import re
import logging
from typing import Dict, List, Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.adapters.base import BaseLLMAdapter, LLMResponse
from app.adapters.openai_adapter import OpenAIAdapter, OPENAI_MODELS
from app.adapters.anthropic_adapter import AnthropicAdapter, ANTHROPIC_MODELS
from app.adapters.deepseek_adapter import DeepSeekAdapter, DEEPSEEK_MODELS
from app.config import settings

logger = logging.getLogger(__name__)

# Singleton adapter instances (lazy init)
_openai_adapter = OpenAIAdapter()
_anthropic_adapter = AnthropicAdapter()
_deepseek_adapter = DeepSeekAdapter()

_MODEL_MAP: Dict[str, BaseLLMAdapter] = {}

for _m in OPENAI_MODELS:
    _MODEL_MAP[_m] = _openai_adapter
for _m in ANTHROPIC_MODELS:
    _MODEL_MAP[_m] = _anthropic_adapter
for _m in DEEPSEEK_MODELS:
    _MODEL_MAP[_m] = _deepseek_adapter


def _key_available(provider: str) -> bool:
    mapping = {
        "openai": settings.openai_api_key,
        "anthropic": settings.anthropic_api_key,
        "deepseek": settings.deepseek_api_key,
    }
    key = mapping.get(provider, "")
    return bool(key and key.strip())


def get_adapter(model_name: str) -> BaseLLMAdapter:
    """Return the adapter for a given model name.

    Raises ValueError if the model is unknown or the API key is not configured.
    """
    adapter = _MODEL_MAP.get(model_name)
    if adapter is None:
        raise ValueError(
            f"Unknown model '{model_name}'. "
            f"Available models: {list(_MODEL_MAP.keys())}"
        )
    if not _key_available(adapter.provider):
        raise ValueError(
            f"API key for provider '{adapter.provider}' is not configured. "
            f"Set the corresponding environment variable."
        )
    return adapter


def list_available_models() -> List[dict]:
    """Return a list of all known models with availability status."""
    models = []
    for model_name, adapter in _MODEL_MAP.items():
        models.append(
            {
                "model": model_name,
                "provider": adapter.provider,
                "available": _key_available(adapter.provider),
            }
        )
    return models


_ASSET_RE = re.compile(r"\{\{asset:([^}]+)\}\}")
_VAR_RE = re.compile(r"\{\{([^}]+)\}\}")


async def resolve_assets(content: str, db: AsyncSession) -> str:
    """Replace {{asset:name}} patterns in content with the asset's content from the DB."""
    from app.models.orm import Asset

    asset_names = _ASSET_RE.findall(content)
    if not asset_names:
        return content

    # Batch-fetch all referenced assets
    stmt = select(Asset).where(Asset.name.in_(asset_names))
    result = await db.execute(stmt)
    assets = {a.name: a.content for a in result.scalars().all()}

    def replace_asset(match: re.Match) -> str:
        name = match.group(1)
        if name in assets:
            return assets[name]
        logger.warning("Asset '{{asset:%s}}' not found — leaving token as-is", name)
        return match.group(0)

    return _ASSET_RE.sub(replace_asset, content)


def interpolate_variables(content: str, variable_inputs: Optional[dict]) -> str:
    """Replace {{variable_name}} patterns (non-asset) with values from variable_inputs."""
    if not variable_inputs:
        return content

    def replace_var(match: re.Match) -> str:
        token = match.group(1)
        # Skip asset tokens — already resolved
        if token.startswith("asset:"):
            return match.group(0)
        if token in variable_inputs:
            return str(variable_inputs[token])
        logger.warning("Variable '{{%s}}' has no value — leaving token as-is", token)
        return match.group(0)

    return _VAR_RE.sub(replace_var, content)


async def compute_cost(
    model_name: str,
    input_tokens: int,
    output_tokens: int,
    db: AsyncSession,
) -> Optional[float]:
    """Look up model pricing and return computed cost, or None if not found."""
    from app.models.orm import ModelPricing

    stmt = select(ModelPricing).where(ModelPricing.model_name == model_name)
    result = await db.execute(stmt)
    pricing = result.scalar_one_or_none()
    if pricing is None:
        return None
    return (input_tokens * pricing.input_rate / 1000) + (output_tokens * pricing.output_rate / 1000)
