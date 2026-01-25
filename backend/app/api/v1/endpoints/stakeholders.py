from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional

from app.api.deps import get_current_organization
from app.db.session import get_db
from app.services.commercial import stakeholder_service, stakeholder_crud_service
from app.schemas.commercial import (
    StakeholderSummary,
    Stakeholder,
    StakeholderCreate,
    StakeholderUpdate
)

router = APIRouter()


# Legacy summary endpoint (keep for backward compatibility)
@router.get("/summary")
async def get_stakeholder_summary(
    organization_id: UUID = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
) -> StakeholderSummary:
    """
    Get a unified summary of all stakeholders in the organization.
    Includes clients (who pay), suppliers (who we pay), and crew (who work).
    """
    try:
        summary = await stakeholder_service.get_stakeholder_summary(
            db=db,
            organization_id=organization_id
        )
        return summary
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate stakeholder summary: {str(e)}"
        )


# CRUD Endpoints for Project Stakeholders
@router.get("/", response_model=List[Stakeholder])
async def list_stakeholders(
    project_id: Optional[UUID] = Query(None, description="Filter by project ID"),
    active_only: bool = Query(True, description="Only return active stakeholders"),
    organization_id: UUID = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
):
    """
    List all stakeholders in the organization.
    Optionally filter by project.
    """
    try:
        if project_id:
            stakeholders = await stakeholder_crud_service.get_by_project(
                db=db,
                organization_id=organization_id,
                project_id=project_id,
                active_only=active_only
            )
        else:
            stakeholders = await stakeholder_crud_service.get_multi(
                db=db,
                organization_id=organization_id
            )
            if active_only:
                stakeholders = [s for s in stakeholders if s.is_active]

        return stakeholders
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list stakeholders: {str(e)}"
        )


@router.post("/", response_model=Stakeholder, status_code=status.HTTP_201_CREATED)
async def create_stakeholder(
    stakeholder_in: StakeholderCreate,
    organization_id: UUID = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
):
    """Create a new stakeholder for a project."""
    try:
        stakeholder = await stakeholder_crud_service.create(
            db=db,
            obj_in=stakeholder_in,
            organization_id=organization_id
        )
        return stakeholder
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create stakeholder: {str(e)}"
        )


@router.get("/{stakeholder_id}", response_model=Stakeholder)
async def get_stakeholder(
    stakeholder_id: UUID,
    organization_id: UUID = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific stakeholder by ID."""
    stakeholder = await stakeholder_crud_service.get(
        db=db,
        id=stakeholder_id,
        organization_id=organization_id
    )

    if not stakeholder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Stakeholder not found"
        )

    return stakeholder


@router.put("/{stakeholder_id}", response_model=Stakeholder)
async def update_stakeholder(
    stakeholder_id: UUID,
    stakeholder_in: StakeholderUpdate,
    organization_id: UUID = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
):
    """Update a stakeholder."""
    stakeholder = await stakeholder_crud_service.get(
        db=db,
        id=stakeholder_id,
        organization_id=organization_id
    )

    if not stakeholder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Stakeholder not found"
        )

    try:
        updated_stakeholder = await stakeholder_crud_service.update(
            db=db,
            db_obj=stakeholder,
            obj_in=stakeholder_in
        )
        return updated_stakeholder
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update stakeholder: {str(e)}"
        )


@router.delete("/{stakeholder_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_stakeholder(
    stakeholder_id: UUID,
    organization_id: UUID = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
):
    """Delete a stakeholder."""
    stakeholder = await stakeholder_crud_service.get(
        db=db,
        id=stakeholder_id,
        organization_id=organization_id
    )

    if not stakeholder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Stakeholder not found"
        )

    try:
        await stakeholder_crud_service.remove(
            db=db,
            id=stakeholder_id,
            organization_id=organization_id
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete stakeholder: {str(e)}"
        )
