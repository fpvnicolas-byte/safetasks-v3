from pydantic import BaseModel, ConfigDict, Field
from uuid import UUID
from datetime import datetime
from typing import Optional, List, Dict, Any
from decimal import Decimal


class SupplierCategory(str):
    rental_house = "rental_house"
    freelancer = "freelancer"
    catering = "catering"
    transport = "transport"
    post_production = "post_production"
    other = "other"


class SupplierBase(BaseModel):
    """Base schema for Supplier."""
    name: str = Field(..., min_length=1)
    category: SupplierCategory
    document_id: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    bank_info: Optional[Dict[str, Any]] = None  # Flexible JSON for payment details
    specialties: Optional[List[str]] = None
    notes: Optional[str] = None
    is_active: bool = True

    model_config = ConfigDict(from_attributes=True)


class SupplierCreate(SupplierBase):
    """Schema for creating a Supplier."""
    pass


class SupplierUpdate(BaseModel):
    """Schema for updating a Supplier."""
    name: Optional[str] = Field(None, min_length=1)
    category: Optional[SupplierCategory] = None
    document_id: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    bank_info: Optional[Dict[str, Any]] = None
    specialties: Optional[List[str]] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None

    model_config = ConfigDict(from_attributes=True)


class Supplier(SupplierBase):
    """Schema for Supplier response."""
    id: UUID
    organization_id: UUID
    created_at: datetime
    updated_at: datetime


class SupplierWithTransactions(Supplier):
    """Schema for Supplier response with transaction summary."""
    total_transactions: int = 0
    total_amount_cents: int = 0
    last_transaction_date: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class SupplierStatement(BaseModel):
    """Schema for supplier financial statement."""
    supplier_id: UUID
    supplier_name: str
    supplier_category: str
    total_transactions: int
    total_amount_cents: int
    currency: str = "BRL"

    # Transaction breakdown
    transactions: List[Dict[str, Any]] = []

    # Summary by project
    project_breakdown: List[Dict[str, Any]] = []

    # Summary by category
    category_breakdown: List[Dict[str, Any]] = []

    statement_period: Dict[str, str]  # {"from": "2024-01-01", "to": "2024-12-31"}
    generated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class StakeholderSummary(BaseModel):
    """Schema for unified stakeholder view."""
    organization_id: UUID

    # Client stakeholders (who pay us)
    clients: List[Dict[str, Any]] = []

    # Supplier stakeholders (who we pay)
    suppliers: List[Dict[str, Any]] = []

    # Internal stakeholders (who work with us)
    crew_members: List[Dict[str, Any]] = []

    # Summary statistics
    total_clients: int = 0
    total_suppliers: int = 0
    total_crew: int = 0
    total_active_projects: int = 0

    generated_at: datetime

    model_config = ConfigDict(from_attributes=True)
