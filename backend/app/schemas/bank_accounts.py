from pydantic import BaseModel, ConfigDict
from uuid import UUID
from datetime import datetime
from typing import Optional


class BankAccountBase(BaseModel):
    """Base schema for Bank Account."""
    name: str
    currency: str = "BRL"

    model_config = ConfigDict(from_attributes=True)


class BankAccountCreate(BankAccountBase):
    """Schema for creating a Bank Account."""
    pass


class BankAccountUpdate(BaseModel):
    """Schema for updating a Bank Account."""
    name: Optional[str] = None
    currency: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class BankAccount(BankAccountBase):
    """Schema for Bank Account response."""
    id: UUID
    organization_id: UUID
    balance_cents: int
    created_at: datetime
