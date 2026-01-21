from typing import List, Optional
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_active_user
from app.core.database import get_db
from app.core.schemas import SuccessResponse, ListResponse

from . import schemas, services

# Create router
router = APIRouter(prefix="/financial", tags=["financial"])

# Initialize services
bank_svc = services.bank_account_service
transaction_svc = services.transaction_service
invoice_svc = services.invoice_service


# Bank Account endpoints
@router.get("/bank-accounts", response_model=ListResponse[schemas.BankAccountRead])
async def read_bank_accounts(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
    skip: int = Query(0, ge=0, description="Records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum records to return")
):
    """Get paginated list of bank accounts with balance summaries."""
    accounts_data = await bank_svc.get_accounts_with_balance_summary(
        db=db,
        skip=skip,
        limit=limit
    )

    # Get total count
    total = await bank_svc.get_count(db=db)

    return ListResponse(
        data=[item['account'] for item in accounts_data],
        pagination={
            "items": [item['account'] for item in accounts_data],
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size,
            "has_next": skip + limit < total,
            "has_prev": skip > 0
        },
        message=f"Found {len(accounts_data)} bank accounts"
    )


@router.get("/bank-accounts/{account_id}", response_model=SuccessResponse[schemas.BankAccountRead])
async def read_bank_account(
    account_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Get bank account by ID."""
    account = await bank_svc.get(db=db, id=account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Bank account not found")

    return SuccessResponse(data=account, message="Bank account retrieved successfully")


@router.post("/bank-accounts", response_model=SuccessResponse[schemas.BankAccountRead], status_code=201)
async def create_bank_account(
    account_in: schemas.BankAccountCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Create new bank account."""
    # Add created_by user
    account_data = account_in.model_dump()
    account_data['created_by'] = current_user["user_id"]
    account_data['updated_by'] = current_user["user_id"]

    account = await bank_svc.create(db=db, obj_in=account_data)
    return SuccessResponse(data=account, message="Bank account created successfully")


@router.put("/bank-accounts/{account_id}", response_model=SuccessResponse[schemas.BankAccountRead])
async def update_bank_account(
    account_id: int,
    account_in: schemas.BankAccountUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Update bank account."""
    account = await bank_svc.get(db=db, id=account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Bank account not found")

    updated_account = await bank_svc.update(
        db=db, db_obj=account, obj_in=account_in
    )
    return SuccessResponse(data=updated_account, message="Bank account updated successfully")


@router.delete("/bank-accounts/{account_id}", response_model=SuccessResponse[dict])
async def delete_bank_account(
    account_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Delete bank account."""
    account = await bank_svc.exists(db=db, id=account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Bank account not found")

    await bank_svc.remove(db=db, id=account_id)
    return SuccessResponse(data={"id": account_id}, message="Bank account deleted successfully")


# Transaction endpoints
@router.get("/transactions", response_model=ListResponse[schemas.TransactionRead])
async def read_transactions(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
    skip: int = Query(0, ge=0, description="Records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum records to return"),
    account_id: Optional[int] = Query(None, description="Filter by bank account ID"),
    transaction_type: Optional[str] = Query(None, description="Filter by transaction type"),
    category: Optional[str] = Query(None, description="Filter by category"),
    status: Optional[str] = Query(None, description="Filter by status"),
    start_date: Optional[date] = Query(None, description="Filter from date"),
    end_date: Optional[date] = Query(None, description="Filter to date")
):
    """Get paginated list of transactions."""
    filters = schemas.TransactionFilter(
        bank_account_id=account_id,
        transaction_type=transaction_type,
        category=category,
        status=status,
        start_date=start_date,
        end_date=end_date
    )

    transactions = await transaction_svc.get_multi(
        db=db,
        skip=skip,
        limit=limit,
        filters=filters,
        order_by="transaction_date",
        order_desc=True
    )

    total = await transaction_svc.get_count(db=db, filters=filters)

    return ListResponse(
        data=transactions,
        pagination={
            "items": transactions,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size,
            "has_next": skip + limit < total,
            "has_prev": skip > 0
        },
        message=f"Found {len(transactions)} transactions"
    )


@router.get("/transactions/{transaction_id}", response_model=SuccessResponse[schemas.TransactionRead])
async def read_transaction(
    transaction_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Get transaction by ID."""
    transaction = await transaction_svc.get(db=db, id=transaction_id)
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    return SuccessResponse(data=transaction, message="Transaction retrieved successfully")


@router.post("/transactions", response_model=SuccessResponse[schemas.TransactionRead], status_code=201)
async def create_transaction(
    transaction_in: schemas.TransactionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Create new transaction with balance update."""
    transaction = await transaction_svc.create_transaction_with_balance_update(
        db=db,
        transaction_data=transaction_in
    )
    return SuccessResponse(data=transaction, message="Transaction created successfully")


@router.put("/transactions/{transaction_id}", response_model=SuccessResponse[schemas.TransactionRead])
async def update_transaction(
    transaction_id: int,
    transaction_in: schemas.TransactionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Update transaction."""
    transaction = await transaction_svc.get(db=db, id=transaction_id)
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    updated_transaction = await transaction_svc.update(
        db=db, db_obj=transaction, obj_in=transaction_in
    )
    return SuccessResponse(data=updated_transaction, message="Transaction updated successfully")


@router.delete("/transactions/{transaction_id}", response_model=SuccessResponse[dict])
async def delete_transaction(
    transaction_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Delete transaction."""
    transaction = await transaction_svc.exists(db=db, id=transaction_id)
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    await transaction_svc.remove(db=db, id=transaction_id)
    return SuccessResponse(data={"id": transaction_id}, message="Transaction deleted successfully")


# Cash flow and financial reports
@router.get("/cash-flow", response_model=SuccessResponse[schemas.CashFlowSummary])
async def get_cash_flow_summary(
    start_date: date = Query(..., description="Start date for cash flow analysis"),
    end_date: date = Query(..., description="End date for cash flow analysis"),
    account_id: Optional[int] = Query(None, description="Specific account ID"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Get cash flow summary for a date range."""
    summary = await transaction_svc.get_cash_flow_summary(
        db=db,
        start_date=start_date,
        end_date=end_date,
        account_id=account_id
    )
    return SuccessResponse(data=summary, message="Cash flow summary generated successfully")


@router.get("/transactions/overdue", response_model=ListResponse[schemas.TransactionRead])
async def get_overdue_transactions(
    account_id: Optional[int] = Query(None, description="Filter by account ID"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Get all overdue transactions."""
    overdue = await transaction_svc.get_overdue_transactions(db=db, account_id=account_id)
    return ListResponse(
        data=overdue,
        pagination={
            "items": overdue,
            "total": len(overdue),
            "page": 1,
            "page_size": len(overdue),
            "total_pages": 1,
            "has_next": False,
            "has_prev": False
        },
        message=f"Found {len(overdue)} overdue transactions"
    )


@router.post("/transactions/reconcile", response_model=SuccessResponse[dict])
async def reconcile_transactions(
    request: schemas.TransactionReconciliationRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Reconcile transactions with bank statements."""
    result = await transaction_svc.reconcile_transactions(
        db=db,
        transaction_ids=request.transaction_ids,
        account_id=request.account_id
    )
    return SuccessResponse(
        data=result,
        message=f"Reconciled {result['reconciled_count']} transactions"
    )


@router.get("/transactions/categories", response_model=SuccessResponse[schemas.TransactionCategoryReport])
async def get_transaction_categories(
    start_date: Optional[date] = Query(None, description="Start date"),
    end_date: Optional[date] = Query(None, description="End date"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Get transaction categorization report."""
    report = await transaction_svc.categorize_transactions(
        db=db,
        start_date=start_date,
        end_date=end_date
    )
    return SuccessResponse(data=report, message="Transaction category report generated")


# Invoice endpoints
@router.get("/invoices", response_model=ListResponse[schemas.InvoiceRead])
async def read_invoices(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
    skip: int = Query(0, ge=0, description="Records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum records to return"),
    status: Optional[str] = Query(None, description="Filter by status"),
    issuer_tax_id: Optional[str] = Query(None, description="Filter by issuer tax ID")
):
    """Get paginated list of invoices."""
    filters = schemas.InvoiceFilter(
        status=status,
        issuer_tax_id=issuer_tax_id
    )

    invoices = await invoice_svc.get_multi(
        db=db,
        skip=skip,
        limit=limit,
        filters=filters,
        order_by="created_at",
        order_desc=True
    )

    total = await invoice_svc.get_count(db=db, filters=filters)

    return ListResponse(
        data=invoices,
        pagination={
            "items": invoices,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size,
            "has_next": skip + limit < total,
            "has_prev": skip > 0
        },
        message=f"Found {len(invoices)} invoices"
    )


@router.get("/invoices/{invoice_id}", response_model=SuccessResponse[schemas.InvoiceRead])
async def read_invoice(
    invoice_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Get invoice by ID."""
    invoice = await invoice_svc.get(db=db, id=invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    return SuccessResponse(data=invoice, message="Invoice retrieved successfully")


@router.post("/invoices/emit", response_model=SuccessResponse[schemas.InvoiceRead], status_code=201)
async def emit_invoice(
    invoice_in: schemas.InvoiceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Create and emit an NF-e invoice."""
    try:
        invoice = await invoice_svc.emit_invoice(
            db=db,
            invoice_data=invoice_in,
            created_by=current_user["user_id"]
        )
        return SuccessResponse(data=invoice, message="Invoice emission initiated successfully")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Invoice emission failed: {str(e)}"
        )


@router.post("/invoices/{invoice_id}/cancel", response_model=SuccessResponse[schemas.InvoiceRead])
async def cancel_invoice(
    invoice_id: int,
    cancellation_data: schemas.InvoiceCancellationRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Cancel an NF-e invoice."""
    try:
        invoice = await invoice_svc.cancel_invoice(
            db=db,
            invoice_id=invoice_id,
            reason=cancellation_data.reason,
            cancelled_by=current_user["user_id"]
        )
        return SuccessResponse(data=invoice, message="Invoice cancelled successfully")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Invoice cancellation failed: {str(e)}"
        )


@router.post("/invoices/{invoice_id}/sync", response_model=SuccessResponse[schemas.InvoiceRead])
async def sync_invoice_status(
    invoice_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Sync invoice status with fiscal provider."""
    try:
        invoice = await invoice_svc.sync_invoice_status(db=db, invoice_id=invoice_id)
        return SuccessResponse(data=invoice, message="Invoice status synchronized successfully")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Status sync failed: {str(e)}"
        )


@router.get("/invoices/{invoice_id}/files", response_model=SuccessResponse[dict])
async def download_invoice_files(
    invoice_id: int,
    file_types: List[str] = Query(["xml", "pdf"], description="File types to download"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Download invoice files from fiscal provider."""
    try:
        files = await invoice_svc.download_invoice_files(
            db=db,
            invoice_id=invoice_id,
            file_types=file_types
        )
        return SuccessResponse(data=files, message="Invoice files retrieved successfully")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"File download failed: {str(e)}"
        )


@router.get("/invoices/report", response_model=SuccessResponse[schemas.InvoiceReport])
async def get_invoice_report(
    start_date: date = Query(..., description="Start date for report"),
    end_date: date = Query(..., description="End date for report"),
    issuer_tax_id: Optional[str] = Query(None, description="Filter by issuer tax ID"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Generate invoice report for a date range."""
    report = await invoice_svc.generate_invoice_report(
        db=db,
        start_date=start_date,
        end_date=end_date,
        issuer_tax_id=issuer_tax_id
    )
    return SuccessResponse(data=report, message="Invoice report generated successfully")


@router.delete("/invoices/{invoice_id}", response_model=SuccessResponse[dict])
async def delete_invoice(
    invoice_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    """Delete invoice."""
    invoice = await invoice_svc.exists(db=db, id=invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    await invoice_svc.remove(db=db, id=invoice_id)
    return SuccessResponse(data={"id": invoice_id}, message="Invoice deleted successfully")