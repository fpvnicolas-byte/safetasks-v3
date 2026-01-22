from app.services.base import BaseService
from app.models.financial import TaxTable, Invoice, InvoiceItem
from app.models.transactions import Transaction
from app.schemas.financial import (
    TaxTableCreate, TaxTableUpdate,
    InvoiceCreate, InvoiceUpdate,
    ProjectFinancialReport
)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime


class TaxTableService(BaseService[TaxTable, TaxTableCreate, TaxTableUpdate]):
    """Service for Tax Table operations."""

    def __init__(self):
        super().__init__(TaxTable)


class InvoiceService(BaseService[Invoice, InvoiceCreate, InvoiceUpdate]):
    """Service for Invoice operations."""

    def __init__(self):
        super().__init__(Invoice)

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
        invoice_number = f"INV-{year}-{organization_id.hex[:8].upper()}"

        # Create invoice data
        invoice_data = {
            "client_id": obj_in.client_id,
            "project_id": obj_in.project_id,
            "invoice_number": invoice_number,
            "subtotal_cents": subtotal,
            "tax_amount_cents": 0,  # Will be calculated later if needed
            "total_amount_cents": subtotal,  # No taxes for now
            "currency": obj_in.currency,
            "issue_date": obj_in.issue_date or datetime.now().date(),
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
