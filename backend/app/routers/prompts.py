import json
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.repositories.sqlite import SQLitePromptRepository, SQLiteVersionRepository
from app.schemas.prompts import PromptCreate, PromptUpdate, PromptResponse
from app.schemas import PaginatedResponse

router = APIRouter(prefix="/prompts", tags=["prompts"])


async def _enrich_prompt(prompt, version_repo: SQLiteVersionRepository) -> dict:
    """Add latest_version_number to a prompt dict."""
    latest = await version_repo.get_latest(prompt.id)
    data = {
        "id": prompt.id,
        "name": prompt.name,
        "description": prompt.description,
        "folder_id": prompt.folder_id,
        "owner": prompt.owner,
        "tags": prompt.tags,
        "created_at": prompt.created_at,
        "updated_at": prompt.updated_at,
        "latest_version_number": latest.version_number if latest else None,
    }
    return data


@router.get("/", response_model=PaginatedResponse[PromptResponse])
async def list_prompts(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    folder_id: Optional[int] = Query(None),
    tags: Optional[str] = Query(None, description="Comma-separated tag list"),
    db: AsyncSession = Depends(get_db),
):
    prompt_repo = SQLitePromptRepository(db)
    version_repo = SQLiteVersionRepository(db)

    tag_list: Optional[List[str]] = None
    if tags:
        tag_list = [t.strip() for t in tags.split(",") if t.strip()]

    if search or tag_list:
        items = await prompt_repo.search(
            query=search or "",
            folder_id=folder_id,
            tags=tag_list,
        )
        total = len(items)
        skip = (page - 1) * page_size
        items = items[skip : skip + page_size]
    else:
        skip = (page - 1) * page_size
        filters = {}
        if folder_id is not None:
            filters["folder_id"] = folder_id
        items = await prompt_repo.list(skip=skip, limit=page_size, **filters)
        total = await prompt_repo.count(**filters)

    enriched = []
    for p in items:
        enriched.append(await _enrich_prompt(p, version_repo))

    return PaginatedResponse(
        total=total,
        items=enriched,
        page=page,
        page_size=page_size,
    )


@router.post("/", response_model=PromptResponse, status_code=201)
async def create_prompt(
    body: PromptCreate,
    db: AsyncSession = Depends(get_db),
):
    prompt_repo = SQLitePromptRepository(db)
    version_repo = SQLiteVersionRepository(db)

    # Create prompt
    tags_value = json.dumps(body.tags) if body.tags else None
    prompt = await prompt_repo.create(
        {
            "name": body.name,
            "description": body.description,
            "folder_id": body.folder_id,
            "owner": body.owner,
            "tags": tags_value,
        }
    )

    # Create first version atomically
    variables_value = body.variables
    if isinstance(variables_value, dict):
        variables_value = json.dumps(variables_value)

    await version_repo.create(
        {
            "prompt_id": prompt.id,
            "version_number": 1,
            "content": body.content,
            "system_prompt": body.system_prompt,
            "variables": variables_value,
            "commit_message": body.commit_message,
            "author": body.author,
        }
    )

    await db.commit()

    data = await _enrich_prompt(prompt, version_repo)
    return PromptResponse.model_validate(data)


@router.get("/tags", tags=["prompts"])
async def list_tags(db: AsyncSession = Depends(get_db)):
    """
    Return a sorted list of all unique tags across all prompts.
    Parses the JSON tags field from each prompt and deduplicates.
    """
    from sqlalchemy import select
    from app.models.orm import Prompt

    stmt = select(Prompt.tags).where(Prompt.tags.is_not(None))
    result = await db.execute(stmt)
    all_tags: set[str] = set()
    for (tags_str,) in result.all():
        if not tags_str:
            continue
        try:
            parsed = json.loads(tags_str)
            if isinstance(parsed, list):
                all_tags.update(str(t) for t in parsed if t)
        except (json.JSONDecodeError, ValueError):
            pass
    return sorted(all_tags)


@router.get("/{id}", response_model=PromptResponse)
async def get_prompt(id: int, db: AsyncSession = Depends(get_db)):
    prompt_repo = SQLitePromptRepository(db)
    version_repo = SQLiteVersionRepository(db)
    prompt = await prompt_repo.get(id)
    if prompt is None:
        raise HTTPException(
            status_code=404,
            detail={"detail": "Prompt not found", "code": "PROMPT_NOT_FOUND"},
        )
    data = await _enrich_prompt(prompt, version_repo)
    return PromptResponse.model_validate(data)


@router.put("/{id}", response_model=PromptResponse)
async def update_prompt(
    id: int,
    body: PromptUpdate,
    db: AsyncSession = Depends(get_db),
):
    prompt_repo = SQLitePromptRepository(db)
    version_repo = SQLiteVersionRepository(db)

    update_data = body.model_dump(exclude_none=True)
    prompt = await prompt_repo.update(id, update_data)
    if prompt is None:
        raise HTTPException(
            status_code=404,
            detail={"detail": "Prompt not found", "code": "PROMPT_NOT_FOUND"},
        )
    await db.commit()
    data = await _enrich_prompt(prompt, version_repo)
    return PromptResponse.model_validate(data)


@router.delete("/{id}", status_code=204)
async def delete_prompt(id: int, db: AsyncSession = Depends(get_db)):
    prompt_repo = SQLitePromptRepository(db)
    deleted = await prompt_repo.delete(id)
    if not deleted:
        raise HTTPException(
            status_code=404,
            detail={"detail": "Prompt not found", "code": "PROMPT_NOT_FOUND"},
        )
    await db.commit()
