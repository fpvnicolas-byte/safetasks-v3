from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_organization_from_profile, require_admin_or_manager
from app.db.session import get_db
from app.services.commercial import supplier_service, supplier_statement_service
from app.schemas.commercial import Supplier, SupplierCreate, SupplierUpdate, SupplierStatement, SupplierWithTransactions

router = APIRouter()


@router.get("/", response_model=List[SupplierWithTransactions])
async def get_suppliers(
    organization_id: UUID = Depends(get_organization_from_profile),
    db: AsyncSession = Depends(get_db),
    category: str = Query(None, description="Filter by supplier category"),
    active_only: bool = Query(True, description="Show only active suppliers"),
) -> List[SupplierWithTransactions]:
    """
    Get all suppliers for the current user's organization with transaction summaries.
    """
    suppliers = await supplier_service.get_suppliers_with_transaction_summary(
        db=db,
        organization_id=organization_id,
        category=category,
        active_only=active_only
    )
    return suppliers


@router.post("/", response_model=Supplier, dependencies=[Depends(require_admin_or_manager)])
async def create_supplier(
    supplier_in: SupplierCreate,
    organization_id: UUID = Depends(get_organization_from_profile),
    db: AsyncSession = Depends(get_db),
) -> Supplier:
    """
    Create a new supplier in the current user's organization.
    Only admins and managers can create suppliers.
    """
    supplier = await supplier_service.create(
        db=db,
        organization_id=organization_id,
        obj_in=supplier_in
    )
    return supplier


@router.get("/{supplier_id}", response_model=Supplier)
async def get_supplier(
    supplier_id: UUID,
    organization_id: UUID = Depends(get_organization_from_profile),
    db: AsyncSession = Depends(get_db),
) -> Supplier:
    """
    Get supplier by ID (must belong to current user's organization).
    """
    supplier = await supplier_service.get(
        db=db,
        organization_id=organization_id,
        id=supplier_id
    )

    if not supplier:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Supplier not found"
        )

    return supplier


@router.put("/{supplier_id}", response_model=Supplier, dependencies=[Depends(require_admin_or_manager)])
async def update_supplier(
    supplier_id: UUID,
    supplier_in: SupplierUpdate,
    organization_id: UUID = Depends(get_organization_from_profile),
    db: AsyncSession = Depends(get_db),
) -> Supplier:
    """
    Update supplier (must belong to current user's organization).
    Only admins and managers can update suppliers.
    """
    supplier = await supplier_service.update(
        db=db,
        organization_id=organization_id,
        id=supplier_id,
        obj_in=supplier_in
    )

    if not supplier:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Supplier not found"
        )

    return supplier


@router.delete("/{supplier_id}", response_model=Supplier, dependencies=[Depends(require_admin_or_manager)])
async def delete_supplier(
    supplier_id: UUID,
    organization_id: UUID = Depends(get_organization_from_profile),
    db: AsyncSession = Depends(get_db),
) -> Supplier:
    """
    Delete supplier (must belong to current user's organization).
    Only admins and managers can delete suppliers.
    """
    supplier = await supplier_service.remove(
        db=db,
        organization_id=organization_id,
        id=supplier_id
    )

    if not supplier:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Supplier not found"
        )

    return supplier


@router.get("/{supplier_id}/statement")
async def get_supplier_statement(
    supplier_id: UUID,
    organization_id: UUID = Depends(get_organization_from_profile),
    db: AsyncSession = Depends(get_db),
    date_from: str = Query(None, description="Filter from date (YYYY-MM-DD)"),
    date_to: str = Query(None, description="Filter to date (YYYY-MM-DD)"),
) -> SupplierStatement:
    """
    Get detailed financial statement for a specific supplier.
    Shows all transactions, project breakdown, and category analysis.
    """
    from datetime import datetime

    # Parse dates
    date_from_parsed = datetime.fromisoformat(date_from).date() if date_from else None
    date_to_parsed = datetime.fromisoformat(date_to).date() if date_to else None

    try:
        statement = await supplier_statement_service.get_supplier_statement(
            db=db,
            organization_id=organization_id,
            supplier_id=supplier_id,
            date_from=date_from_parsed,
            date_to=date_to_parsed
        )
        return statement
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
