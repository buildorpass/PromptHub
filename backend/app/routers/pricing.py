from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.repositories.sqlite import SQLitePricingRepository
from app.schemas.pricing import PricingCreate, PricingUpdate, PricingResponse
from app.schemas import PaginatedResponse

router = APIRouter(prefix="/pricing", tags=["pricing"])


@router.get("/", response_model=PaginatedResponse[PricingResponse])
async def list_pricing(
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    repo = SQLitePricingRepository(db)
    skip = (page - 1) * page_size
    items = await repo.list(skip=skip, limit=page_size)
    total = await repo.count()
    return PaginatedResponse(
        total=total,
        items=items,
        page=page,
        page_size=page_size,
    )


@router.post("/", response_model=PricingResponse, status_code=201)
async def create_pricing(
    body: PricingCreate,
    db: AsyncSession = Depends(get_db),
):
    repo = SQLitePricingRepository(db)
    pricing = await repo.create(body.model_dump())
    await db.commit()
    return pricing


@router.put("/{id}", response_model=PricingResponse)
async def update_pricing(
    id: int,
    body: PricingUpdate,
    db: AsyncSession = Depends(get_db),
):
    repo = SQLitePricingRepository(db)
    pricing = await repo.update(id, body.model_dump(exclude_none=True))
    if pricing is None:
        raise HTTPException(
            status_code=404,
            detail={"detail": "Pricing entry not found", "code": "PRICING_NOT_FOUND"},
        )
    await db.commit()
    return pricing


@router.delete("/{id}", status_code=204)
async def delete_pricing(id: int, db: AsyncSession = Depends(get_db)):
    repo = SQLitePricingRepository(db)
    deleted = await repo.delete(id)
    if not deleted:
        raise HTTPException(
            status_code=404,
            detail={"detail": "Pricing entry not found", "code": "PRICING_NOT_FOUND"},
        )
    await db.commit()
