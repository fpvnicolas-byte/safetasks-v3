from pydantic import BaseModel, ConfigDict, Field
from uuid import UUID
from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum

class SupplierCategory(str, Enum):
    rental_house = "rental_house"
    freelancer = "freelancer"
    catering = "catering"
    transport = "transport"
    post_production = "post_production"
    other = "other"

class SupplierBase(BaseModel):
    """Base schema for Supplier."""
    # CORREÇÃO: Removido '...' posicional. O tipo 'str' já torna obrigatório.
    name: str = Field(min_length=1)
    category: SupplierCategory
    document_id: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    bank_info: Optional[Dict[str, Any]] = None
    specialties: Optional[List[str]] = None
    notes: Optional[str] = None
    is_active: bool = True

    model_config = ConfigDict(from_attributes=True)

class SupplierCreate(SupplierBase):
    pass

class SupplierUpdate(BaseModel):
    """Schema for updating a Supplier."""
    # CORREÇÃO: Removido 'None' posicional. Usando 'default=None'.
    name: Optional[str] = Field(default=None, min_length=1)
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
    id: UUID
    organization_id: UUID
    created_at: datetime
    updated_at: datetime

class SupplierWithTransactions(Supplier):
    total_transactions: int = 0
    total_amount_cents: int = 0
    last_transaction_date: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)

class SupplierStatement(BaseModel):
    supplier_id: UUID
    supplier_name: str
    supplier_category: str
    total_transactions: int
    total_amount_cents: int
    currency: str = "BRL"
    transactions: List[Dict[str, Any]] = []
    project_breakdown: List[Dict[str, Any]] = []
    category_breakdown: List[Dict[str, Any]] = []
    statement_period: Dict[str, str]
    generated_at: datetime
    model_config = ConfigDict(from_attributes=True)

class StakeholderSummary(BaseModel):
    organization_id: UUID
    clients: List[Dict[str, Any]] = []
    suppliers: List[Dict[str, Any]] = []
    crew_members: List[Dict[str, Any]] = []
    total_clients: int = 0
    total_suppliers: int = 0
    total_crew: int = 0
    total_active_projects: int = 0
    generated_at: datetime
    model_config = ConfigDict(from_attributes=True)


# Project Stakeholder Schemas
class StakeholderBase(BaseModel):
    """Base schema for project Stakeholder."""
    name: str = Field(min_length=1)
    role: str = Field(min_length=1)
    project_id: UUID
    supplier_id: Optional[UUID] = None  # Link to payment-enabled entity
    email: Optional[str] = None
    phone: Optional[str] = None
    notes: Optional[str] = None
    is_active: bool = True

    model_config = ConfigDict(from_attributes=True)


class StakeholderCreate(StakeholderBase):
    pass


class StakeholderUpdate(BaseModel):
    """Schema for updating a Stakeholder."""
    name: Optional[str] = Field(default=None, min_length=1)
    role: Optional[str] = Field(default=None, min_length=1)
    project_id: Optional[UUID] = None
    supplier_id: Optional[UUID] = None  # Link to payment-enabled entity
    email: Optional[str] = None
    phone: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None

    model_config = ConfigDict(from_attributes=True)


class Stakeholder(StakeholderBase):
    id: UUID
    organization_id: UUID
    created_at: datetime
    updated_at: datetime