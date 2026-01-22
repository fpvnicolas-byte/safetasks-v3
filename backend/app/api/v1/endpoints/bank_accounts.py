from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_organization, require_admin, get_current_profile
from app.db.session import get_db
from app.services.financial import bank_account_service
from app.schemas.bank_accounts import BankAccount, BankAccountCreate, BankAccountUpdate

router = APIRouter()


@router.get("/", response_model=List[BankAccount])
async def get_bank_accounts(
    organization_id: UUID = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
) -> List[BankAccount]:
    """
    Get all bank accounts for the current user's organization.
    """
    accounts = await bank_account_service.get_multi(
        db=db,
        organization_id=organization_id,
        skip=skip,
        limit=limit
    )
    return accounts


@router.post("/", response_model=BankAccount)
async def create_bank_account(
    account_in: BankAccountCreate,
    organization_id: UUID = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
) -> BankAccount:
    """
    Create a new bank account in the current user's organization.
    """
    account = await bank_account_service.create(
        db=db,
        organization_id=organization_id,
        obj_in=account_in
    )
    return account


@router.get("/{account_id}", response_model=BankAccount)
async def get_bank_account(
    account_id: UUID,
    organization_id: UUID = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
) -> BankAccount:
    """
    Get bank account by ID (must belong to current user's organization).
    """
    account = await bank_account_service.get(
        db=db,
        organization_id=organization_id,
        id=account_id
    )

    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bank account not found"
        )

    return account


@router.put("/{account_id}", response_model=BankAccount)
async def update_bank_account(
    account_id: UUID,
    account_in: BankAccountUpdate,
    organization_id: UUID = Depends(get_current_organization),
    profile = Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
) -> BankAccount:
    """
    Update bank account (must belong to current user's organization).
    Only admins can update bank accounts.
    """
    if profile.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can update bank accounts"
        )

    account = await bank_account_service.update(
        db=db,
        organization_id=organization_id,
        id=account_id,
        obj_in=account_in
    )

    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bank account not found"
        )

    return account


@router.delete("/{account_id}", response_model=BankAccount)
async def delete_bank_account(
    account_id: UUID,
    organization_id: UUID = Depends(get_current_organization),
    profile = Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
) -> BankAccount:
    """
    Delete bank account (must belong to current user's organization).
    Only admins can delete bank accounts.
    """
    if profile.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can delete bank accounts"
        )

    # Check if account has any transactions
    from app.services.financial import transaction_service
    transactions = await transaction_service.get_multi(
        db=db,
        organization_id=organization_id,
        filters={"bank_account_id": account_id},
        limit=1
    )

    if transactions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete bank account with existing transactions"
        )

    account = await bank_account_service.remove(
        db=db,
        organization_id=organization_id,
        id=account_id
    )

    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bank account not found"
        )

    return account
