import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.repositories.sqlite import (
    SQLiteVersionRepository,
    SQLiteRunRepository,
    SQLiteRunResultRepository,
)
from app.schemas.runs import RunCreate, RunResponse, RunResultResponse, RateResult
from app.schemas import PaginatedResponse
from app.services.runner import run_fan_out

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/runs", tags=["runs"])


@router.get("/", response_model=PaginatedResponse[RunResponse])
async def list_runs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Paginated list of recent test runs with their results."""
    run_repo = SQLiteRunRepository(db)
    result_repo = SQLiteRunResultRepository(db)
    skip = (page - 1) * page_size
    runs = await run_repo.list(skip=skip, limit=page_size)
    total = await run_repo.count()
    items = []
    for run in runs:
        results = await result_repo.list_for_run(run.id)
        items.append(
            RunResponse(
                id=run.id,
                prompt_version_id=run.prompt_version_id,
                status=run.status,
                created_at=run.created_at,
                results=[RunResultResponse.model_validate(r) for r in results],
            )
        )
    return PaginatedResponse(total=total, items=items, page=page, page_size=page_size)


@router.post("/", response_model=RunResponse, status_code=201)
async def create_run(
    body: RunCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Multi-model comparison fan-out.
    Accepts a list of model names and runs them all concurrently against the same
    resolved prompt. Returns a single TestRun with one RunResult per model.
    """
    version_repo = SQLiteVersionRepository(db)
    version = await version_repo.get(body.prompt_version_id)
    if version is None:
        raise HTTPException(
            status_code=404,
            detail={"detail": "Prompt version not found", "code": "VERSION_NOT_FOUND"},
        )

    try:
        run, results = await run_fan_out(
            prompt_version_id=body.prompt_version_id,
            model_names=body.model_names,
            variable_inputs=body.variable_inputs,
            db=db,
            max_tokens=body.max_tokens,
            temperature=body.temperature,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail={"detail": str(exc), "code": "RUN_FAILED"},
        )

    return RunResponse(
        id=run.id,
        prompt_version_id=run.prompt_version_id,
        status=run.status,
        created_at=run.created_at,
        results=[RunResultResponse.model_validate(r) for r in results],
    )


@router.get("/{run_id}", response_model=RunResponse)
async def get_run(run_id: int, db: AsyncSession = Depends(get_db)):
    run_repo = SQLiteRunRepository(db)
    result_repo = SQLiteRunResultRepository(db)

    run = await run_repo.get(run_id)
    if run is None:
        raise HTTPException(
            status_code=404,
            detail={"detail": "Run not found", "code": "RUN_NOT_FOUND"},
        )

    results = await result_repo.list_for_run(run.id)
    return RunResponse(
        id=run.id,
        prompt_version_id=run.prompt_version_id,
        status=run.status,
        created_at=run.created_at,
        results=[RunResultResponse.model_validate(r) for r in results],
    )


@router.post("/results/{result_id}/rate", response_model=RunResultResponse)
async def rate_result(
    result_id: int,
    body: RateResult,
    db: AsyncSession = Depends(get_db),
):
    if not (1 <= body.rating <= 5):
        raise HTTPException(
            status_code=422,
            detail={"detail": "Rating must be between 1 and 5", "code": "INVALID_RATING"},
        )

    result_repo = SQLiteRunResultRepository(db)
    result = await result_repo.update_rating(result_id, body.rating, body.tag)
    if result is None:
        raise HTTPException(
            status_code=404,
            detail={"detail": "Run result not found", "code": "RESULT_NOT_FOUND"},
        )
    await db.commit()
    return RunResultResponse.model_validate(result)
