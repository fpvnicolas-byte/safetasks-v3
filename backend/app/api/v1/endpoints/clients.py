from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    get_current_organization,
    require_admin_producer_or_finance,
    require_finance_or_admin,
    require_billing_active,
    get_current_profile,
    get_organization_record,
)
from app.db.session import get_db
from app.modules.commercial.service import client_service
from app.schemas.clients import Client, ClientCreate, ClientUpdate
from app.services.entitlements import ensure_resource_limit

router = APIRouter()


@router.get("/", response_model=List[Client], dependencies=[Depends(require_admin_producer_or_finance)])
async def get_clients(
    organization_id: UUID = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
) -> List[Client]:
    """
    Get all clients for the current user's organization.
    """
    clients = await client_service.get_multi(
        db=db,
        organization_id=organization_id,
        skip=skip,
        limit=limit
    )
    return clients


@router.post(
    "/",
    response_model=Client,
    dependencies=[Depends(require_finance_or_admin), Depends(require_billing_active)]
)
async def create_client(
    client_in: ClientCreate,
    organization_id: UUID = Depends(get_current_organization),
    profile=Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
) -> Client:
    """
    Create a new client in the current user's organization.
    """
    organization = await get_organization_record(profile, db)
    client_count = await client_service.count(db=db, organization_id=organization_id)
    await ensure_resource_limit(db, organization, resource="clients", current_count=client_count)

    client = await client_service.create(
        db=db,
        organization_id=organization_id,
        obj_in=client_in
    )
    return client


@router.get("/{client_id}", response_model=Client, dependencies=[Depends(require_admin_producer_or_finance)])
async def get_client(
    client_id: UUID,
    organization_id: UUID = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
) -> Client:
    """
    Get client by ID (must belong to current user's organization).
    """
    client = await client_service.get(
        db=db,
        organization_id=organization_id,
        id=client_id
    )

    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found"
        )

    return client


@router.put(
    "/{client_id}",
    response_model=Client,
    dependencies=[Depends(require_finance_or_admin), Depends(require_billing_active)]
)
async def update_client(
    client_id: UUID,
    client_in: ClientUpdate,
    organization_id: UUID = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
) -> Client:
    """
    Update client (must belong to current user's organization).
    """
    client = await client_service.update(
        db=db,
        organization_id=organization_id,
        id=client_id,
        obj_in=client_in
    )

    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found"
        )

    return client


@router.delete(
    "/{client_id}",
    response_model=Client,
    dependencies=[Depends(require_finance_or_admin), Depends(require_billing_active)]
)
async def delete_client(
    client_id: UUID,
    organization_id: UUID = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
) -> Client:
    """
    Delete client (must belong to current user's organization).
    """
    client = await client_service.remove(
        db=db,
        organization_id=organization_id,
        id=client_id
    )

    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found"
        )

    return client
