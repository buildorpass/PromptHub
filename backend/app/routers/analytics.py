"""
Analytics endpoints — read-only aggregations over run data.
No repository abstraction; queries directly via SQLAlchemy session.
"""
import logging
from typing import List

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.orm import Prompt, PromptVersion, TestRun, RunResult, ModelPricing
from app.schemas.analytics import (
    CostByModelItem,
    CostByPromptItem,
    EfficiencyItem,
    RecentRunItem,
    AnalyticsSummary,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/cost-by-model", response_model=List[CostByModelItem])
async def cost_by_model(db: AsyncSession = Depends(get_db)):
    """Aggregate cost and token usage grouped by model name."""
    stmt = (
        select(
            RunResult.model_name,
            ModelPricing.provider,
            func.count(RunResult.id).label("total_runs"),
            func.coalesce(func.sum(RunResult.input_tokens), 0).label("total_input_tokens"),
            func.coalesce(func.sum(RunResult.output_tokens), 0).label("total_output_tokens"),
            func.coalesce(func.sum(RunResult.cost), 0.0).label("total_cost"),
            func.coalesce(func.avg(RunResult.cost), 0.0).label("avg_cost_per_run"),
            func.coalesce(func.avg(RunResult.latency_ms), 0.0).label("avg_latency_ms"),
        )
        .select_from(RunResult)
        .outerjoin(ModelPricing, ModelPricing.model_name == RunResult.model_name)
        .where(RunResult.error.is_(None))
        .group_by(RunResult.model_name, ModelPricing.provider)
    )
    result = await db.execute(stmt)
    rows = result.all()
    return [
        CostByModelItem(
            model_name=row.model_name,
            provider=row.provider,
            total_runs=row.total_runs,
            total_input_tokens=row.total_input_tokens,
            total_output_tokens=row.total_output_tokens,
            total_cost=row.total_cost,
            avg_cost_per_run=row.avg_cost_per_run,
            avg_latency_ms=row.avg_latency_ms,
        )
        for row in rows
    ]


@router.get("/cost-by-prompt", response_model=List[CostByPromptItem])
async def cost_by_prompt(db: AsyncSession = Depends(get_db)):
    """Aggregate cost and run counts grouped by prompt."""
    stmt = (
        select(
            Prompt.id.label("prompt_id"),
            Prompt.name.label("prompt_name"),
            func.count(func.distinct(PromptVersion.id)).label("version_count"),
            func.count(RunResult.id).label("total_runs"),
            func.coalesce(func.sum(RunResult.cost), 0.0).label("total_cost"),
        )
        .select_from(Prompt)
        .outerjoin(PromptVersion, PromptVersion.prompt_id == Prompt.id)
        .outerjoin(TestRun, TestRun.prompt_version_id == PromptVersion.id)
        .outerjoin(RunResult, RunResult.test_run_id == TestRun.id)
        .group_by(Prompt.id, Prompt.name)
        .order_by(func.coalesce(func.sum(RunResult.cost), 0.0).desc())
    )
    result = await db.execute(stmt)
    rows = result.all()
    return [
        CostByPromptItem(
            prompt_id=row.prompt_id,
            prompt_name=row.prompt_name,
            version_count=row.version_count,
            total_runs=row.total_runs,
            total_cost=row.total_cost,
        )
        for row in rows
    ]


@router.get("/efficiency", response_model=List[EfficiencyItem])
async def efficiency(db: AsyncSession = Depends(get_db)):
    """
    Per-model efficiency stats: latency, cost, and rating.
    Sorted by avg_cost_per_run ascending (cheapest first).
    Only includes results where error IS NULL.
    """
    stmt = (
        select(
            RunResult.model_name,
            ModelPricing.provider,
            func.coalesce(func.avg(RunResult.latency_ms), 0.0).label("avg_latency_ms"),
            func.coalesce(func.avg(RunResult.cost), 0.0).label("avg_cost_per_run"),
            func.avg(RunResult.rating).label("avg_rating"),
            func.count(RunResult.rating).label("total_rated"),
            func.count(RunResult.id).label("total_runs"),
        )
        .select_from(RunResult)
        .outerjoin(ModelPricing, ModelPricing.model_name == RunResult.model_name)
        .where(RunResult.error.is_(None))
        .group_by(RunResult.model_name, ModelPricing.provider)
        .order_by(func.coalesce(func.avg(RunResult.cost), 0.0).asc())
    )
    result = await db.execute(stmt)
    rows = result.all()
    return [
        EfficiencyItem(
            model_name=row.model_name,
            provider=row.provider,
            avg_latency_ms=row.avg_latency_ms,
            avg_cost_per_run=row.avg_cost_per_run,
            avg_rating=row.avg_rating,
            total_rated=row.total_rated,
            total_runs=row.total_runs,
        )
        for row in rows
    ]


@router.get("/recent-runs", response_model=List[RecentRunItem])
async def recent_runs(
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Most recent run results joined across the full chain to prompt name."""
    stmt = (
        select(
            TestRun.id.label("run_id"),
            Prompt.name.label("prompt_name"),
            RunResult.model_name,
            RunResult.cost,
            RunResult.latency_ms,
            RunResult.rating,
            TestRun.status,
            RunResult.error,
            RunResult.created_at,
        )
        .select_from(RunResult)
        .join(TestRun, TestRun.id == RunResult.test_run_id)
        .join(PromptVersion, PromptVersion.id == TestRun.prompt_version_id)
        .join(Prompt, Prompt.id == PromptVersion.prompt_id)
        .order_by(RunResult.created_at.desc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    rows = result.all()
    return [
        RecentRunItem(
            run_id=row.run_id,
            prompt_name=row.prompt_name,
            model_name=row.model_name,
            cost=row.cost,
            latency_ms=row.latency_ms,
            rating=row.rating,
            status=row.status,
            error=row.error,
            created_at=row.created_at.isoformat() if row.created_at else "",
        )
        for row in rows
    ]


@router.get("/summary", response_model=AnalyticsSummary)
async def summary(db: AsyncSession = Depends(get_db)):
    """Quick dashboard stats: totals for prompts, runs, cost, and distinct models used."""
    total_prompts_result = await db.execute(
        select(func.count()).select_from(Prompt)
    )
    total_prompts = total_prompts_result.scalar_one()

    total_runs_result = await db.execute(
        select(func.count()).select_from(TestRun)
    )
    total_runs = total_runs_result.scalar_one()

    total_cost_result = await db.execute(
        select(func.coalesce(func.sum(RunResult.cost), 0.0)).select_from(RunResult)
    )
    total_cost = total_cost_result.scalar_one()

    total_models_result = await db.execute(
        select(func.count(func.distinct(RunResult.model_name))).select_from(RunResult)
    )
    total_models_used = total_models_result.scalar_one()

    return AnalyticsSummary(
        total_prompts=total_prompts,
        total_runs=total_runs,
        total_cost=float(total_cost),
        total_models_used=total_models_used,
    )
