from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_organization, require_admin_manager_or_crew, require_admin_or_manager
from app.db.session import get_db
from app.modules.scheduling.service import call_sheet_service
from app.schemas.call_sheets import CallSheet, CallSheetCreate, CallSheetUpdate

router = APIRouter()


@router.get("/", response_model=List[CallSheet])
async def get_call_sheets(
    organization_id: UUID = Depends(get_current_organization),
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
        filters["project_id"] = project_id

    call_sheets = await call_sheet_service.get_multi(
        db=db,
        organization_id=organization_id,
        skip=skip,
        limit=limit,
        filters=filters
    )
    return call_sheets


@router.post("/", response_model=CallSheet, dependencies=[Depends(require_admin_or_manager)])
async def create_call_sheet(
    call_sheet_in: CallSheetCreate,
    organization_id: UUID = Depends(get_current_organization),
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
        return call_sheet
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/{call_sheet_id}", response_model=CallSheet)
async def get_call_sheet(
    call_sheet_id: UUID,
    organization_id: UUID = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
) -> CallSheet:
    """
    Get call sheet by ID (must belong to current user's organization).
    """
    call_sheet = await call_sheet_service.get(
        db=db,
        organization_id=organization_id,
        id=call_sheet_id
    )

    if not call_sheet:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Call sheet not found"
        )

    return call_sheet


@router.put("/{call_sheet_id}", response_model=CallSheet, dependencies=[Depends(require_admin_or_manager)])
async def update_call_sheet(
    call_sheet_id: UUID,
    call_sheet_in: CallSheetUpdate,
    organization_id: UUID = Depends(get_current_organization),
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


@router.delete("/{call_sheet_id}", response_model=CallSheet, dependencies=[Depends(require_admin_or_manager)])
async def delete_call_sheet(
    call_sheet_id: UUID,
    organization_id: UUID = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
) -> CallSheet:
    """
    Delete call sheet (must belong to current user's organization).
    """
    call_sheet = await call_sheet_service.remove(
        db=db,
        organization_id=organization_id,
        id=call_sheet_id
    )

    if not call_sheet:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Call sheet not found"
        )

    return call_sheet
