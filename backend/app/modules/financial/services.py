from datetime import datetime, date, timedelta
from decimal import Decimal
from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, between, desc
from collections import defaultdict

from app.core.crud import CRUDBase
from .models import BankAccount, Transaction, Invoice, TRANSACTION_CATEGORIES
from .fiscal_gateway import fiscal_provider
from .schemas import (
    BankAccountCreate,
    TransactionCreate,
    InvoiceCreate,
    BankAccountFilter,
    TransactionFilter,
    InvoiceFilter
)


class BankAccountService(CRUDBase[BankAccount, BankAccountCreate, Any]):
    """Service for bank account management operations."""

    def __init__(self):
        super().__init__(BankAccount)

    async def get_accounts_with_balance_summary(
        self,
        db: AsyncSession,
        filters: Optional[BankAccountFilter] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """
        Get bank accounts with balance and transaction summaries.
        """
        # Get accounts
        accounts = await self.get_multi(db=db, skip=skip, limit=limit)

        # Enhance with transaction summaries
        enhanced_accounts = []
        for account in accounts:
            # Get recent transactions count
            result = await db.execute(
                select(func.count(Transaction.id))
                .where(Transaction.bank_account_id == account.id)
                .where(Transaction.created_at >= datetime.utcnow() - timedelta(days=30))
            )
            recent_transactions = result.scalar()

            enhanced_accounts.append({
                'account': account,
                'summary': {
                    'recent_transactions': recent_transactions or 0,
                    'is_overdrawn': account.current_balance < 0,
                    'needs_reconciliation': not account.is_reconciled
                }
            })

        return enhanced_accounts


class TransactionService(CRUDBase[Transaction, TransactionCreate, Any]):
    """Service for transaction management operations."""

    def __init__(self):
        super().__init__(Transaction)

    async def create_transaction_with_balance_update(
        self,
        db: AsyncSession,
        transaction_data: TransactionCreate
    ) -> Transaction:
        """
        Create a transaction and update the associated bank account balance.
        """
        # Create transaction
        transaction_dict = transaction_data.model_dump()
        transaction = Transaction(**transaction_dict)

        # Calculate net amount
        transaction.calculate_net_amount()

        db.add(transaction)
        await db.flush()  # Get transaction ID

        # Update bank account balance
        account = await db.get(BankAccount, transaction.bank_account_id)
        if account:
            if transaction.transaction_type == "income":
                account.update_balance(transaction.net_amount_cents)
            elif transaction.transaction_type == "expense":
                account.update_balance(-transaction.net_amount_cents)
            # Transfers would need special handling between accounts

        await db.commit()
        await db.refresh(transaction)

        return transaction

    async def get_cash_flow_summary(
        self,
        db: AsyncSession,
        start_date: date,
        end_date: date,
        account_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Generate cash flow summary for a date range.
        """
        query = select(
            Transaction.transaction_type,
            func.sum(Transaction.net_amount_cents).label('total_amount'),
            func.count(Transaction.id).label('transaction_count')
        ).where(
            and_(
                Transaction.transaction_date >= start_date,
                Transaction.transaction_date <= end_date,
                Transaction.status == "completed"
            )
        )

        if account_id:
            query = query.where(Transaction.bank_account_id == account_id)

        query = query.group_by(Transaction.transaction_type)

        result = await db.execute(query)
        cash_flow_data = {row.transaction_type: {
            'amount': Decimal(row.total_amount or 0) / 100,
            'count': row.transaction_count
        } for row in result}

        # Calculate net cash flow
        income = cash_flow_data.get('income', {}).get('amount', 0)
        expenses = cash_flow_data.get('expense', {}).get('amount', 0)
        net_flow = income - expenses

        return {
            'period': {'start': start_date, 'end': end_date},
            'income': cash_flow_data.get('income', {'amount': 0, 'count': 0}),
            'expenses': cash_flow_data.get('expense', {'amount': 0, 'count': 0}),
            'net_cash_flow': net_flow,
            'account_id': account_id
        }

    async def get_overdue_transactions(
        self,
        db: AsyncSession,
        account_id: Optional[int] = None
    ) -> List[Transaction]:
        """
        Get all overdue transactions (pending with past due dates).
        """
        query = select(Transaction).where(
            and_(
                Transaction.status == "pending",
                Transaction.due_date < datetime.utcnow().date()
            )
        )

        if account_id:
            query = query.where(Transaction.bank_account_id == account_id)

        result = await db.execute(query.order_by(Transaction.due_date))
        return result.scalars().all()

    async def reconcile_transactions(
        self,
        db: AsyncSession,
        transaction_ids: List[int],
        account_id: int
    ) -> Dict[str, Any]:
        """
        Mark transactions as reconciled.
        """
        result = await db.execute(
            select(Transaction).where(
                and_(
                    Transaction.id.in_(transaction_ids),
                    Transaction.bank_account_id == account_id
                )
            )
        )

        transactions = result.scalars().all()
        reconciled_count = 0

        for transaction in transactions:
            if not transaction.is_reconciled:
                transaction.is_reconciled = True
                transaction.updated_at = datetime.utcnow()
                reconciled_count += 1

        if reconciled_count > 0:
            await db.commit()

        return {
            'reconciled_count': reconciled_count,
            'total_requested': len(transaction_ids),
            'account_id': account_id
        }

    async def categorize_transactions(
        self,
        db: AsyncSession,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """
        Generate transaction categorization report.
        """
        query = select(
            Transaction.category,
            func.sum(Transaction.net_amount_cents).label('total_amount'),
            func.count(Transaction.id).label('transaction_count')
        ).where(Transaction.status == "completed")

        if start_date:
            query = query.where(Transaction.transaction_date >= start_date)
        if end_date:
            query = query.where(Transaction.transaction_date <= end_date)

        query = query.group_by(Transaction.category).order_by(desc('total_amount'))

        result = await db.execute(query)

        categories = {}
        for row in result:
            categories[row.category] = {
                'amount': Decimal(row.total_amount or 0) / 100,
                'count': row.transaction_count,
                'percentage': 0  # Will be calculated after
            }

        # Calculate percentages
        total_amount = sum(cat['amount'] for cat in categories.values())
        if total_amount > 0:
            for cat_data in categories.values():
                cat_data['percentage'] = round((cat_data['amount'] / total_amount) * 100, 2)

        return {
            'categories': categories,
            'total_amount': total_amount,
            'period': {'start': start_date, 'end': end_date}
        }


class InvoiceService(CRUDBase[Invoice, InvoiceCreate, Any]):
    """Service for invoice management and NF-e operations."""

    def __init__(self):
        super().__init__(Invoice)

    async def emit_invoice(
        self,
        db: AsyncSession,
        invoice_data: InvoiceCreate,
        created_by: str
    ) -> Invoice:
        """
        Create and emit an NF-e invoice.
        """
        # Create invoice record first
        invoice_dict = invoice_data.model_dump()
        invoice_dict['created_by'] = created_by
        invoice_dict['updated_by'] = created_by

        # Generate invoice number if not provided
        if not invoice_dict.get('invoice_number'):
            invoice_dict['invoice_number'] = await self._generate_invoice_number(db)

        invoice = Invoice(**invoice_dict)
        db.add(invoice)
        await db.commit()
        await db.refresh(invoice)

        # Prepare data for fiscal provider
        provider_data = self._prepare_invoice_for_provider(invoice)

        try:
            # Emit invoice via fiscal provider
            emission_result = await fiscal_provider.emit_invoice(provider_data)

            # Update invoice with provider response
            invoice.provider_id = emission_result.get("provider_id")
            invoice.provider_status = emission_result.get("status")
            invoice.provider_response = emission_result
            invoice.status = "processing"

            if emission_result.get("access_key"):
                invoice.access_key = emission_result["access_key"]
                invoice.invoice_number = emission_result.get("invoice_number", invoice.invoice_number)
                invoice.series = emission_result.get("series", invoice.series)

            if emission_result.get("authorization_protocol"):
                invoice.authorization_protocol = emission_result["authorization_protocol"]
                invoice.authorization_date = datetime.fromisoformat(emission_result["authorization_date"])
                invoice.status = "authorized"

            # Store file URLs if provided
            files = emission_result.get("files", {})
            if files.get("xml"):
                invoice.xml_url = files["xml"]
            if files.get("pdf"):
                invoice.pdf_url = files["pdf"]
            if files.get("danfe"):
                invoice.danfe_url = files["danfe"]

            await db.commit()
            await db.refresh(invoice)

        except Exception as e:
            # Mark invoice as failed
            invoice.status = "rejected"
            invoice.provider_response = {"error": str(e)}
            await db.commit()

        return invoice

    async def cancel_invoice(
        self,
        db: AsyncSession,
        invoice_id: int,
        reason: str,
        cancelled_by: str
    ) -> Invoice:
        """
        Cancel an NF-e invoice.
        """
        invoice = await self.get(db=db, id=invoice_id)

        if not invoice.can_be_cancelled():
            raise ValueError(f"Invoice cannot be cancelled in status: {invoice.status}")

        try:
            # Cancel via fiscal provider
            cancel_result = await fiscal_provider.cancel_invoice(
                invoice.provider_id or str(invoice.id),
                reason
            )

            if cancel_result.get("success"):
                invoice.status = "cancelled"
                invoice.cancellation_reason = reason
                invoice.cancellation_protocol = cancel_result.get("cancellation_protocol")
                invoice.cancellation_date = datetime.fromisoformat(cancel_result["cancellation_date"])
                invoice.updated_by = cancelled_by
            else:
                raise ValueError(cancel_result.get("message", "Cancellation failed"))

            await db.commit()
            await db.refresh(invoice)

        except Exception as e:
            raise ValueError(f"Invoice cancellation failed: {str(e)}")

        return invoice

    async def sync_invoice_status(
        self,
        db: AsyncSession,
        invoice_id: int
    ) -> Invoice:
        """
        Sync invoice status with fiscal provider.
        """
        invoice = await self.get(db=db, id=invoice_id)

        if not invoice.provider_id:
            raise ValueError("Invoice has no provider ID")

        try:
            status_result = await fiscal_provider.get_invoice_status(invoice.provider_id)

            if status_result.get("success"):
                invoice.provider_status = status_result.get("status")
                invoice.provider_response.update(status_result)

                # Update authorization details if newly authorized
                if status_result.get("status") == "authorized" and not invoice.is_authorized():
                    invoice.authorization_protocol = status_result.get("authorization_protocol")
                    invoice.authorization_date = datetime.fromisoformat(status_result["authorization_date"])
                    invoice.access_key = status_result.get("access_key")
                    invoice.status = "authorized"

                await db.commit()
                await db.refresh(invoice)

        except Exception as e:
            raise ValueError(f"Status sync failed: {str(e)}")

        return invoice

    async def download_invoice_files(
        self,
        db: AsyncSession,
        invoice_id: int,
        file_types: List[str]
    ) -> Dict[str, str]:
        """
        Download invoice files from fiscal provider.
        """
        invoice = await self.get(db=db, id=invoice_id)

        if not invoice.provider_id:
            raise ValueError("Invoice has no provider ID")

        try:
            files = await fiscal_provider.download_invoice_files(
                invoice.provider_id,
                file_types
            )

            # In a real implementation, you would upload these files to Supabase Storage
            # and update the invoice record with the new URLs

            return files

        except Exception as e:
            raise ValueError(f"File download failed: {str(e)}")

    async def get_invoices_by_status(
        self,
        db: AsyncSession,
        status: str,
        issuer_tax_id: Optional[str] = None
    ) -> List[Invoice]:
        """
        Get invoices by status, optionally filtered by issuer.
        """
        query = select(Invoice).where(Invoice.status == status)

        if issuer_tax_id:
            query = query.where(Invoice.issuer_tax_id == issuer_tax_id)

        query = query.order_by(desc(Invoice.created_at))

        result = await db.execute(query)
        return result.scalars().all()

    async def _generate_invoice_number(self, db: AsyncSession) -> str:
        """
        Generate a unique invoice number.
        Format: YYYYNNNNN (year + sequential number)
        """
        current_year = datetime.utcnow().year

        # Get the highest invoice number for this year
        result = await db.execute(
            select(func.max(func.cast(func.substr(Invoice.invoice_number, 5), Integer)))
            .where(func.substr(Invoice.invoice_number, 1, 4) == str(current_year))
        )

        next_number = (result.scalar() or 0) + 1
        return "04d"

    def _prepare_invoice_for_provider(self, invoice: Invoice) -> Dict[str, Any]:
        """
        Prepare invoice data for fiscal provider submission.
        """
        return {
            "invoice_number": invoice.invoice_number,
            "series": invoice.series,
            "issuer_tax_id": invoice.issuer_tax_id,
            "issuer_name": invoice.issuer_name,
            "recipient_tax_id": invoice.recipient_tax_id,
            "recipient_name": invoice.recipient_name,
            "total_amount": invoice.total_amount,
            "tax_amount": invoice.tax_amount,
            "items": invoice.items,
            "additional_info": invoice.additional_info,
            "cfop": invoice.cfop,
            "ncm": invoice.ncm,
            "operation_nature": invoice.operation_nature
        }

    async def generate_invoice_report(
        self,
        db: AsyncSession,
        start_date: date,
        end_date: date,
        issuer_tax_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generate invoice report for a date range.
        """
        query = select(
            Invoice.status,
            func.count(Invoice.id).label('count'),
            func.sum(Invoice.total_amount_cents).label('total_amount')
        ).where(
            and_(
                Invoice.created_at >= start_date,
                Invoice.created_at <= end_date
            )
        )

        if issuer_tax_id:
            query = query.where(Invoice.issuer_tax_id == issuer_tax_id)

        query = query.group_by(Invoice.status)

        result = await db.execute(query)

        report = {
            'period': {'start': start_date, 'end': end_date},
            'by_status': {},
            'totals': {'count': 0, 'amount': Decimal('0')}
        }

        for row in result:
            status_data = {
                'count': row.count,
                'amount': Decimal(row.total_amount or 0) / 100
            }
            report['by_status'][row.status] = status_data
            report['totals']['count'] += row.count
            report['totals']['amount'] += status_data['amount']

        return report


# Service instances
bank_account_service = BankAccountService()
transaction_service = TransactionService()
invoice_service = InvoiceService()