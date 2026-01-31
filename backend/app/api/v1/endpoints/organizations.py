from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_organization, get_current_profile, require_owner_or_admin, require_read_only
from app.db.session import get_db
from app.modules.commercial.service import organization_service
from app.schemas.organizations import Organization, OrganizationCreate, OrganizationUpdate

router = APIRouter()


@router.get("/me", response_model=Organization, dependencies=[Depends(require_read_only)])
async def get_my_organization(
    profile = Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
) -> Organization:
    """
    Get the current user's organization details.
    """
    if not profile.organization_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User is not associated with any organization"
        )

    organization = await organization_service.get(
        db=db,
        organization_id=profile.organization_id,
        id=profile.organization_id
    )

    if not organization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )

    return organization


@router.get("/{organization_id}", response_model=Organization, dependencies=[Depends(require_read_only)])
async def get_organization(
    organization_id: UUID,
    organization_id_validated: UUID = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
) -> Organization:
    """
    Get organization by ID (must belong to current user).
    """
    organization = await organization_service.get(
        db=db,
        organization_id=organization_id_validated,
        id=organization_id
    )

    if not organization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )

    return organization


@router.put("/{organization_id}", response_model=Organization, dependencies=[Depends(require_owner_or_admin)])
async def update_organization(
    organization_id: UUID,
    organization_in: OrganizationUpdate,
    organization_id_validated: UUID = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
) -> Organization:
    """
    Update organization (must belong to current user).
    """
    organization = await organization_service.update(
        db=db,
        organization_id=organization_id_validated,
        id=organization_id,
        obj_in=organization_in
    )

    if not organization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )

    return organization
