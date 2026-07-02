from typing import Optional, List, Any, Dict

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.repositories.sqlite import SQLiteFolderRepository
from app.schemas.folders import FolderCreate, FolderUpdate, FolderResponse
from app.schemas import PaginatedResponse

router = APIRouter(prefix="/folders", tags=["folders"])


@router.get("/", response_model=PaginatedResponse[FolderResponse])
async def list_folders(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    parent_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    repo = SQLiteFolderRepository(db)
    skip = (page - 1) * page_size
    filters = {}
    if parent_id is not None:
        filters["parent_id"] = parent_id
    items = await repo.list(skip=skip, limit=page_size, **filters)
    total = await repo.count(**filters)
    return PaginatedResponse(
        total=total,
        items=items,
        page=page,
        page_size=page_size,
    )


@router.post("/", response_model=FolderResponse, status_code=201)
async def create_folder(
    body: FolderCreate,
    db: AsyncSession = Depends(get_db),
):
    repo = SQLiteFolderRepository(db)
    if body.parent_id is not None:
        parent = await repo.get(body.parent_id)
        if parent is None:
            raise HTTPException(
                status_code=404,
                detail={"detail": "Parent folder not found", "code": "FOLDER_NOT_FOUND"},
            )
    folder = await repo.create(body.model_dump())
    await db.commit()
    return folder


@router.get("/tree", tags=["folders"])
async def get_folder_tree(db: AsyncSession = Depends(get_db)):
    """
    Return the full folder hierarchy as nested JSON.
    Each node includes id, name, team_shared, children list, and prompt_count.
    """
    from app.models.orm import Folder, Prompt

    # Load all folders
    stmt = select(Folder)
    result = await db.execute(stmt)
    all_folders = list(result.scalars().all())

    # Count prompts per folder
    count_stmt = select(Prompt.folder_id, func.count(Prompt.id)).group_by(Prompt.folder_id)
    count_result = await db.execute(count_stmt)
    prompt_counts: Dict[Any, int] = {row[0]: row[1] for row in count_result.all()}

    # Build a dict of nodes
    folder_nodes: Dict[int, dict] = {
        f.id: {
            "id": f.id,
            "name": f.name,
            "team_shared": f.team_shared,
            "children": [],
            "prompt_count": prompt_counts.get(f.id, 0),
        }
        for f in all_folders
    }

    # Assemble tree — roots have parent_id=None
    roots: List[dict] = []
    for f in all_folders:
        node = folder_nodes[f.id]
        if f.parent_id is None:
            roots.append(node)
        else:
            parent = folder_nodes.get(f.parent_id)
            if parent is not None:
                parent["children"].append(node)

    return roots


@router.get("/{id}", response_model=FolderResponse)
async def get_folder(id: int, db: AsyncSession = Depends(get_db)):
    repo = SQLiteFolderRepository(db)
    folder = await repo.get(id)
    if folder is None:
        raise HTTPException(
            status_code=404,
            detail={"detail": "Folder not found", "code": "FOLDER_NOT_FOUND"},
        )
    return folder


@router.put("/{id}", response_model=FolderResponse)
async def update_folder(
    id: int,
    body: FolderUpdate,
    db: AsyncSession = Depends(get_db),
):
    repo = SQLiteFolderRepository(db)
    folder = await repo.update(id, body.model_dump(exclude_none=True))
    if folder is None:
        raise HTTPException(
            status_code=404,
            detail={"detail": "Folder not found", "code": "FOLDER_NOT_FOUND"},
        )
    await db.commit()
    return folder


@router.delete("/{id}", status_code=204)
async def delete_folder(id: int, db: AsyncSession = Depends(get_db)):
    repo = SQLiteFolderRepository(db)
    deleted = await repo.delete(id)
    if not deleted:
        raise HTTPException(
            status_code=404,
            detail={"detail": "Folder not found", "code": "FOLDER_NOT_FOUND"},
        )
    await db.commit()
