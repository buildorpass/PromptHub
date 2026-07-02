"""
Shared fan-out service for running LLM calls across multiple models.
Both routers/runs.py and routers/test_cases.py import from here.
"""
import asyncio
import logging
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.registry import (
    get_adapter,
    resolve_assets,
    interpolate_variables,
    compute_cost,
)
from app.models.orm import TestRun, RunResult
from app.repositories.sqlite import (
    SQLiteRunRepository,
    SQLiteRunResultRepository,
    SQLiteVersionRepository,
)

logger = logging.getLogger(__name__)


async def run_fan_out(
    prompt_version_id: int,
    model_names: list[str],
    variable_inputs: Optional[dict],
    db: AsyncSession,
    max_tokens: int = 2048,
    temperature: float = 0.7,
) -> tuple[TestRun, list[RunResult]]:
    """
    Creates a TestRun, fans out async LLM calls to all model_names,
    creates RunResult rows for each, updates TestRun status to 'completed'.
    Returns (test_run, results).

    Uses asyncio.gather(..., return_exceptions=True) so a single model
    failure never aborts the other calls.
    """
    version_repo = SQLiteVersionRepository(db)
    run_repo = SQLiteRunRepository(db)
    result_repo = SQLiteRunResultRepository(db)

    version = await version_repo.get(prompt_version_id)
    if version is None:
        raise ValueError(f"Prompt version {prompt_version_id} not found")

    # Resolve assets and interpolate variables ONCE — same resolved prompt for all models
    try:
        content = await resolve_assets(version.content, db)
        content = interpolate_variables(content, variable_inputs)
        system_prompt = version.system_prompt
        if system_prompt:
            system_prompt = await resolve_assets(system_prompt, db)
            system_prompt = interpolate_variables(system_prompt, variable_inputs)
        else:
            system_prompt = None
    except Exception as exc:
        logger.error("Asset/variable resolution failed: %s", exc)
        content = version.content
        system_prompt = version.system_prompt

    # Create a single TestRun record
    run = await run_repo.create(
        {
            "prompt_version_id": prompt_version_id,
            "status": "running",
        }
    )
    await db.commit()

    # Fan-out all model calls concurrently
    async def call_model(model_name: str):
        adapter = get_adapter(model_name)  # raises ValueError if unknown/missing key
        return await adapter.complete(
            prompt=content,
            system_prompt=system_prompt,
            model=model_name,
            max_tokens=max_tokens,
            temperature=temperature,
        )

    responses = await asyncio.gather(
        *[call_model(m) for m in model_names],
        return_exceptions=True,
    )

    # Create RunResult rows for each model
    results: list[RunResult] = []
    for model_name, response in zip(model_names, responses):
        if isinstance(response, Exception):
            # Model call raised — create error result
            rr = await result_repo.create(
                {
                    "test_run_id": run.id,
                    "model_name": model_name,
                    "output_text": None,
                    "error": str(response),
                }
            )
        else:
            cost = None
            if not response.error and response.input_tokens is not None:
                cost = await compute_cost(
                    model_name=model_name,
                    input_tokens=response.input_tokens,
                    output_tokens=response.output_tokens,
                    db=db,
                )
            rr = await result_repo.create(
                {
                    "test_run_id": run.id,
                    "model_name": model_name,
                    "output_text": response.output_text,
                    "input_tokens": response.input_tokens,
                    "output_tokens": response.output_tokens,
                    "cost": cost,
                    "latency_ms": response.latency_ms,
                    "error": response.error,
                }
            )
        results.append(rr)

    # Always mark as completed — partial success (some models errored) is still completed
    run = await run_repo.update(run.id, {"status": "completed"})
    await db.commit()

    return run, results
