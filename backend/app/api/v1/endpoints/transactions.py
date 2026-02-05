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
    type: str = Query(None, regex="^(income|expense)$"),
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
    current_user: UUID = Depends(get_current_user_id),  # Use user_id as approver
    db: AsyncSession = Depends(get_db),
) -> TransactionWithRelations:
    """
    Approve a pending transaction.
    """
    from datetime import datetime, timezone
    
    transaction = await transaction_service.get(
        db=db,
        organization_id=organization_id,
        id=transaction_id
    )

    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found"
        )
        
    if transaction.payment_status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Transaction is already {transaction.payment_status}"
        )

    # In a real implementation with Service layer, this logic should be in service
    # But for now updating directly via update/Service
    
    # We need to construct the update dictionary
    update_data = {
        "payment_status": "approved",
        "approved_by": current_user,
        "approved_at": datetime.now(timezone.utc),
        "rejection_reason": None 
    }
    
    # Using the service's update method which expects a Schema or dict
    # Assuming valid TransactionUpdate schema was updated to allow these or we pass dict directly if supported
    # If TransactionUpdate schema doesn't have approved_by, we might need to modify schema or service.
    # We added fields to TransactionUpdate in previous step, checking... 
    # Wait, in Step 29/35 I added payment_status and rejection_reason to TransactionUpdate but NOT approved_by/approved_at.
    # I should have added them to TransactionUpdate or Update logic.
    # Let's check TransactionUpdate definition again.
    
    # Actually, I missed adding approved_by/approved_at to TransactionUpdate in Step 29/35.
    # I only added payment_status and rejection_reason.
    # I will rely on the service accepting a dict that matches model columns if it uses Pydantic's dict(exclude_unset=True) 
    # but the service usually validates against schema. 
    # If the service uses `obj_in` as `Union[UpdateSchema, Dict[str, Any]]`, a dict might pass.
    # But usually it's safer to update schema.
    
    # For now, I will assume I can pass a dict or I will do a quick schema fix in next step if this fails.
    # Or I can use a raw update or custom service method.
    # Let's try to simple update via service assuming it handles dicts or I need to update schema.
    
    # Re-reading Step 29: TransactionUpdate definition:
    # payment_status: Optional[str] = None
    # rejection_reason: Optional[str] = None
    # No approved_by.
    
    # I should add 'approve_transaction' method to service eventually, but for now let's try to update.
    # I'll update the schema in a separate tool call if needed or just add it now if I can.
    # But I am editing endpoints now.
    
    # To be safe, I will implement a custom update here or rely on the service accepting extra fields if not strict.
    # But FastAPI/Pydantic is strict.
    
    # Better approach: Add dedicated service methods for approve/reject in `app/services/financial.py`?
    # Or just update columns directly on the model instance and commit?
    # The service `update` method typically takes `db_obj` and `obj_in`.
    
    # Let's try to use the generic update but I need to make sure schema allows it.
    # Since I missed the schema update for approved_by, I will just manually update the object
    # using simple sqlalchemy update or modifying attributes and committing, 
    # bypassing the service `update` validation limitation if strictly typed.
    
    transaction.payment_status = "approved"
    transaction.approved_by = current_user
    transaction.approved_at = datetime.now(timezone.utc)
    transaction.rejection_reason = None
    
    db.add(transaction)
    await db.commit()
    await db.refresh(transaction)
    
    return await transaction_service.get_with_relations(
        db=db, 
        organization_id=organization_id, 
        id=transaction.id
    )


@router.patch("/{transaction_id}/reject", response_model=TransactionWithRelations, dependencies=[Depends(require_finance_or_admin)])
async def reject_transaction(
    transaction_id: UUID,
    approval_in: TransactionApproval,
    organization_id: UUID = Depends(get_current_organization),
    current_user: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> TransactionWithRelations:
    """
    Reject a pending transaction.
    """
    if approval_in.decision != "reject":
        raise HTTPException(status_code=400, detail="Invalid decision")

    transaction = await transaction_service.get(
        db=db,
        organization_id=organization_id,
        id=transaction_id
    )

    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found"
        )
        
    if transaction.payment_status != "pending":
         raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Transaction is already {transaction.payment_status}"
        )

    transaction.payment_status = "rejected"
    # transaction.approved_by = current_user # Maybe we track who rejected too? reusing approved_by or adding rejected_by?
    # Plan didn't specify rejected_by. I'll stick to not setting approved_by, or maybe set it to know who acted.
    # Usually "approved_by" implies the actor of the state change in simple workflows, 
    # but "rejected" state implies it was NOT approved.
    # However, knowing WHO rejected is useful. I'll leave approved_by null for rejection to avoid confusion, 
    # or use it as "decided_by". 
    # Given the column name is "approved_by", setting it for rejection is misleading. 
    # I'll leave it null or only set if I rename column. I'll leave it null.
    
    transaction.rejection_reason = approval_in.rejection_reason
    
    db.add(transaction)
    await db.commit()
    await db.refresh(transaction)
    
    return await transaction_service.get_with_relations(
        db=db, 
        organization_id=organization_id, 
        id=transaction.id
    )


@router.patch("/{transaction_id}/mark-paid", response_model=TransactionWithRelations, dependencies=[Depends(require_finance_or_admin)])
async def mark_transaction_paid(
    transaction_id: UUID,
    organization_id: UUID = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
) -> TransactionWithRelations:
    """
    Mark an approved transaction as paid.
    """
    transaction = await transaction_service.get(
        db=db,
        organization_id=organization_id,
        id=transaction_id
    )

    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found"
        )
    
    if transaction.payment_status != "approved":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Transaction must be approved before being paid. Current status: {transaction.payment_status}"
        )

    transaction.payment_status = "paid"
    
    db.add(transaction)
    await db.commit()
    await db.refresh(transaction)
    
    return await transaction_service.get_with_relations(
        db=db,
        organization_id=organization_id,
        id=transaction.id
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
