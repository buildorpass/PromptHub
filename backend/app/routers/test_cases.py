import json
import logging
import re
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.repositories.sqlite import (
    SQLiteTestCaseRepository,
    SQLiteVersionRepository,
    SQLiteRunRepository,
    SQLiteRunResultRepository,
)
from app.schemas.test_cases import (
    TestCaseCreate,
    TestCaseUpdate,
    TestCaseResponse,
    TestCaseRunRequest,
    TestCaseHistoryItem,
)
from app.schemas.runs import RunResponse, RunResultResponse
from app.schemas import PaginatedResponse
from app.services.runner import run_fan_out

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/test-cases", tags=["test-cases"])


def _evaluate_assertion(
    assertion_type: str | None,
    assertion_value: str | None,
    output_text: str | None,
) -> bool | None:
    """
    Evaluate a test assertion against model output.
    Returns True/False, or None if manual review is required or output is missing.
    """
    if not assertion_type or assertion_type == "manual":
        return None
    if output_text is None:
        return None
    if assertion_value is None:
        return None

    if assertion_type == "exact":
        return output_text.strip() == assertion_value.strip()
    elif assertion_type == "contains":
        return assertion_value in output_text
    elif assertion_type == "regex":
        return bool(re.search(assertion_value, output_text))

    return None


@router.get("/", response_model=PaginatedResponse[TestCaseResponse])
async def list_test_cases(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    prompt_version_id: int = Query(None),
    db: AsyncSession = Depends(get_db),
):
    repo = SQLiteTestCaseRepository(db)
    skip = (page - 1) * page_size
    filters = {}
    if prompt_version_id is not None:
        filters["prompt_version_id"] = prompt_version_id
    items = await repo.list(skip=skip, limit=page_size, **filters)
    total = await repo.count(**filters)
    return PaginatedResponse(
        total=total,
        items=items,
        page=page,
        page_size=page_size,
    )


@router.post("/", response_model=TestCaseResponse, status_code=201)
async def create_test_case(
    body: TestCaseCreate,
    db: AsyncSession = Depends(get_db),
):
    version_repo = SQLiteVersionRepository(db)
    version = await version_repo.get(body.prompt_version_id)
    if version is None:
        raise HTTPException(
            status_code=404,
            detail={"detail": "Prompt version not found", "code": "VERSION_NOT_FOUND"},
        )
    repo = SQLiteTestCaseRepository(db)
    data = body.model_dump()
    if isinstance(data.get("variable_inputs"), dict):
        data["variable_inputs"] = json.dumps(data["variable_inputs"])
    tc = await repo.create(data)
    await db.commit()
    return tc


@router.get("/{id}", response_model=TestCaseResponse)
async def get_test_case(id: int, db: AsyncSession = Depends(get_db)):
    repo = SQLiteTestCaseRepository(db)
    tc = await repo.get(id)
    if tc is None:
        raise HTTPException(
            status_code=404,
            detail={"detail": "Test case not found", "code": "TEST_CASE_NOT_FOUND"},
        )
    return tc


@router.put("/{id}", response_model=TestCaseResponse)
async def update_test_case(
    id: int,
    body: TestCaseUpdate,
    db: AsyncSession = Depends(get_db),
):
    repo = SQLiteTestCaseRepository(db)
    data = body.model_dump(exclude_none=True)
    if "variable_inputs" in data and isinstance(data["variable_inputs"], dict):
        data["variable_inputs"] = json.dumps(data["variable_inputs"])
    tc = await repo.update(id, data)
    if tc is None:
        raise HTTPException(
            status_code=404,
            detail={"detail": "Test case not found", "code": "TEST_CASE_NOT_FOUND"},
        )
    await db.commit()
    return tc


@router.delete("/{id}", status_code=204)
async def delete_test_case(id: int, db: AsyncSession = Depends(get_db)):
    repo = SQLiteTestCaseRepository(db)
    deleted = await repo.delete(id)
    if not deleted:
        raise HTTPException(
            status_code=404,
            detail={"detail": "Test case not found", "code": "TEST_CASE_NOT_FOUND"},
        )
    await db.commit()


@router.post("/{id}/run", response_model=RunResponse, status_code=201)
async def run_test_case(
    id: int,
    body: TestCaseRunRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Execute a test case against one or more models concurrently.
    Evaluates assertions (exact/contains/regex) on each result and stores pass/fail.
    """
    tc_repo = SQLiteTestCaseRepository(db)
    tc = await tc_repo.get(id)
    if tc is None:
        raise HTTPException(
            status_code=404,
            detail={"detail": "Test case not found", "code": "TEST_CASE_NOT_FOUND"},
        )

    # Parse variable_inputs from JSON string stored in DB
    variable_inputs = None
    if tc.variable_inputs:
        try:
            variable_inputs = json.loads(tc.variable_inputs)
        except (json.JSONDecodeError, ValueError):
            variable_inputs = None

    try:
        run, results = await run_fan_out(
            prompt_version_id=tc.prompt_version_id,
            model_names=body.model_names,
            variable_inputs=variable_inputs,
            db=db,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail={"detail": str(exc), "code": "RUN_FAILED"},
        )

    # Evaluate assertions and update each RunResult with passed value
    result_repo = SQLiteRunResultRepository(db)
    updated_results = []
    for rr in results:
        passed = _evaluate_assertion(
            tc.assertion_type,
            tc.assertion_value,
            rr.output_text,
        )
        updated = await result_repo.update(rr.id, {"passed": passed})
        updated_results.append(updated if updated is not None else rr)
    await db.commit()

    return RunResponse(
        id=run.id,
        prompt_version_id=run.prompt_version_id,
        status=run.status,
        created_at=run.created_at,
        results=[RunResultResponse.model_validate(r) for r in updated_results],
    )


@router.get("/{id}/history", response_model=List[TestCaseHistoryItem])
async def get_test_case_history(
    id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """
    List all TestRuns for this test case (via prompt_version_id lookup).
    Returns a summary per run: model count, pass count, fail count.
    """
    tc_repo = SQLiteTestCaseRepository(db)
    tc = await tc_repo.get(id)
    if tc is None:
        raise HTTPException(
            status_code=404,
            detail={"detail": "Test case not found", "code": "TEST_CASE_NOT_FOUND"},
        )

    run_repo = SQLiteRunRepository(db)
    result_repo = SQLiteRunResultRepository(db)

    skip = (page - 1) * page_size
    runs = await run_repo.list(skip=skip, limit=page_size, prompt_version_id=tc.prompt_version_id)

    history = []
    for run in runs:
        run_results = await result_repo.list_for_run(run.id)
        model_count = len(run_results)
        pass_count = sum(1 for r in run_results if r.passed is True)
        fail_count = sum(1 for r in run_results if r.passed is False)
        history.append(
            TestCaseHistoryItem(
                id=run.id,
                created_at=run.created_at,
                status=run.status,
                model_count=model_count,
                pass_count=pass_count,
                fail_count=fail_count,
            )
        )
    return history


@router.get("/{id}/history/{run_id}", response_model=RunResponse)
async def get_test_case_run_detail(
    id: int,
    run_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Full run detail with all RunResults (output, tokens, cost, latency, passed, error).
    """
    tc_repo = SQLiteTestCaseRepository(db)
    tc = await tc_repo.get(id)
    if tc is None:
        raise HTTPException(
            status_code=404,
            detail={"detail": "Test case not found", "code": "TEST_CASE_NOT_FOUND"},
        )

    run_repo = SQLiteRunRepository(db)
    run = await run_repo.get(run_id)
    if run is None:
        raise HTTPException(
            status_code=404,
            detail={"detail": "Run not found", "code": "RUN_NOT_FOUND"},
        )

    # Verify this run belongs to the test case's prompt version
    if run.prompt_version_id != tc.prompt_version_id:
        raise HTTPException(
            status_code=404,
            detail={"detail": "Run not found for this test case", "code": "RUN_NOT_FOUND"},
        )

    result_repo = SQLiteRunResultRepository(db)
    results = await result_repo.list_for_run(run.id)
    return RunResponse(
        id=run.id,
        prompt_version_id=run.prompt_version_id,
        status=run.status,
        created_at=run.created_at,
        results=[RunResultResponse.model_validate(r) for r in results],
    )
