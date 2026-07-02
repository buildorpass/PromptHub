from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.repositories.sqlite import SQLiteAssetRepository
from app.schemas.assets import AssetCreate, AssetUpdate, AssetResponse
from app.schemas import PaginatedResponse

router = APIRouter(prefix="/assets", tags=["assets"])


@router.get("/", response_model=PaginatedResponse[AssetResponse])
async def list_assets(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    type: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    repo = SQLiteAssetRepository(db)
    if search:
        items = await repo.search(query=search, asset_type=type)
        total = len(items)
        skip = (page - 1) * page_size
        items = items[skip : skip + page_size]
    else:
        skip = (page - 1) * page_size
        filters = {}
        if type:
            filters["type"] = type
        items = await repo.list(skip=skip, limit=page_size, **filters)
        total = await repo.count(**filters)

    return PaginatedResponse(
        total=total,
        items=items,
        page=page,
        page_size=page_size,
    )


@router.post("/", response_model=AssetResponse, status_code=201)
async def create_asset(
    body: AssetCreate,
    db: AsyncSession = Depends(get_db),
):
    repo = SQLiteAssetRepository(db)
    # Check for name uniqueness
    existing = await repo.get_by_name(body.name)
    if existing:
        raise HTTPException(
            status_code=409,
            detail={"detail": f"Asset with name '{body.name}' already exists", "code": "ASSET_NAME_CONFLICT"},
        )
    asset = await repo.create(body.model_dump())
    await db.commit()
    return asset


@router.get("/{id}", response_model=AssetResponse)
async def get_asset(id: int, db: AsyncSession = Depends(get_db)):
    repo = SQLiteAssetRepository(db)
    asset = await repo.get(id)
    if asset is None:
        raise HTTPException(
            status_code=404,
            detail={"detail": "Asset not found", "code": "ASSET_NOT_FOUND"},
        )
    return asset


@router.put("/{id}", response_model=AssetResponse)
async def update_asset(
    id: int,
    body: AssetUpdate,
    db: AsyncSession = Depends(get_db),
):
    repo = SQLiteAssetRepository(db)
    asset = await repo.update(id, body.model_dump(exclude_none=True))
    if asset is None:
        raise HTTPException(
            status_code=404,
            detail={"detail": "Asset not found", "code": "ASSET_NOT_FOUND"},
        )
    await db.commit()
    return asset


@router.delete("/{id}", status_code=204)
async def delete_asset(id: int, db: AsyncSession = Depends(get_db)):
    repo = SQLiteAssetRepository(db)
    deleted = await repo.delete(id)
    if not deleted:
        raise HTTPException(
            status_code=404,
            detail={"detail": "Asset not found", "code": "ASSET_NOT_FOUND"},
        )
    await db.commit()
