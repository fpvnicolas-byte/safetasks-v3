from app.services.base import BaseService
from app.models.financial import TaxTable, Invoice, InvoiceItem, InvoiceStatusEnum
from app.models.transactions import Transaction
from app.schemas.financial import (
    TaxTableCreate, TaxTableUpdate,
    InvoiceCreate, InvoiceUpdate, InvoiceItemCreate, InvoiceItemUpdate,
    ProjectFinancialReport
)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime, date, timedelta
from app.core.config import settings


class TaxTableService(BaseService[TaxTable, TaxTableCreate, TaxTableUpdate]):
    """Service for Tax Table operations."""

    def __init__(self):
        super().__init__(TaxTable)


class InvoiceService(BaseService[Invoice, InvoiceCreate, InvoiceUpdate]):
    """Service for Invoice operations."""

    def __init__(self):
        super().__init__(Invoice)

    def _generate_invoice_number(self, organization_id: UUID) -> str:
        year = datetime.now().year
        return f"INV-{year}-{organization_id.hex[:8].upper()}"

    def _get_default_due_date(self, proposal_valid_until: Optional[date]) -> date:
        if proposal_valid_until:
            return proposal_valid_until
        return date.today() + timedelta(days=settings.DEFAULT_INVOICE_DUE_DAYS)

    def _build_items_from_proposal(self, proposal) -> list[InvoiceItemCreate]:
        items: list[InvoiceItemCreate] = []
        if getattr(proposal, "services", None):
            for service in proposal.services:
                unit_price = int(service.value_cents or 0)
                if unit_price <= 0:
                    continue
                items.append(
                    InvoiceItemCreate(
                        description=service.name,
                        quantity=1,
                        unit_price_cents=unit_price,
                        total_cents=unit_price,
                        project_id=proposal.project_id,
                        category=None
                    )
                )

        if items:
            return items

        total_amount = int(getattr(proposal, "total_amount_cents", 0) or 0)
        if total_amount > 0:
            return [
                InvoiceItemCreate(
                    description=proposal.title,
                    quantity=1,
                    unit_price_cents=total_amount,
                    total_cents=total_amount,
                    project_id=proposal.project_id,
                    category=None
                )
            ]

        raise ValueError("Proposal has no billable services or total amount")

    async def _validate_client_ownership(self, db: AsyncSession, organization_id: UUID, client_id: UUID):
        """Validate that client belongs to the organization."""
        from app.modules.commercial.service import client_service
        client = await client_service.get(db=db, organization_id=organization_id, id=client_id)
        if not client:
            raise ValueError("Client not found or does not belong to your organization")
        return client

    async def _validate_project_ownership(self, db: AsyncSession, organization_id: UUID, project_id: UUID):
        """Validate that project belongs to the organization."""
        from app.modules.commercial.service import project_service
        project = await project_service.get(db=db, organization_id=organization_id, id=project_id)
        if not project:
            raise ValueError("Project not found or does not belong to your organization")
        return project

    async def create(self, db, *, organization_id, obj_in):
        """Create invoice with validation and auto-calculation."""
        # Validate client ownership
        await self._validate_client_ownership(db, organization_id, obj_in.client_id)

        # Validate project ownership if provided
        if obj_in.project_id:
            await self._validate_project_ownership(db, organization_id, obj_in.project_id)

        # Calculate totals from items
        subtotal = sum(item.total_cents for item in obj_in.items)

        # Auto-generate invoice number (simplified)
        from datetime import datetime
        year = datetime.now().year
        # In a real implementation, you'd track sequential numbers per organization
        invoice_number = self._generate_invoice_number(organization_id)

        # Create invoice data
        invoice_data = {
            "client_id": obj_in.client_id,
            "project_id": obj_in.project_id,
            "proposal_id": getattr(obj_in, "proposal_id", None),
            "invoice_number": invoice_number,
            "subtotal_cents": subtotal,
            "tax_amount_cents": 0,  # Will be calculated later if needed
            "total_amount_cents": subtotal,  # No taxes for now
            "currency": obj_in.currency,
            "issue_date": datetime.now().date(),  # Always use today's date for new invoices
            "due_date": obj_in.due_date,
            "description": obj_in.description,
            "notes": obj_in.notes
        }

        # Create invoice
        invoice = await super().create(db=db, organization_id=organization_id, obj_in=invoice_data)

        # Create invoice items
        for item_data in obj_in.items:
            item = InvoiceItem(
                organization_id=organization_id,
                invoice_id=invoice.id,
                description=item_data.description,
                quantity=item_data.quantity,
                unit_price_cents=item_data.unit_price_cents,
                total_cents=item_data.total_cents,
                project_id=item_data.project_id,
                category=item_data.category
            )
            db.add(item)

        await db.commit()
        await db.refresh(invoice)

        return invoice

    async def create_from_proposal(
        self,
        db: AsyncSession,
        *,
        organization_id: UUID,
        proposal,
        status: InvoiceStatusEnum = InvoiceStatusEnum.sent,
        due_date: Optional[date] = None
    ) -> Invoice:
        """Create a sent invoice from a proposal with idempotency."""
        result = await db.execute(
            select(Invoice).where(
                Invoice.organization_id == organization_id,
                Invoice.proposal_id == proposal.id
            )
        )
        existing = result.scalar_one_or_none()
        if existing:
            return existing

        await self._validate_client_ownership(db, organization_id, proposal.client_id)
        if proposal.project_id:
            await self._validate_project_ownership(db, organization_id, proposal.project_id)

        items = self._build_items_from_proposal(proposal)
        subtotal = sum(item.total_cents for item in items)

        resolved_due_date = due_date or self._get_default_due_date(proposal.valid_until)

        invoice_data = {
            "client_id": proposal.client_id,
            "project_id": proposal.project_id,
            "proposal_id": proposal.id,
            "invoice_number": self._generate_invoice_number(organization_id),
            "status": status,
            "subtotal_cents": subtotal,
            "tax_amount_cents": 0,
            "total_amount_cents": subtotal,
            "currency": proposal.currency or "BRL",
            "issue_date": date.today(),
            "due_date": resolved_due_date,
            "description": proposal.description,
            "notes": None
        }

        invoice = await super().create(db=db, organization_id=organization_id, obj_in=invoice_data)

        for item in items:
            db.add(
                InvoiceItem(
                    organization_id=organization_id,
                    invoice_id=invoice.id,
                    description=item.description,
                    quantity=item.quantity,
                    unit_price_cents=item.unit_price_cents,
                    total_cents=item.total_cents,
                    project_id=item.project_id,
                    category=item.category
                )
            )

        await db.flush()
        await db.refresh(invoice)
        return invoice

    async def add_item(
        self,
        db: AsyncSession,
        invoice_id: UUID,
        organization_id: UUID,
        item_in: InvoiceItemCreate
    ) -> InvoiceItem:
        """Add a new item to an existing invoice and recalculate totals."""
        from app.models.financial import Invoice as InvoiceModel, InvoiceItem, InvoiceStatusEnum
        from sqlalchemy import select

        # Get invoice and verify ownership
        result = await db.execute(
            select(InvoiceModel).where(
                InvoiceModel.id == invoice_id,
                InvoiceModel.organization_id == organization_id
            )
        )
        invoice = result.scalar_one_or_none()

        if not invoice:
            raise ValueError("Invoice not found")

        # Only allow adding items to draft invoices
        if invoice.status != InvoiceStatusEnum.draft:
            raise ValueError("Can only add items to draft invoices")

        # Create invoice item
        item = InvoiceItem(
            organization_id=organization_id,
            invoice_id=invoice_id,
            **item_in.model_dump()
        )
        db.add(item)

        # Recalculate invoice totals
        invoice.subtotal_cents += item.total_cents
        invoice.total_amount_cents = invoice.subtotal_cents + invoice.tax_amount_cents

        await db.commit()
        await db.refresh(item)
        return item

    async def update_item(
        self,
        db: AsyncSession,
        invoice_id: UUID,
        item_id: UUID,
        organization_id: UUID,
        item_in: InvoiceItemUpdate
    ) -> InvoiceItem:
        """Update an invoice item and recalculate invoice totals."""
        from app.models.financial import Invoice as InvoiceModel, InvoiceItem, InvoiceStatusEnum
        from sqlalchemy import select

        # Get invoice and verify ownership
        result = await db.execute(
            select(InvoiceModel).where(
                InvoiceModel.id == invoice_id,
                InvoiceModel.organization_id == organization_id
            )
        )
        invoice = result.scalar_one_or_none()

        if not invoice:
            raise ValueError("Invoice not found")

        # Only allow updating items on draft invoices
        if invoice.status != InvoiceStatusEnum.draft:
            raise ValueError("Can only update items on draft invoices")

        # Get item
        result = await db.execute(
            select(InvoiceItem).where(
                InvoiceItem.id == item_id,
                InvoiceItem.invoice_id == invoice_id,
                InvoiceItem.organization_id == organization_id
            )
        )
        item = result.scalar_one_or_none()

        if not item:
            raise ValueError("Invoice item not found")

        # Store old total for recalculation
        old_total = item.total_cents

        # Update item fields
        update_data = item_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(item, field, value)

        # Recalculate invoice totals
        invoice.subtotal_cents = invoice.subtotal_cents - old_total + item.total_cents
        invoice.total_amount_cents = invoice.subtotal_cents + invoice.tax_amount_cents

        await db.commit()
        await db.refresh(item)
        return item

    async def delete_item(
        self,
        db: AsyncSession,
        invoice_id: UUID,
        item_id: UUID,
        organization_id: UUID
    ) -> InvoiceItem:
        """Delete an invoice item and recalculate invoice totals."""
        from app.models.financial import Invoice as InvoiceModel, InvoiceItem, InvoiceStatusEnum
        from sqlalchemy import select

        # Get invoice and verify ownership
        result = await db.execute(
            select(InvoiceModel).where(
                InvoiceModel.id == invoice_id,
                InvoiceModel.organization_id == organization_id
            )
        )
        invoice = result.scalar_one_or_none()

        if not invoice:
            raise ValueError("Invoice not found")

        # Only allow deleting items from draft invoices
        if invoice.status != InvoiceStatusEnum.draft:
            raise ValueError("Can only delete items from draft invoices")

        # Get item
        result = await db.execute(
            select(InvoiceItem).where(
                InvoiceItem.id == item_id,
                InvoiceItem.invoice_id == invoice_id,
                InvoiceItem.organization_id == organization_id
            )
        )
        item = result.scalar_one_or_none()

        if not item:
            raise ValueError("Invoice item not found")

        # Recalculate invoice totals
        invoice.subtotal_cents -= item.total_cents
        invoice.total_amount_cents = invoice.subtotal_cents + invoice.tax_amount_cents

        # Delete item
        await db.delete(item)
        await db.commit()

        return item


class FinancialReportService:
    """Service for generating financial reports and P&L analysis."""

    def __init__(self):
        self.invoice_service = InvoiceService()

    async def get_project_financial_report(
        self,
        db: AsyncSession,
        *,
        organization_id: UUID,
        project_id: UUID
    ) -> ProjectFinancialReport:
        """
        Generate comprehensive financial report for a project.
        Includes revenue, expenses by category, and profitability analysis.
        """
        # Validate project ownership
        from app.modules.commercial.service import project_service
        project = await project_service.get(db=db, organization_id=organization_id, id=project_id)
        if not project:
            raise ValueError("Project not found or does not belong to your organization")

        # Get all invoices for the project
        invoices_query = select(Invoice).where(
            and_(
                Invoice.organization_id == organization_id,
                Invoice.project_id == project_id
            )
        )
        invoices_result = await db.execute(invoices_query)
        invoices = invoices_result.scalars().all()

        # Calculate revenue metrics
        total_revenue = sum(inv.total_amount_cents for inv in invoices)
        paid_revenue = sum(inv.total_amount_cents for inv in invoices if inv.status == "paid")
        outstanding_revenue = total_revenue - paid_revenue

        # Get all transactions (expenses) for the project
        expenses_query = select(
            Transaction.category,
            func.sum(Transaction.amount_cents).label('total_cents')
        ).where(
            and_(
                Transaction.organization_id == organization_id,
                Transaction.project_id == project_id,
                Transaction.type == "expense"
            )
        ).group_by(Transaction.category)

        expenses_result = await db.execute(expenses_query)
        expenses_by_category = {row.category: row.total_cents for row in expenses_result}

        total_expenses = sum(expenses_by_category.values())

        # Calculate profitability
        gross_profit = total_revenue - total_expenses

        # For now, simplified tax calculation (0)
        # In a real implementation, you'd apply tax rules based on TaxTable
        tax_amount = 0
        net_profit = gross_profit - tax_amount

        # Get detailed breakdowns
        invoice_breakdown = [
            {
                "invoice_id": str(inv.id),
                "invoice_number": inv.invoice_number,
                "amount_cents": inv.total_amount_cents,
                "status": inv.status,
                "issue_date": inv.issue_date.isoformat(),
                "due_date": inv.due_date.isoformat()
            }
            for inv in invoices
        ]

        # Get expense transactions for detailed breakdown
        expense_transactions_query = select(Transaction).where(
            and_(
                Transaction.organization_id == organization_id,
                Transaction.project_id == project_id,
                Transaction.type == "expense"
            )
        ).order_by(Transaction.transaction_date.desc())

        expense_transactions_result = await db.execute(expense_transactions_query)
        expense_transactions = expense_transactions_result.scalars().all()

        expense_breakdown = [
            {
                "transaction_id": str(tx.id),
                "category": tx.category,
                "amount_cents": tx.amount_cents,
                "description": tx.description,
                "date": tx.transaction_date.isoformat()
            }
            for tx in expense_transactions
        ]

        return ProjectFinancialReport(
            project_id=project_id,
            project_title=project.title,
            currency="BRL",
            total_revenue_cents=total_revenue,
            paid_revenue_cents=paid_revenue,
            outstanding_revenue_cents=outstanding_revenue,
            expenses_by_category=expenses_by_category,
            total_expenses_cents=total_expenses,
            gross_profit_cents=gross_profit,
            tax_amount_cents=tax_amount,
            net_profit_cents=net_profit,
            invoice_breakdown=invoice_breakdown,
            expense_breakdown=expense_breakdown,
            generated_at=datetime.now()
        )

    async def get_expense_summary_by_category(
        self,
        db: AsyncSession,
        *,
        organization_id: UUID,
        project_ids: Optional[List[UUID]] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Get expense summary across projects or for specific projects.
        Useful for organization-wide financial reporting.
        """
        # Build query conditions
        conditions = [Transaction.organization_id == organization_id, Transaction.type == "expense"]

        if project_ids:
            conditions.append(Transaction.project_id.in_(project_ids))

        if date_from:
            conditions.append(Transaction.transaction_date >= date_from.date())

        if date_to:
            conditions.append(Transaction.transaction_date <= date_to.date())

        # Query expenses by category
        expenses_query = select(
            Transaction.category,
            func.sum(Transaction.amount_cents).label('total_cents'),
            func.count(Transaction.id).label('transaction_count')
        ).where(and_(*conditions)).group_by(Transaction.category)

        expenses_result = await db.execute(expenses_query)
        expenses_summary = [
            {
                "category": row.category,
                "total_cents": row.total_cents,
                "transaction_count": row.transaction_count,
                "formatted_total": f"R$ {row.total_cents / 100:.2f}"
            }
            for row in expenses_result
        ]

        # Calculate totals
        total_expenses = sum(item["total_cents"] for item in expenses_summary)
        total_transactions = sum(item["transaction_count"] for item in expenses_summary)

        return {
            "organization_id": str(organization_id),
            "project_ids": [str(pid) for pid in project_ids] if project_ids else None,
            "date_range": {
                "from": date_from.isoformat() if date_from else None,
                "to": date_to.isoformat() if date_to else None
            },
            "expenses_by_category": expenses_summary,
            "total_expenses_cents": total_expenses,
            "total_transactions": total_transactions,
            "formatted_total": f"R$ {total_expenses / 100:.2f}",
            "generated_at": datetime.now().isoformat()
        }


# Service instances
tax_table_service = TaxTableService()
invoice_service = InvoiceService()
financial_report_service = FinancialReportService()
