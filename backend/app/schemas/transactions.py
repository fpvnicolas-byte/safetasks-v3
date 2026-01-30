from pydantic import BaseModel, ConfigDict, Field, field_validator
from uuid import UUID
from datetime import datetime, date
from typing import Optional, Literal


class TransactionBase(BaseModel):
    """Base schema for Transaction."""
    bank_account_id: UUID
    category: str
    type: Literal["income", "expense"]
    amount_cents: int = Field(..., gt=0, description="Amount in cents, must be positive")
    description: Optional[str] = None
    transaction_date: date
    project_id: Optional[UUID] = None
    supplier_id: Optional[UUID] = None  # ADDED: Link to supplier/vendor
    stakeholder_id: Optional[UUID] = None  # ADDED: Link to specific team member

    @field_validator('category')
    @classmethod
    def validate_category(cls, v: str) -> str:
        """Validate category against allowed values."""
        allowed_categories = [
            'crew_hire',
            'equipment_rental',
            'logistics',
            'post_production',
            'maintenance',
            'other',
            'production_revenue'
        ]
        if v not in allowed_categories:
            raise ValueError(
                f"Category must be one of: {', '.join(allowed_categories)}. Got: {v}"
            )
        return v

    model_config = ConfigDict(from_attributes=True)


class TransactionCreate(TransactionBase):
    """Schema for creating a Transaction."""
    pass


class TransactionUpdate(BaseModel):
    """Schema for updating a Transaction."""
    bank_account_id: Optional[UUID] = None
    category: Optional[str] = None
    type: Optional[Literal["income", "expense"]] = None
    amount_cents: Optional[int] = Field(None, gt=0)
    description: Optional[str] = None
    transaction_date: Optional[date] = None
    project_id: Optional[UUID] = None
    supplier_id: Optional[UUID] = None  # ADDED: Link to supplier/vendor
    stakeholder_id: Optional[UUID] = None  # ADDED: Link to specific team member

    @field_validator('category')
    @classmethod
    def validate_category(cls, v: Optional[str]) -> Optional[str]:
        """Validate category against allowed values."""
        if v is None:
            return v
        allowed_categories = [
            'crew_hire',
            'equipment_rental',
            'logistics',
            'post_production',
            'maintenance',
            'other',
            'production_revenue'
        ]
        if v not in allowed_categories:
            raise ValueError(
                f"Category must be one of: {', '.join(allowed_categories)}. Got: {v}"
            )
        return v

    model_config = ConfigDict(from_attributes=True)


class Transaction(TransactionBase):
    """Schema for Transaction response."""
    id: UUID
    organization_id: UUID
    created_at: datetime


class TransactionWithRelations(Transaction):
    """Schema for Transaction response with bank account and project data."""
    bank_account: "BankAccount" = Field(...)
    project: Optional["Project"] = Field(None)

    model_config = ConfigDict(from_attributes=True)


class TransactionOverviewStats(BaseModel):
    """Schema for financial overview statistics."""
    total_income_cents: int
    total_expense_cents: int
    net_income_cents: int
    total_budget_cents: int
    remaining_budget_cents: int

    model_config = ConfigDict(from_attributes=True)


class TransactionStats(BaseModel):
    """Schema for monthly transaction statistics."""
    total_income_cents: int
    total_expense_cents: int
    net_balance_cents: int
    year: int
    month: int

    model_config = ConfigDict(from_attributes=True)


# Forward references for circular imports
from app.schemas.bank_accounts import BankAccount
from app.schemas.projects import Project
