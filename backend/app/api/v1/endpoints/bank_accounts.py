from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field
from datetime import date

from sqlalchemy.exc import IntegrityError

from app.api.deps import (
    get_current_profile,
    require_finance_or_admin,
    require_admin_producer_or_finance,
    require_billing_active,
)
from app.db.session import get_db
from app.services.financial import bank_account_service
from app.services.financial import transaction_service
from app.schemas.bank_accounts import BankAccount, BankAccountCreate, BankAccountUpdate
from app.schemas.transactions import TransactionCreate, TransactionWithRelations

router = APIRouter()


class BankAccountTransferCreate(BaseModel):
    """Request schema for transferring funds between two bank accounts."""

    from_bank_account_id: UUID
    to_bank_account_id: UUID
    amount_cents: int = Field(..., gt=0)
    transaction_date: date
    description: Optional[str] = None


class BankAccountTransferResponse(BaseModel):
    """Response schema containing the two created transactions."""

    from_transaction: TransactionWithRelations
    to_transaction: TransactionWithRelations

    model_config = {"from_attributes": True}


@router.get("/", response_model=List[BankAccount], dependencies=[Depends(require_admin_producer_or_finance)])
async def get_bank_accounts(
    profile: "Profile" = Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
) -> List[BankAccount]:
    """
    Get all bank accounts for the current user's organization.
    """
    organization_id = profile.organization_id
    accounts = await bank_account_service.get_multi(
        db=db,
        organization_id=organization_id,
        skip=skip,
        limit=limit
    )
    return accounts


@router.post(
    "/transfer",
    response_model=BankAccountTransferResponse,
    dependencies=[Depends(require_finance_or_admin), Depends(require_billing_active)],
)
async def transfer_between_bank_accounts(
    transfer_in: BankAccountTransferCreate,
    profile: "Profile" = Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
) -> BankAccountTransferResponse:
    """
    Transfer funds between two bank accounts (creates two 'internal_transfer' transactions).
    This operation affects bank balances immediately and does not require approval.
    """
    organization_id = profile.organization_id

    if transfer_in.from_bank_account_id == transfer_in.to_bank_account_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Source and destination accounts must be different")

    from_account = await bank_account_service.get(
        db=db,
        organization_id=organization_id,
        id=transfer_in.from_bank_account_id,
    )
    to_account = await bank_account_service.get(
        db=db,
        organization_id=organization_id,
        id=transfer_in.to_bank_account_id,
    )

    if not from_account or not to_account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bank account not found")

    if from_account.currency != to_account.currency:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Bank accounts must use the same currency")

    base_description = (transfer_in.description or "").strip()
    out_description = f"{base_description} (to {to_account.name})" if base_description else f"Transfer to {to_account.name}"
    in_description = f"{base_description} (from {from_account.name})" if base_description else f"Transfer from {from_account.name}"

    try:
        from_tx = await transaction_service.create(
            db=db,
            organization_id=organization_id,
            obj_in=TransactionCreate(
                bank_account_id=from_account.id,
                category="internal_transfer",
                type="expense",
                amount_cents=transfer_in.amount_cents,
                description=out_description,
                transaction_date=transfer_in.transaction_date,
                payment_status="paid",
            ),
        )

        to_tx = await transaction_service.create(
            db=db,
            organization_id=organization_id,
            obj_in=TransactionCreate(
                bank_account_id=to_account.id,
                category="internal_transfer",
                type="income",
                amount_cents=transfer_in.amount_cents,
                description=in_description,
                transaction_date=transfer_in.transaction_date,
                payment_status="paid",
            ),
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except IntegrityError as e:
        detail = "Could not create transfer. Ensure database migrations are up to date."
        error_text = str(getattr(e, "orig", e))
        if "category" in error_text or "transactions_category_check" in error_text:
            detail = "Database is missing the 'internal_transfer' category. Run Alembic migrations (alembic upgrade head) and retry."
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)

    return BankAccountTransferResponse(from_transaction=from_tx, to_transaction=to_tx)


@router.post(
    "/",
    response_model=BankAccount,
    dependencies=[Depends(require_finance_or_admin), Depends(require_billing_active)]
)
async def create_bank_account(
    account_in: BankAccountCreate,
    profile: "Profile" = Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
) -> BankAccount:
    """
    Create a new bank account in the current user's organization.
    """
    organization_id = profile.organization_id
    account = await bank_account_service.create(
        db=db,
        organization_id=organization_id,
        obj_in=account_in
    )
    return account


@router.get("/{account_id}", response_model=BankAccount, dependencies=[Depends(require_admin_producer_or_finance)])
async def get_bank_account(
    account_id: UUID,
    profile: "Profile" = Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
) -> BankAccount:
    """
    Get bank account by ID (must belong to current user's organization).
    """
    organization_id = profile.organization_id
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


@router.put(
    "/{account_id}",
    response_model=BankAccount,
    dependencies=[Depends(require_finance_or_admin), Depends(require_billing_active)]
)
async def update_bank_account(
    account_id: UUID,
    account_in: BankAccountUpdate,
    profile: "Profile" = Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
) -> BankAccount:
    """
    Update bank account (must belong to current user's organization).
    Only finance/admin can update bank accounts.
    """
    organization_id = profile.organization_id
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


@router.delete(
    "/{account_id}",
    response_model=BankAccount,
    dependencies=[Depends(require_finance_or_admin), Depends(require_billing_active)]
)
async def delete_bank_account(
    account_id: UUID,
    profile: "Profile" = Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
) -> BankAccount:
    """
    Delete bank account (must belong to current user's organization).
    Only finance/admin can delete bank accounts.
    """
    organization_id = profile.organization_id
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
