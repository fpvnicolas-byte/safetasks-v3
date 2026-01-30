from typing import List, Optional, Dict, Any
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func, and_, text
from sqlalchemy.orm import selectinload

from app.services.base import BaseService
from app.models.bank_accounts import BankAccount
from app.models.transactions import Transaction
from app.models.projects import Project
from app.schemas.bank_accounts import BankAccountCreate, BankAccountUpdate
from app.schemas.transactions import TransactionCreate, TransactionUpdate


class BankAccountService(BaseService[BankAccount, BankAccountCreate, BankAccountUpdate]):
    """Service for Bank Account operations with balance management."""

    def __init__(self):
        super().__init__(BankAccount)

    async def create(
        self,
        db: AsyncSession,
        *,
        organization_id: UUID,
        obj_in: BankAccountCreate
    ) -> BankAccount:
        """Create a new bank account with zero balance."""
        # Ensure balance is always 0 for new accounts
        account_data = obj_in.dict()
        account_data["balance_cents"] = 0

        db_obj = self.model(**account_data)
        db_obj.organization_id = organization_id
        db.add(db_obj)
        await db.flush()
        await db.refresh(db_obj)
        return db_obj

    async def update_balance(
        self,
        db: AsyncSession,
        *,
        organization_id: UUID,
        bank_account_id: UUID,
        amount_cents: int
    ) -> BankAccount:
        """Update bank account balance atomically."""
        # Get current account
        account = await self.get(db=db, organization_id=organization_id, id=bank_account_id)
        if not account:
            raise ValueError("Bank account not found")

        # Update balance
        new_balance = account.balance_cents + amount_cents

        # Update in database
        query = (
            update(BankAccount)
            .where(
                and_(
                    BankAccount.id == bank_account_id,
                    BankAccount.organization_id == organization_id
                )
            )
            .values(balance_cents=new_balance)
        )

        await db.execute(query)

        # Return updated account
        return await self.get(db=db, organization_id=organization_id, id=bank_account_id)


class TransactionService(BaseService[Transaction, TransactionCreate, TransactionUpdate]):
    """Service for Transaction operations with atomic balance updates."""

    def __init__(self):
        super().__init__(Transaction)

    async def create(
        self,
        db: AsyncSession,
        *,
        organization_id: UUID,
        obj_in: TransactionCreate
    ) -> Transaction:
        """Create a transaction and update bank account balance atomically."""
        # Validate that bank_account belongs to the organization
        bank_account = await self._validate_bank_account_ownership(
            db, organization_id, obj_in.bank_account_id
        )

        # Validate that project (if provided) belongs to the organization
        if obj_in.project_id:
            await self._validate_project_ownership(db, organization_id, obj_in.project_id)

        # Validate that supplier (if provided) belongs to the organization
        if hasattr(obj_in, 'supplier_id') and obj_in.supplier_id:
            await self._validate_supplier_ownership(db, organization_id, obj_in.supplier_id)

        # Calculate balance change
        balance_change = obj_in.amount_cents
        if obj_in.type == "expense":
            balance_change = -balance_change

        # Create the transaction
        transaction_data = obj_in.dict()
        db_transaction = self.model(**transaction_data)
        db_transaction.organization_id = organization_id
        db.add(db_transaction)
        await db.flush()

        # Update bank account balance
        await db.execute(
            update(BankAccount)
            .where(
                and_(
                    BankAccount.id == obj_in.bank_account_id,
                    BankAccount.organization_id == organization_id
                )
            )
            .values(balance_cents=BankAccount.balance_cents + balance_change)
        )

        # Reload transaction with relationships
        result = await db.execute(
            select(Transaction)
            .where(Transaction.id == db_transaction.id)
            .options(
                selectinload(Transaction.bank_account),
                selectinload(Transaction.project).selectinload(Project.services)
            )
        )
        return result.scalar_one()

    async def remove(
        self,
        db: AsyncSession,
        *,
        organization_id: UUID,
        id: UUID
    ) -> Optional[Transaction]:
        """Delete a transaction and rollback the balance change."""
        # Get the transaction first
        transaction = await self.get(db=db, organization_id=organization_id, id=id)
        if not transaction:
            return None

        # Calculate reverse balance change
        balance_change = transaction.amount_cents
        if transaction.type == "expense":
            balance_change = -balance_change  # Reverse the expense (add back)
        else:
            balance_change = -balance_change  # Reverse the income (subtract)

        # Delete the transaction
        await db.delete(transaction)

        # Rollback bank account balance
        await db.execute(
            update(BankAccount)
            .where(
                and_(
                    BankAccount.id == transaction.bank_account_id,
                    BankAccount.organization_id == organization_id
                )
            )
            .values(balance_cents=BankAccount.balance_cents + balance_change)
        )

        return transaction

    async def get_multi_with_relations(
        self,
        db: AsyncSession,
        *,
        organization_id: UUID,
        skip: int = 0,
        limit: int = 100,
        filters: Optional[Dict[str, Any]] = None
    ) -> List[Transaction]:
        """Get transactions with bank account and project relations."""
        query = select(Transaction).where(Transaction.organization_id == organization_id)

        if filters:
            for field, value in filters.items():
                if hasattr(Transaction, field):
                    query = query.where(getattr(Transaction, field) == value)

        query = query.options(
            selectinload(Transaction.bank_account),
            selectinload(Transaction.project).selectinload(Project.services)
        ).offset(skip).limit(limit)

        result = await db.execute(query)
        return result.scalars().all()

    async def get_monthly_stats(
        self,
        db: AsyncSession,
        *,
        organization_id: UUID,
        year: int,
        month: int
    ) -> Dict[str, int]:
        """Get monthly financial statistics for the organization."""
        # Calculate date range for the month
        start_date = f"{year}-{month:02d}-01"
        if month == 12:
            end_date = f"{year + 1}-01-01"
        else:
            end_date = f"{year}-{month + 1:02d}-01"

        # Query for income total
        income_query = select(func.sum(Transaction.amount_cents)).where(
            and_(
                Transaction.organization_id == organization_id,
                Transaction.type == "income",
                Transaction.transaction_date >= start_date,
                Transaction.transaction_date < end_date
            )
        )

        # Query for expense total
        expense_query = select(func.sum(Transaction.amount_cents)).where(
            and_(
                Transaction.organization_id == organization_id,
                Transaction.type == "expense",
                Transaction.transaction_date >= start_date,
                Transaction.transaction_date < end_date
            )
        )

        income_result = await db.execute(income_query)
        expense_result = await db.execute(expense_query)

        total_income = income_result.scalar() or 0
        total_expense = expense_result.scalar() or 0
        net_balance = total_income - total_expense

        return {
            "total_income_cents": total_income,
            "total_expense_cents": total_expense,
            "net_balance_cents": net_balance,
            "year": year,
            "month": month
        }

    async def get_overview_stats(
        self,
        db: AsyncSession,
        *,
        organization_id: UUID
    ) -> Dict[str, int]:
        """Get overall financial statistics for the organization."""
        # Query for total income
        income_query = select(func.sum(Transaction.amount_cents)).where(
            and_(
                Transaction.organization_id == organization_id,
                Transaction.type == "income"
            )
        )

        # Query for total expense
        expense_query = select(func.sum(Transaction.amount_cents)).where(
            and_(
                Transaction.organization_id == organization_id,
                Transaction.type == "expense"
            )
        )

        # Query for total active project budget
        budget_query = select(func.sum(Project.budget_total_cents)).where(
            and_(
                Project.organization_id == organization_id,
                Project.is_active == True
            )
        )

        income_result = await db.execute(income_query)
        expense_result = await db.execute(expense_query)
        budget_result = await db.execute(budget_query)

        total_income = income_result.scalar() or 0
        total_expense = expense_result.scalar() or 0
        total_budget = budget_result.scalar() or 0

        # Net income is Income - Expense
        net_income = total_income - total_expense

        # Remaining budget is Total Budget - Total Expense
        # This assumes all expenses are budget-consuming
        remaining_budget = total_budget - total_expense

        return {
            "total_income_cents": total_income,
            "total_expense_cents": total_expense,
            "net_income_cents": net_income,
            "total_budget_cents": total_budget,
            "remaining_budget_cents": remaining_budget
        }

    async def _validate_bank_account_ownership(
        self, db: AsyncSession, organization_id: UUID, bank_account_id: UUID
    ) -> BankAccount:
        """Validate that bank account belongs to the organization."""
        # Use self to access the bank_account_service instance
        account = await bank_account_service.get(
            db=db,
            organization_id=organization_id,
            id=bank_account_id
        )

        if not account:
            raise ValueError("Bank account not found or does not belong to your organization")

        return account

    async def _validate_project_ownership(
        self, db: AsyncSession, organization_id: UUID, project_id: UUID
    ) -> Project:
        """Validate that project belongs to the organization."""
        from app.modules.commercial.service import project_service

        project = await project_service.get(
            db=db,
            organization_id=organization_id,
            id=project_id
        )

        if not project:
            raise ValueError("Project not found or does not belong to your organization")

        return project

    async def _validate_supplier_ownership(
        self, db: AsyncSession, organization_id: UUID, supplier_id: UUID
    ):
        """Validate that supplier belongs to the organization."""
        from app.services.commercial import supplier_service

        supplier = await supplier_service.get(
            db=db,
            organization_id=organization_id,
            id=supplier_id
        )

        if not supplier:
            raise ValueError("Supplier not found or does not belong to your organization")

        return supplier


# Service instances
bank_account_service = BankAccountService()
transaction_service = TransactionService()
