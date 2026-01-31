from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
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
from app.modules.scheduling.service import call_sheet_service
from app.schemas.call_sheets import CallSheet, CallSheetCreate, CallSheetUpdate

router = APIRouter()


@router.get("/", response_model=List[CallSheet], dependencies=[Depends(require_read_only)])
async def get_call_sheets(
    organization_id: UUID = Depends(get_organization_from_profile),
    profile=Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    project_id: UUID = None,
) -> List[CallSheet]:
    """
    Get all call sheets for the current user's organization.
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

    call_sheets = await call_sheet_service.get_multi(
        db=db,
        organization_id=organization_id,
        skip=skip,
        limit=limit,
        filters=filters,
        options=[
            selectinload(call_sheet_service.model.project).selectinload(call_sheet_service.model.project.property.mapper.class_.client)
        ]
    )
    return call_sheets


@router.post(
    "/",
    response_model=CallSheet,
    dependencies=[Depends(require_owner_admin_or_producer), Depends(require_billing_active)]
)
async def create_call_sheet(
    call_sheet_in: CallSheetCreate,
    organization_id: UUID = Depends(get_organization_from_profile),
    profile=Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
) -> CallSheet:
    """
    Create a new call sheet in the current user's organization.
    Validates project ownership.
    """
    try:
        call_sheet = await call_sheet_service.create(
            db=db,
            organization_id=organization_id,
            obj_in=call_sheet_in
        )
        # Fetch with relationships for response
        return await call_sheet_service.get(
            db=db,
            organization_id=organization_id,
            id=call_sheet.id,
            options=[
                selectinload(call_sheet_service.model.project).selectinload(call_sheet_service.model.project.property.mapper.class_.client)
            ]
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/{call_sheet_id}", response_model=CallSheet, dependencies=[Depends(require_read_only)])
async def get_call_sheet(
    call_sheet_id: UUID,
    organization_id: UUID = Depends(get_organization_from_profile),
    db: AsyncSession = Depends(get_db),
) -> CallSheet:
    """
    Get call sheet by ID (must belong to current user's organization).
    """
    call_sheet = await call_sheet_service.get(
        db=db,
        organization_id=organization_id,
        id=call_sheet_id,
        options=[
            selectinload(call_sheet_service.model.project).selectinload(call_sheet_service.model.project.property.mapper.class_.client)
        ]
    )

    if not call_sheet:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Call sheet not found"
        )

    await enforce_project_assignment(call_sheet.project_id, db, profile)

    return call_sheet


@router.put(
    "/{call_sheet_id}",
    response_model=CallSheet,
    dependencies=[Depends(require_owner_admin_or_producer), Depends(require_billing_active)]
)
async def update_call_sheet(
    call_sheet_id: UUID,
    call_sheet_in: CallSheetUpdate,
    organization_id: UUID = Depends(get_organization_from_profile),
    db: AsyncSession = Depends(get_db),
) -> CallSheet:
    """
    Update call sheet (must belong to current user's organization).
    Validates project ownership if project_id is being changed.
    """
    try:
        call_sheet = await call_sheet_service.update(
            db=db,
            organization_id=organization_id,
            id=call_sheet_id,
            obj_in=call_sheet_in
        )

        call_sheet = await call_sheet_service.get(
            db=db,
            organization_id=organization_id,
            id=call_sheet_id,
            options=[
                selectinload(call_sheet_service.model.project).selectinload(call_sheet_service.model.project.property.mapper.class_.client)
            ]
        )

        if not call_sheet:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Call sheet not found"
            )

        return call_sheet
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.delete(
    "/{call_sheet_id}",
    response_model=CallSheet,
    dependencies=[Depends(require_owner_admin_or_producer), Depends(require_billing_active)]
)
async def delete_call_sheet(
    call_sheet_id: UUID,
    organization_id: UUID = Depends(get_organization_from_profile),
    db: AsyncSession = Depends(get_db),
) -> CallSheet:
    """
    Delete call sheet (must belong to current user's organization).
    """
    # Fetch first with relationships to return valid response
    call_sheet = await call_sheet_service.get(
        db=db,
        organization_id=organization_id,
        id=call_sheet_id,
        options=[
            selectinload(call_sheet_service.model.project).selectinload(call_sheet_service.model.project.property.mapper.class_.client)
        ]
    )

    if not call_sheet:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Call sheet not found"
        )

    await call_sheet_service.remove(
        db=db,
        organization_id=organization_id,
        id=call_sheet_id
    )

    return call_sheet
