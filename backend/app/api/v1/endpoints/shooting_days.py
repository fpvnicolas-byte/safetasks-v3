from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import (
    get_organization_from_profile,
    require_read_only,
    require_owner_admin_or_producer,
    get_current_profile,
    get_effective_role,
    get_assigned_project_ids,
    enforce_project_assignment,
    require_billing_active,
)
from app.db.session import get_db
from app.services.production import shooting_day_service, production_service
from app.schemas.production import ShootingDay, ShootingDayCreate, ShootingDayUpdate

router = APIRouter()


@router.get("/", response_model=List[ShootingDay], dependencies=[Depends(require_read_only)])
async def get_shooting_days(
    organization_id: UUID = Depends(get_organization_from_profile),
    profile=Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    project_id: UUID = None,
) -> List[ShootingDay]:
    """
    Get all shooting days for the current user's organization.
    """
    filters = {}
    if project_id:
        await enforce_project_assignment(project_id, db, profile)
        filters["project_id"] = project_id
    elif get_effective_role(profile) == "freelancer":
        assigned_project_ids = await get_assigned_project_ids(db, profile)
        if not assigned_project_ids:
            return []
        filters["project_id"] = assigned_project_ids

    shooting_days = await shooting_day_service.get_multi(
        db=db,
        organization_id=organization_id,
        skip=skip,
        limit=limit,
        filters=filters,
        options=[
            selectinload(shooting_day_service.model.project).selectinload(shooting_day_service.model.project.property.mapper.class_.client)
        ]
    )
    return shooting_days


@router.post(
    "/",
    response_model=ShootingDay,
    dependencies=[Depends(require_owner_admin_or_producer), Depends(require_billing_active)]
)
async def create_shooting_day(
    shooting_day_in: ShootingDayCreate,
    organization_id: UUID = Depends(get_organization_from_profile),
    profile=Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
) -> ShootingDay:
    """
    Create a new shooting day in the current user's organization.
    Only admins and managers can create shooting days.
    """
    try:
        shooting_day = await shooting_day_service.create(
            db=db,
            organization_id=organization_id,
            obj_in=shooting_day_in
        )
        return shooting_day
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/{shooting_day_id}", response_model=ShootingDay, dependencies=[Depends(require_read_only)])
async def get_shooting_day(
    shooting_day_id: UUID,
    organization_id: UUID = Depends(get_organization_from_profile),
    db: AsyncSession = Depends(get_db),
) -> ShootingDay:
    """
    Get shooting day by ID (must belong to current user's organization).
    """
    shooting_day = await shooting_day_service.get(
        db=db,
        organization_id=organization_id,
        id=shooting_day_id
    )

    if not shooting_day:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shooting day not found"
        )

    await enforce_project_assignment(shooting_day.project_id, db, profile)

    return shooting_day


@router.put(
    "/{shooting_day_id}",
    response_model=ShootingDay,
    dependencies=[Depends(require_owner_admin_or_producer), Depends(require_billing_active)]
)
async def update_shooting_day(
    shooting_day_id: UUID,
    shooting_day_in: ShootingDayUpdate,
    organization_id: UUID = Depends(get_organization_from_profile),
    db: AsyncSession = Depends(get_db),
) -> ShootingDay:
    """
    Update shooting day (must belong to current user's organization).
    Only admins and managers can update shooting days.
    """
    try:
        shooting_day = await shooting_day_service.update(
            db=db,
            organization_id=organization_id,
            id=shooting_day_id,
            obj_in=shooting_day_in
        )

        if not shooting_day:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Shooting day not found"
            )

        return shooting_day
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.delete(
    "/{shooting_day_id}",
    response_model=ShootingDay,
    dependencies=[Depends(require_owner_admin_or_producer), Depends(require_billing_active)]
)
async def delete_shooting_day(
    shooting_day_id: UUID,
    organization_id: UUID = Depends(get_organization_from_profile),
    db: AsyncSession = Depends(get_db),
) -> ShootingDay:
    """
    Delete shooting day (must belong to current user's organization).
    Only admins and managers can delete shooting days.
    """
    shooting_day = await shooting_day_service.remove(
        db=db,
        organization_id=organization_id,
        id=shooting_day_id
    )

    if not shooting_day:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shooting day not found"
        )

    return shooting_day


@router.post(
    "/{shooting_day_id}/assign-scenes",
    dependencies=[Depends(require_owner_admin_or_producer), Depends(require_billing_active)]
)
async def assign_scenes_to_shooting_day(
    shooting_day_id: UUID,
    scene_ids: List[UUID],
    organization_id: UUID = Depends(get_organization_from_profile),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Assign multiple scenes to a shooting day.
    Only admins and managers can assign scenes.
    """
    try:
        result = await production_service.assign_scenes_to_shooting_day(
            db=db,
            organization_id=organization_id,
            shooting_day_id=shooting_day_id,
            scene_ids=scene_ids
        )
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
