from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional

from app.api.deps import (
    get_current_organization,
    require_admin_producer_or_finance,
    require_owner_admin_or_producer,
    get_current_profile,
    get_effective_role,
    get_assigned_project_ids,
    enforce_project_assignment,
    require_billing_active,
)
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
@router.get("/summary", dependencies=[Depends(require_admin_producer_or_finance)])
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
@router.get("/", response_model=List[Stakeholder], dependencies=[Depends(require_admin_producer_or_finance)])
async def list_stakeholders(
    project_id: Optional[UUID] = Query(None, description="Filter by project ID"),
    active_only: bool = Query(True, description="Only return active stakeholders"),
    organization_id: UUID = Depends(get_current_organization),
    profile=Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
):
    """
    List all stakeholders in the organization.
    Optionally filter by project.
    """
    try:
        if project_id:
            await enforce_project_assignment(project_id, db, profile)
            stakeholders = await stakeholder_crud_service.get_by_project(
                db=db,
                organization_id=organization_id,
                project_id=project_id,
                active_only=active_only
            )
        else:
            filters = {}
            if get_effective_role(profile) == "freelancer":
                assigned_project_ids = await get_assigned_project_ids(db, profile)
                if not assigned_project_ids:
                    return []
                filters["project_id"] = assigned_project_ids

            stakeholders = await stakeholder_crud_service.get_multi(
                db=db,
                organization_id=organization_id,
                filters=filters if filters else None
            )
            if active_only:
                stakeholders = [s for s in stakeholders if s.is_active]

        return stakeholders
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list stakeholders: {str(e)}"
        )


@router.post(
    "/",
    response_model=Stakeholder,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_owner_admin_or_producer), Depends(require_billing_active)]
)
async def create_stakeholder(
    stakeholder_in: StakeholderCreate,
    organization_id: UUID = Depends(get_current_organization),
    profile=Depends(get_current_profile),
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


@router.get("/{stakeholder_id}", response_model=Stakeholder, dependencies=[Depends(require_admin_producer_or_finance)])
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

    await enforce_project_assignment(stakeholder.project_id, db, profile)

    return stakeholder


@router.put(
    "/{stakeholder_id}",
    response_model=Stakeholder,
    dependencies=[Depends(require_owner_admin_or_producer), Depends(require_billing_active)]
)
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


@router.delete(
    "/{stakeholder_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_owner_admin_or_producer), Depends(require_billing_active)]
)
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
