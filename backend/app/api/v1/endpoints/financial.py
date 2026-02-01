from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    get_current_organization,
    require_finance_or_admin,
    require_admin_producer_or_finance,
    require_billing_active,
)
from app.db.session import get_db
from app.services.financial_advanced import (
    tax_table_service, invoice_service, financial_report_service
)
from app.services.financial import transaction_service
from app.schemas.financial import (
    TaxTable, TaxTableCreate, TaxTableUpdate,
    Invoice, InvoiceCreate, InvoiceUpdate, InvoiceWithItems,
    InvoiceItem, InvoiceItemCreate, InvoiceItemUpdate, InvoiceStatus,
    ProjectFinancialReport,
    ProjectBudgetLineCreate,
    ProjectBudgetLineUpdate,
    ProjectBudgetLineResponse,
    ProjectBudgetSummary,
    CategoryBudgetSummary,
    BudgetCategoryEnum,
)
from app.models.financial import ProjectBudgetLine
from sqlalchemy import select, func as sql_func


router = APIRouter()


@router.get(
    "/projects/{project_id}/financial-report",
    response_model=ProjectFinancialReport,
    dependencies=[Depends(require_admin_producer_or_finance)]
)
async def get_project_financial_report(
    project_id: UUID,
    organization_id: UUID = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
) -> ProjectFinancialReport:
    """
    Get comprehensive financial report for a project.
    Includes revenue, expenses by category, and profitability analysis.
    Available to all users (read-only financial data).
    """
    try:
        report = await financial_report_service.get_project_financial_report(
            db=db,
            organization_id=organization_id,
            project_id=project_id
        )
        return report
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.get("/tax-tables/", response_model=List[TaxTable], dependencies=[Depends(require_admin_producer_or_finance)])
async def get_tax_tables(
    organization_id: UUID = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    active_only: bool = Query(True, description="Show only active tax tables"),
) -> List[TaxTable]:
    """
    Get all tax tables for the current user's organization.
    """
    filters = {}
    if active_only:
        filters["is_active"] = True

    tax_tables = await tax_table_service.get_multi(
        db=db,
        organization_id=organization_id,
        skip=skip,
        limit=limit,
        filters=filters
    )
    return tax_tables


@router.post(
    "/tax-tables/",
    response_model=TaxTable,
    dependencies=[Depends(require_finance_or_admin), Depends(require_billing_active)]
)
async def create_tax_table(
    tax_table_in: TaxTableCreate,
    organization_id: UUID = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
) -> TaxTable:
    """
    Create a new tax table in the current user's organization.
    Only admins and managers can create tax tables.
    """
    tax_table = await tax_table_service.create(
        db=db,
        organization_id=organization_id,
        obj_in=tax_table_in
    )
    return tax_table


@router.get("/tax-tables/{tax_table_id}", response_model=TaxTable, dependencies=[Depends(require_admin_producer_or_finance)])
async def get_tax_table(
    tax_table_id: UUID,
    organization_id: UUID = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
) -> TaxTable:
    """
    Get tax table by ID (must belong to current user's organization).
    """
    tax_table = await tax_table_service.get(
        db=db,
        organization_id=organization_id,
        id=tax_table_id
    )

    if not tax_table:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tax table not found"
        )

    return tax_table


@router.put(
    "/tax-tables/{tax_table_id}",
    response_model=TaxTable,
    dependencies=[Depends(require_finance_or_admin), Depends(require_billing_active)]
)
async def update_tax_table(
    tax_table_id: UUID,
    tax_table_in: TaxTableUpdate,
    organization_id: UUID = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
) -> TaxTable:
    """
    Update tax table (must belong to current user's organization).
    Only admins and managers can update tax tables.
    """
    tax_table = await tax_table_service.update(
        db=db,
        organization_id=organization_id,
        id=tax_table_id,
        obj_in=tax_table_in
    )

    if not tax_table:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tax table not found"
        )

    return tax_table


@router.delete(
    "/tax-tables/{tax_table_id}",
    response_model=TaxTable,
    dependencies=[Depends(require_finance_or_admin), Depends(require_billing_active)]
)
async def delete_tax_table(
    tax_table_id: UUID,
    organization_id: UUID = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
) -> TaxTable:
    """
    Delete tax table (must belong to current user's organization).
    Only admins and managers can delete tax tables.
    """
    tax_table = await tax_table_service.remove(
        db=db,
        organization_id=organization_id,
        id=tax_table_id
    )

    if not tax_table:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tax table not found"
        )

    return tax_table


@router.get("/invoices/", response_model=List[InvoiceWithItems], dependencies=[Depends(require_admin_producer_or_finance)])
async def get_invoices(
    organization_id: UUID = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    client_id: UUID = None,
    project_id: UUID = None,
    status: str = Query(None, regex="^(draft|sent|paid|overdue|cancelled)$"),
) -> List[InvoiceWithItems]:
    """
    Get all invoices for the current user's organization with client and project details.
    """
    from sqlalchemy.orm import selectinload
    from app.models.financial import Invoice as InvoiceModel
    from app.models.projects import Project

    filters = {}
    if client_id:
        filters["client_id"] = client_id
    if project_id:
        filters["project_id"] = project_id
    if status:
        filters["status"] = status

    invoices = await invoice_service.get_multi(
        db=db,
        organization_id=organization_id,
        skip=skip,
        limit=limit,
        filters=filters,
        options=[
            selectinload(InvoiceModel.items),
            selectinload(InvoiceModel.client),
            selectinload(InvoiceModel.project).selectinload(Project.services)
        ]
    )
    return invoices


@router.post(
    "/invoices/",
    response_model=Invoice,
    dependencies=[Depends(require_finance_or_admin), Depends(require_billing_active)]
)
async def create_invoice(
    invoice_in: InvoiceCreate,
    organization_id: UUID = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
) -> Invoice:
    """
    Create a new invoice in the current user's organization.
    Only admins and managers can create invoices.
    """
    # Debug logging
    import json
    print(f"DEBUG: Received invoice data: {json.dumps(invoice_in.model_dump(), indent=2, default=str)}")

    try:
        invoice = await invoice_service.create(
            db=db,
            organization_id=organization_id,
            obj_in=invoice_in
        )
        return invoice
    except ValueError as e:
        print(f"DEBUG: ValueError in create_invoice: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        print(f"DEBUG: Unexpected error in create_invoice: {type(e).__name__}: {str(e)}")
        raise


@router.get("/invoices/{invoice_id}", response_model=InvoiceWithItems, dependencies=[Depends(require_admin_producer_or_finance)])
async def get_invoice(
    invoice_id: UUID,
    organization_id: UUID = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
) -> InvoiceWithItems:
    """
    Get invoice by ID with items, client, and project (must belong to current user's organization).
    """
    from sqlalchemy.orm import selectinload
    from app.models.financial import Invoice as InvoiceModel
    from app.models.projects import Project

    invoice_with_items = await invoice_service.get(
        db=db,
        organization_id=organization_id,
        id=invoice_id,
        options=[
            selectinload(InvoiceModel.items),
            selectinload(InvoiceModel.client),
            selectinload(InvoiceModel.project).selectinload(Project.services)
        ]
    )

    if not invoice_with_items:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found"
        )

    return invoice_with_items


@router.put(
    "/invoices/{invoice_id}",
    response_model=Invoice,
    dependencies=[Depends(require_finance_or_admin), Depends(require_billing_active)]
)
async def update_invoice(
    invoice_id: UUID,
    invoice_in: InvoiceUpdate,
    organization_id: UUID = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
) -> Invoice:
    """
    Update invoice (must belong to current user's organization).
    Only admins and managers can update invoices.
    """
    existing_invoice = await invoice_service.get(
        db=db,
        organization_id=organization_id,
        id=invoice_id
    )
    if not existing_invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found"
        )

    previous_status = existing_invoice.status
    previous_status_value = previous_status.value if hasattr(previous_status, "value") else str(previous_status)

    invoice = await invoice_service.update(
        db=db,
        organization_id=organization_id,
        id=invoice_id,
        obj_in=invoice_in
    )
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found"
        )

    from app.core.config import settings
    if (
        settings.FINANCIAL_AUTOMATION_ENABLED
        and invoice_in.status == InvoiceStatus.paid
        and previous_status_value != InvoiceStatus.paid.value
    ):
        try:
            await transaction_service.create_income_from_invoice(
                db=db,
                organization_id=organization_id,
                invoice=invoice
            )
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )

    return invoice


@router.delete(
    "/invoices/{invoice_id}",
    response_model=Invoice,
    dependencies=[Depends(require_finance_or_admin), Depends(require_billing_active)]
)
async def delete_invoice(
    invoice_id: UUID,
    organization_id: UUID = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
) -> Invoice:
    """
    Delete invoice (must belong to current user's organization).
    Only admins and managers can delete invoices.
    """
    invoice = await invoice_service.remove(
        db=db,
        organization_id=organization_id,
        id=invoice_id
    )

    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found"
        )

    return invoice


@router.post(
    "/invoices/{invoice_id}/items",
    response_model=InvoiceItem,
    dependencies=[Depends(require_finance_or_admin), Depends(require_billing_active)]
)
async def add_invoice_item(
    invoice_id: UUID,
    item_in: InvoiceItemCreate,
    organization_id: UUID = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
) -> InvoiceItem:
    """
    Add a new item to an invoice. Only works on draft invoices.
    Automatically recalculates invoice totals.
    Only admins and managers can add items.
    """
    try:
        item = await invoice_service.add_item(
            db=db,
            invoice_id=invoice_id,
            organization_id=organization_id,
            item_in=item_in
        )
        return item
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.put(
    "/invoices/{invoice_id}/items/{item_id}",
    response_model=InvoiceItem,
    dependencies=[Depends(require_finance_or_admin), Depends(require_billing_active)]
)
async def update_invoice_item(
    invoice_id: UUID,
    item_id: UUID,
    item_in: InvoiceItemUpdate,
    organization_id: UUID = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
) -> InvoiceItem:
    """
    Update an invoice item. Only works on draft invoices.
    Automatically recalculates invoice totals.
    Only admins and managers can update items.
    """
    try:
        item = await invoice_service.update_item(
            db=db,
            invoice_id=invoice_id,
            item_id=item_id,
            organization_id=organization_id,
            item_in=item_in
        )
        return item
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.delete(
    "/invoices/{invoice_id}/items/{item_id}",
    response_model=InvoiceItem,
    dependencies=[Depends(require_finance_or_admin), Depends(require_billing_active)]
)
async def delete_invoice_item(
    invoice_id: UUID,
    item_id: UUID,
    organization_id: UUID = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
) -> InvoiceItem:
    """
    Delete an invoice item. Only works on draft invoices.
    Automatically recalculates invoice totals.
    Only admins and managers can delete items.
    """
    try:
        item = await invoice_service.delete_item(
            db=db,
            invoice_id=invoice_id,
            item_id=item_id,
            organization_id=organization_id
        )
        return item
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/expense-summary", dependencies=[Depends(require_admin_producer_or_finance)])
async def get_expense_summary(
    organization_id: UUID = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
    project_ids: List[UUID] = Query(None, description="Filter by project IDs"),
    date_from: str = Query(None, description="Filter from date (YYYY-MM-DD)"),
    date_to: str = Query(None, description="Filter to date (YYYY-MM-DD)"),
):
    """
    Get expense summary by category across projects.
    Useful for organization-wide financial reporting.
    """
    from datetime import datetime

    # Parse dates
    date_from_parsed = datetime.fromisoformat(date_from) if date_from else None
    date_to_parsed = datetime.fromisoformat(date_to) if date_to else None

    try:
        summary = await financial_report_service.get_expense_summary_by_category(
            db=db,
            organization_id=organization_id,
            project_ids=project_ids,
            date_from=date_from_parsed,
            date_to=date_to_parsed
        )
        return summary
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate expense summary: {str(e)}"
        )


# Budget Line Endpoints
@router.get("/projects/{project_id}/budget", response_model=ProjectBudgetSummary, dependencies=[Depends(require_admin_producer_or_finance)])
async def get_project_budget(
    project_id: UUID,
    organization_id: UUID = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
):
    """Get complete project budget with all lines and actual spending."""
    from app.models.transactions import Transaction

    # Get all budget lines for project
    result = await db.execute(
        select(ProjectBudgetLine)
        .where(ProjectBudgetLine.project_id == project_id)
        .where(ProjectBudgetLine.organization_id == organization_id)
        .order_by(ProjectBudgetLine.sort_order, ProjectBudgetLine.created_at)
    )
    budget_lines = result.scalars().all()

    # Get actual spending per budget line
    actual_by_line = {}
    if budget_lines:
        line_ids = [line.id for line in budget_lines]
        result = await db.execute(
            select(
                Transaction.budget_line_id,
                sql_func.sum(Transaction.amount_cents).label('total')
            )
            .where(Transaction.budget_line_id.in_(line_ids))
            .where(Transaction.type == 'expense')
            .group_by(Transaction.budget_line_id)
        )
        for row in result:
            actual_by_line[row.budget_line_id] = row.total or 0

    # Build response with computed fields
    lines_response = []
    category_totals = {}

    for line in budget_lines:
        actual = actual_by_line.get(line.id, 0)
        variance = line.estimated_amount_cents - actual
        variance_pct = (variance / line.estimated_amount_cents * 100) if line.estimated_amount_cents > 0 else 0

        lines_response.append(ProjectBudgetLineResponse(
            id=line.id,
            project_id=line.project_id,
            organization_id=line.organization_id,
            category=line.category,
            description=line.description,
            estimated_amount_cents=line.estimated_amount_cents,
            stakeholder_id=line.stakeholder_id,
            supplier_id=line.supplier_id,
            notes=line.notes,
            sort_order=line.sort_order,
            created_at=line.created_at,
            updated_at=line.updated_at,
            actual_amount_cents=actual,
            variance_cents=variance,
            variance_percentage=round(variance_pct, 2)
        ))

        # Aggregate by category
        cat = line.category.value if hasattr(line.category, 'value') else str(line.category)
        if cat not in category_totals:
            category_totals[cat] = {'estimated': 0, 'actual': 0}
        category_totals[cat]['estimated'] += line.estimated_amount_cents
        category_totals[cat]['actual'] += actual

    # Build category summaries
    by_category = []
    for cat, totals in category_totals.items():
        variance = totals['estimated'] - totals['actual']
        variance_pct = (variance / totals['estimated'] * 100) if totals['estimated'] > 0 else 0
        by_category.append(CategoryBudgetSummary(
            category=BudgetCategoryEnum(cat),
            estimated_cents=totals['estimated'],
            actual_cents=totals['actual'],
            variance_cents=variance,
            variance_percentage=round(variance_pct, 2)
        ))

    # Calculate totals
    total_estimated = sum(line.estimated_amount_cents for line in budget_lines)
    total_actual = sum(actual_by_line.values())
    total_variance = total_estimated - total_actual
    total_variance_pct = (total_variance / total_estimated * 100) if total_estimated > 0 else 0

    return ProjectBudgetSummary(
        project_id=project_id,
        total_estimated_cents=total_estimated,
        total_actual_cents=total_actual,
        total_variance_cents=total_variance,
        variance_percentage=round(total_variance_pct, 2),
        by_category=by_category,
        lines=lines_response
    )


@router.post(
    "/projects/{project_id}/budget-lines",
    response_model=ProjectBudgetLineResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_finance_or_admin), Depends(require_billing_active)]
)
async def create_budget_line(
    project_id: UUID,
    budget_line_in: ProjectBudgetLineCreate,
    organization_id: UUID = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
):
    """Create a new budget line for a project."""
    # Verify project exists
    from app.models.projects import Project
    result = await db.execute(
        select(Project)
        .where(Project.id == project_id)
        .where(Project.organization_id == organization_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Project not found")

    budget_line = ProjectBudgetLine(
        organization_id=organization_id,
        project_id=project_id,
        category=budget_line_in.category,
        description=budget_line_in.description,
        estimated_amount_cents=budget_line_in.estimated_amount_cents,
        stakeholder_id=budget_line_in.stakeholder_id,
        supplier_id=budget_line_in.supplier_id,
        notes=budget_line_in.notes,
        sort_order=budget_line_in.sort_order
    )

    db.add(budget_line)
    await db.commit()
    await db.refresh(budget_line)

    return ProjectBudgetLineResponse(
        id=budget_line.id,
        project_id=budget_line.project_id,
        organization_id=budget_line.organization_id,
        category=budget_line.category,
        description=budget_line.description,
        estimated_amount_cents=budget_line.estimated_amount_cents,
        stakeholder_id=budget_line.stakeholder_id,
        supplier_id=budget_line.supplier_id,
        notes=budget_line.notes,
        sort_order=budget_line.sort_order,
        created_at=budget_line.created_at,
        updated_at=budget_line.updated_at,
        actual_amount_cents=0,
        variance_cents=budget_line.estimated_amount_cents,
        variance_percentage=100.0
    )


@router.put(
    "/budget-lines/{line_id}",
    response_model=ProjectBudgetLineResponse,
    dependencies=[Depends(require_finance_or_admin), Depends(require_billing_active)]
)
async def update_budget_line(
    line_id: UUID,
    budget_line_in: ProjectBudgetLineUpdate,
    organization_id: UUID = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
):
    """Update a budget line."""
    result = await db.execute(
        select(ProjectBudgetLine)
        .where(ProjectBudgetLine.id == line_id)
        .where(ProjectBudgetLine.organization_id == organization_id)
    )
    budget_line = result.scalar_one_or_none()

    if not budget_line:
        raise HTTPException(status_code=404, detail="Budget line not found")

    update_data = budget_line_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(budget_line, field, value)

    await db.commit()
    await db.refresh(budget_line)

    # Get actual spending
    from app.models.transactions import Transaction
    result = await db.execute(
        select(sql_func.sum(Transaction.amount_cents))
        .where(Transaction.budget_line_id == line_id)
        .where(Transaction.type == 'expense')
    )
    actual = result.scalar() or 0

    variance = budget_line.estimated_amount_cents - actual
    variance_pct = (variance / budget_line.estimated_amount_cents * 100) if budget_line.estimated_amount_cents > 0 else 0

    return ProjectBudgetLineResponse(
        id=budget_line.id,
        project_id=budget_line.project_id,
        organization_id=budget_line.organization_id,
        category=budget_line.category,
        description=budget_line.description,
        estimated_amount_cents=budget_line.estimated_amount_cents,
        stakeholder_id=budget_line.stakeholder_id,
        supplier_id=budget_line.supplier_id,
        notes=budget_line.notes,
        sort_order=budget_line.sort_order,
        created_at=budget_line.created_at,
        updated_at=budget_line.updated_at,
        actual_amount_cents=actual,
        variance_cents=variance,
        variance_percentage=round(variance_pct, 2)
    )


@router.delete(
    "/budget-lines/{line_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_finance_or_admin), Depends(require_billing_active)]
)
async def delete_budget_line(
    line_id: UUID,
    organization_id: UUID = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
):
    """Delete a budget line."""
    result = await db.execute(
        select(ProjectBudgetLine)
        .where(ProjectBudgetLine.id == line_id)
        .where(ProjectBudgetLine.organization_id == organization_id)
    )
    budget_line = result.scalar_one_or_none()

    if not budget_line:
        raise HTTPException(status_code=404, detail="Budget line not found")

    await db.delete(budget_line)
    await db.commit()
