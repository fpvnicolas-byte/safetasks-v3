from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_organization_from_profile
from app.db.session import get_db
from app.modules.inventory.service import kit_service
from app.schemas.kits import Kit, KitCreate, KitUpdate

router = APIRouter()


@router.get("/", response_model=List[Kit])
async def get_kits(
    organization_id: UUID = Depends(get_organization_from_profile),
    db: AsyncSession = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
) -> List[Kit]:
    """
    Get all kits for the current user's organization.
    """
    kits = await kit_service.get_multi(
        db=db,
        organization_id=organization_id,
        skip=skip,
        limit=limit
    )
    return kits


@router.post("/", response_model=Kit)
async def create_kit(
    kit_in: KitCreate,
    organization_id: UUID = Depends(get_organization_from_profile),
    db: AsyncSession = Depends(get_db),
) -> Kit:
    """
    Create a new kit in the current user's organization.
    """
    kit = await kit_service.create(
        db=db,
        organization_id=organization_id,
        obj_in=kit_in
    )
    return kit


@router.get("/{kit_id}", response_model=Kit)
async def get_kit(
    kit_id: UUID,
    organization_id: UUID = Depends(get_organization_from_profile),
    db: AsyncSession = Depends(get_db),
) -> Kit:
    """
    Get kit by ID (must belong to current user's organization).
    """
    kit = await kit_service.get(
        db=db,
        organization_id=organization_id,
        id=kit_id
    )

    if not kit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Kit not found"
        )

    return kit


@router.put("/{kit_id}", response_model=Kit)
async def update_kit(
    kit_id: UUID,
    kit_in: KitUpdate,
    organization_id: UUID = Depends(get_organization_from_profile),
    db: AsyncSession = Depends(get_db),
) -> Kit:
    """
    Update kit (must belong to current user's organization).
    """
    kit = await kit_service.update(
        db=db,
        organization_id=organization_id,
        id=kit_id,
        obj_in=kit_in
    )

    if not kit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Kit not found"
        )

    return kit


@router.delete("/{kit_id}", response_model=Kit)
async def delete_kit(
    kit_id: UUID,
    organization_id: UUID = Depends(get_organization_from_profile),
    db: AsyncSession = Depends(get_db),
) -> Kit:
    """
    Delete kit (must belong to current user's organization).
    Equipment items are preserved (not deleted).
    """
    kit = await kit_service.remove(
        db=db,
        organization_id=organization_id,
        id=kit_id
    )

    if not kit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Kit not found"
        )

    return kit
