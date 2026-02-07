from typing import List
from uuid import UUID
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    get_current_organization,
    require_finance_or_admin,
    require_admin_producer_or_finance,
    require_billing_active,
    get_current_user_id
)
from app.db.session import get_db
from app.services.financial import transaction_service
from app.schemas.transactions import (
    TransactionCreate,
    TransactionUpdate,
    TransactionWithRelations,
    TransactionStats,
    TransactionOverviewStats,
    TransactionApproval,
)

router = APIRouter()


@router.get("/", response_model=List[TransactionWithRelations], dependencies=[Depends(require_admin_producer_or_finance)])
async def get_transactions(
    organization_id: UUID = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    bank_account_id: UUID = None,
    project_id: UUID = None,
    type: str = Query(None, pattern="^(income|expense)$"),
    category: str = None,
) -> List[TransactionWithRelations]:
    """
    Get all transactions for the current user's organization with relations.
    """
    filters = {}
    if bank_account_id:
        filters["bank_account_id"] = bank_account_id
    if project_id:
        filters["project_id"] = project_id
    if type:
        filters["type"] = type
    if category:
        filters["category"] = category

    transactions = await transaction_service.get_multi_with_relations(
        db=db,
        organization_id=organization_id,
        skip=skip,
        limit=limit,
        filters=filters
    )
    return transactions


@router.get("/pending", response_model=List[TransactionWithRelations], dependencies=[Depends(require_finance_or_admin)])
async def get_pending_transactions(
    organization_id: UUID = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
) -> List[TransactionWithRelations]:
    """
    Get all pending transactions for approval.
    """
    filters = {"payment_status": "pending"}
    transactions = await transaction_service.get_multi_with_relations(
        db=db,
        organization_id=organization_id,
        skip=skip,
        limit=limit,
        filters=filters
    )
    return transactions


@router.post(
    "/",
    response_model=TransactionWithRelations,
    dependencies=[Depends(require_finance_or_admin), Depends(require_billing_active)]
)
async def create_transaction(
    transaction_in: TransactionCreate,
    organization_id: UUID = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
) -> TransactionWithRelations:
    """
    Create a new transaction and update bank account balance atomically.
    """
    try:
        transaction = await transaction_service.create(
            db=db,
            organization_id=organization_id,
            obj_in=transaction_in
        )

        return transaction

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/{transaction_id}", response_model=TransactionWithRelations, dependencies=[Depends(require_admin_producer_or_finance)])
async def get_transaction(
    transaction_id: UUID,
    organization_id: UUID = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
) -> TransactionWithRelations:
    """
    Get transaction by ID with relations (must belong to current user's organization).
    """
    transaction = await transaction_service.get_with_relations(
        db=db,
        organization_id=organization_id,
        id=transaction_id,
    )

    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found"
        )

    return transaction


@router.put("/{transaction_id}", response_model=TransactionWithRelations, dependencies=[Depends(require_finance_or_admin)])
async def update_transaction(
    transaction_id: UUID,
    transaction_in: TransactionUpdate,
    organization_id: UUID = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
) -> TransactionWithRelations:
    """
    Update transaction (must belong to current user's organization).
    Note: Updating transactions is complex due to balance management.
    In production, you might want to restrict updates or implement balance rollback.
    """
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Transaction updates are not allowed to maintain data integrity. Delete and create a new transaction instead."
    )


@router.patch("/{transaction_id}/approve", response_model=TransactionWithRelations, dependencies=[Depends(require_finance_or_admin)])
async def approve_transaction(
    transaction_id: UUID,
    organization_id: UUID = Depends(get_current_organization),
    current_user: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> TransactionWithRelations:
    """Approve a pending transaction."""
    try:
        await transaction_service.approve(
            db=db,
            organization_id=organization_id,
            transaction_id=transaction_id,
            approver_id=current_user,
        )
    except ValueError as e:
        detail = str(e)
        code = status.HTTP_404_NOT_FOUND if "not found" in detail else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=code, detail=detail)

    return await transaction_service.get_with_relations(
        db=db,
        organization_id=organization_id,
        id=transaction_id,
    )


@router.patch("/{transaction_id}/reject", response_model=TransactionWithRelations, dependencies=[Depends(require_finance_or_admin)])
async def reject_transaction(
    transaction_id: UUID,
    approval_in: TransactionApproval,
    organization_id: UUID = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
) -> TransactionWithRelations:
    """Reject a pending transaction."""
    if approval_in.decision != "reject":
        raise HTTPException(status_code=400, detail="Invalid decision")

    try:
        await transaction_service.reject(
            db=db,
            organization_id=organization_id,
            transaction_id=transaction_id,
            rejection_reason=approval_in.rejection_reason,
        )
    except ValueError as e:
        detail = str(e)
        code = status.HTTP_404_NOT_FOUND if "not found" in detail else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=code, detail=detail)

    return await transaction_service.get_with_relations(
        db=db,
        organization_id=organization_id,
        id=transaction_id,
    )


@router.patch("/{transaction_id}/mark-paid", response_model=TransactionWithRelations, dependencies=[Depends(require_finance_or_admin)])
async def mark_transaction_paid(
    transaction_id: UUID,
    organization_id: UUID = Depends(get_current_organization),
    current_user: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> TransactionWithRelations:
    """Mark an approved transaction as paid."""
    try:
        await transaction_service.mark_paid(
            db=db,
            organization_id=organization_id,
            transaction_id=transaction_id,
            paid_by_id=current_user,
        )
    except ValueError as e:
        detail = str(e)
        code = status.HTTP_404_NOT_FOUND if "not found" in detail else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=code, detail=detail)

    return await transaction_service.get_with_relations(
        db=db,
        organization_id=organization_id,
        id=transaction_id,
    )


@router.delete(
    "/{transaction_id}",
    response_model=TransactionWithRelations,
    dependencies=[Depends(require_finance_or_admin), Depends(require_billing_active)]
)
async def delete_transaction(
    transaction_id: UUID,
    organization_id: UUID = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
) -> TransactionWithRelations:
    """
    Delete transaction and rollback balance change (must belong to current user's organization).
    """
    from sqlalchemy.orm import selectinload
    from app.models.transactions import Transaction as TransactionModel
    from app.models.projects import Project

    # Get transaction with relations before deletion
    transaction = await transaction_service.get(
        db=db,
        organization_id=organization_id,
        id=transaction_id,
        options=[
            selectinload(TransactionModel.bank_account),
            selectinload(TransactionModel.project).selectinload(Project.services)
        ]
    )

    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found"
        )

    # Delete transaction and rollback balance
    await transaction_service.remove(
        db=db,
        organization_id=organization_id,
        id=transaction_id
    )

    return transaction


@router.get("/stats/monthly", response_model=TransactionStats, dependencies=[Depends(require_admin_producer_or_finance)])
async def get_monthly_stats(
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
    organization_id: UUID = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
) -> TransactionStats:
    """
    Get monthly financial statistics for the current user's organization.
    """
    stats = await transaction_service.get_monthly_stats(
        db=db,
        organization_id=organization_id,
        year=year,
        month=month
    )
    return stats


@router.get("/stats/overview", response_model=TransactionOverviewStats, dependencies=[Depends(require_admin_producer_or_finance)])
async def get_overview_stats(
    organization_id: UUID = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
) -> TransactionOverviewStats:
    """
    Get overall financial statistics for the current user's organization.
    """
    stats = await transaction_service.get_overview_stats(
        db=db,
        organization_id=organization_id
    )
    return stats
