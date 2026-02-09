from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    get_organization_from_profile,
    require_admin_producer_or_finance,
)
from app.db.session import get_db
from app.services.contacts import contacts_service

router = APIRouter()


@router.get("/", dependencies=[Depends(require_admin_producer_or_finance)])
async def get_contacts(
    organization_id: UUID = Depends(get_organization_from_profile),
    db: AsyncSession = Depends(get_db),
    search: Optional[str] = Query(None, description="Search by name, email, or phone"),
    category: Optional[str] = Query(None, description="Filter by supplier category"),
    platform_status: Optional[str] = Query(None, description="Filter: all, active, invited, none"),
    active_only: bool = Query(True, description="Show only active contacts"),
):
    """Get all contacts with enriched data (project count, spend, platform status)."""
    return await contacts_service.get_contacts(
        db=db,
        organization_id=organization_id,
        search=search,
        category=category,
        platform_status=platform_status,
        active_only=active_only,
    )


@router.get("/{supplier_id}", dependencies=[Depends(require_admin_producer_or_finance)])
async def get_contact_detail(
    supplier_id: UUID,
    organization_id: UUID = Depends(get_organization_from_profile),
    db: AsyncSession = Depends(get_db),
):
    """Get full contact detail with assignments, team info, and invite status."""
    contact = await contacts_service.get_contact_detail(
        db=db,
        organization_id=organization_id,
        supplier_id=supplier_id,
    )

    if not contact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contact not found",
        )

    return contact
