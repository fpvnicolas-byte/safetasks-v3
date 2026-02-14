from pydantic import BaseModel, ConfigDict, Field
from uuid import UUID
from datetime import datetime, date
from typing import Optional, List, Dict, Any
from enum import Enum

class SupplierCategory(str, Enum):
    rental_house = "rental_house"
    freelancer = "freelancer"
    catering = "catering"
    transport = "transport"
    post_production = "post_production"
    other = "other"


class RateType(str, Enum):
    """Rate type for stakeholder payment calculation."""
    daily = "daily"      # R$/day - multiplied by shooting days or estimated_units
    hourly = "hourly"    # R$/hour - multiplied by estimated_units (hours)
    fixed = "fixed"      # Fixed total amount for the project


class StakeholderStatusEnum(str, Enum):
    """Booking status for stakeholder."""
    REQUESTED = "requested"
    CONFIRMED = "confirmed"
    WORKING = "working"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

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

    # Rate management fields
    rate_type: Optional[RateType] = None
    rate_value_cents: Optional[int] = Field(default=None, ge=0, description="Rate in cents (e.g., R$ 500.00 = 50000)")
    estimated_units: Optional[int] = Field(default=None, ge=0, description="Hours for hourly rate, days override for daily rate")

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

    # Rate management fields
    rate_type: Optional[RateType] = None
    rate_value_cents: Optional[int] = Field(default=None, ge=0)
    estimated_units: Optional[int] = Field(default=None, ge=0)

    model_config = ConfigDict(from_attributes=True)


class StakeholderStatusUpdate(BaseModel):
    """Schema for updating stakeholder booking status."""
    status: StakeholderStatusEnum
    status_notes: Optional[str] = None
    booking_start_date: Optional[date] = None
    booking_end_date: Optional[date] = None
    confirmed_rate_cents: Optional[int] = Field(default=None, ge=0)
    confirmed_rate_type: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class Stakeholder(StakeholderBase):
    id: UUID
    organization_id: UUID
    created_at: datetime
    updated_at: datetime

    # Booking status fields
    status: StakeholderStatusEnum = StakeholderStatusEnum.REQUESTED
    status_changed_at: Optional[datetime] = None
    status_notes: Optional[str] = None
    booking_start_date: Optional[date] = None
    booking_end_date: Optional[date] = None
    confirmed_rate_cents: Optional[int] = None
    confirmed_rate_type: Optional[str] = None


class RateCalculationBreakdown(BaseModel):
    """Breakdown of how the rate was calculated."""
    type: RateType
    rate_per_day_cents: Optional[int] = None
    rate_per_hour_cents: Optional[int] = None
    fixed_amount_cents: Optional[int] = None
    days: Optional[int] = None
    hours: Optional[int] = None
    source: Optional[str] = None  # 'estimated_units' or 'shooting_days'

    model_config = ConfigDict(from_attributes=True)


class StakeholderWithRateInfo(Stakeholder):
    """Extended stakeholder response with rate calculation and payment tracking."""
    # Rate calculation
    shooting_days_count: int = 0
    suggested_amount_cents: Optional[int] = None
    calculation_breakdown: Optional[RateCalculationBreakdown] = None

    # Payment tracking
    total_paid_cents: int = 0
    pending_amount_cents: Optional[int] = None
    payment_status: str = "not_configured"  # 'not_configured', 'pending', 'partial', 'paid', 'overpaid'

    model_config = ConfigDict(from_attributes=True)


# Contact Schemas (Unified view of Suppliers with enriched data)
class ContactOut(BaseModel):
    """Unified contact view that combines supplier data with team and stakeholder info."""
    id: UUID  # supplier.id
    name: str
    category: str
    email: Optional[str] = None
    phone: Optional[str] = None
    document_id: Optional[str] = None
    is_active: bool = True
    specialties: Optional[List[str]] = None
    notes: Optional[str] = None
    created_at: datetime
    # Enriched data
    project_count: int = 0  # COUNT of linked stakeholders
    total_spent_cents: int = 0  # SUM of expense transactions
    platform_status: str = "none"  # "none" | "invited" | "active"
    platform_role: Optional[str] = None  # role_v2 if active
    profile_id: Optional[UUID] = None

    model_config = ConfigDict(from_attributes=True)


class ContactAssignment(BaseModel):
    """Project assignment info for a contact."""
    id: UUID
    project_id: UUID
    project_title: str
    role: str
    status: str
    rate_type: Optional[str] = None
    rate_value_cents: Optional[int] = None
    booking_start_date: Optional[date] = None
    booking_end_date: Optional[date] = None
    is_active: bool = True

    model_config = ConfigDict(from_attributes=True)


class ContactTeamInfo(BaseModel):
    """Platform access info for a contact."""
    profile_id: UUID
    full_name: Optional[str] = None
    email: str
    effective_role: str
    is_master_owner: bool = False
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ContactInviteInfo(BaseModel):
    """Pending invite info for a contact."""
    id: UUID
    invited_email: str
    role_v2: str
    created_at: datetime
    expires_at: Optional[datetime] = None
    status: str = "pending"

    model_config = ConfigDict(from_attributes=True)

class ContactProjectAccessAssignment(BaseModel):
    """Project access assignment info for linked freelancer contacts."""
    id: UUID
    project_id: UUID
    project_title: str
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ContactDetailOut(ContactOut):
    """Full contact detail including assignments, team info, and invite status."""
    address: Optional[str] = None
    bank_info: Optional[Dict[str, Any]] = None
    assignments: List[ContactAssignment] = []
    project_access_assignments: List[ContactProjectAccessAssignment] = []
    team_info: Optional[ContactTeamInfo] = None
    pending_invite: Optional[ContactInviteInfo] = None

    model_config = ConfigDict(from_attributes=True)
