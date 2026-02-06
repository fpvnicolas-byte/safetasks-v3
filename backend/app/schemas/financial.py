from pydantic import BaseModel, ConfigDict, Field
from uuid import UUID
from datetime import datetime, date
from typing import Optional, List, Literal
from decimal import Decimal
from enum import Enum


class TransactionCategory(str, Enum):
    crew_hire = "crew_hire"
    equipment_rental = "equipment_rental"
    logistics = "logistics"
    post_production = "post_production"
    maintenance = "maintenance"
    other = "other"
    production_revenue = "production_revenue"
    internal_transfer = "internal_transfer"


class TaxType(str, Enum):
    iss = "iss"
    irrf = "irrf"
    pis = "pis"
    cofins = "cofins"
    csll = "csll"
    inss = "inss"
    rental_tax = "rental_tax"
    other = "other"


class InvoiceStatus(str, Enum):
    draft = "draft"
    sent = "sent"
    paid = "paid"
    overdue = "overdue"
    cancelled = "cancelled"


class BudgetCategoryEnum(str, Enum):
    """Standard production budget categories."""
    CREW = "crew"
    EQUIPMENT = "equipment"
    LOCATIONS = "locations"
    TALENT = "talent"
    TRANSPORTATION = "transportation"
    CATERING = "catering"
    POST_PRODUCTION = "post_production"
    MUSIC_LICENSING = "music_licensing"
    INSURANCE = "insurance"
    CONTINGENCY = "contingency"
    OTHER = "other"


class TaxTableBase(BaseModel):
    """Base schema for Tax Table."""
    name: str = Field(min_length=1)
    tax_type: TaxType
    rate_percentage: Decimal = Field(ge=0, le=100)
    description: Optional[str] = None
    applies_to_income: Optional[str] = None  # JSON string
    applies_to_expenses: Optional[str] = None  # JSON string
    is_active: bool = True

    model_config = ConfigDict(from_attributes=True)


class TaxTableCreate(TaxTableBase):
    """Schema for creating a Tax Table."""
    pass


class TaxTableUpdate(BaseModel):
    """Schema for updating a Tax Table."""
    name: Optional[str] = Field(default=None, min_length=1)
    tax_type: Optional[TaxType] = None
    rate_percentage: Optional[Decimal] = Field(default=None, ge=0, le=100)
    description: Optional[str] = None
    applies_to_income: Optional[str] = None
    applies_to_expenses: Optional[str] = None
    is_active: Optional[bool] = None

    model_config = ConfigDict(from_attributes=True)


class TaxTable(TaxTableBase):
    """Schema for Tax Table response."""
    id: UUID
    organization_id: UUID
    created_at: datetime
    updated_at: datetime


class InvoiceItemBase(BaseModel):
    """Base schema for Invoice Item."""
    description: str = Field(min_length=1)
    quantity: Decimal = Field(gt=0)
    unit_price_cents: int = Field(gt=0)
    total_cents: int = Field(gt=0)
    project_id: Optional[UUID] = None
    category: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class InvoiceItemCreate(InvoiceItemBase):
    """Schema for creating an Invoice Item."""
    pass


class InvoiceItem(InvoiceItemBase):
    """Schema for Invoice Item response."""
    id: UUID
    organization_id: UUID
    invoice_id: UUID
    created_at: datetime


class InvoiceBase(BaseModel):
    """Base schema for Invoice."""
    client_id: UUID
    project_id: Optional[UUID] = None
    proposal_id: Optional[UUID] = None
    invoice_number: str = Field(min_length=1)
    status: InvoiceStatus = InvoiceStatus.draft
    subtotal_cents: int = Field(ge=0)
    tax_amount_cents: int = Field(ge=0)
    total_amount_cents: int = Field(ge=0)
    currency: str = "BRL"
    issue_date: date
    due_date: date
    paid_date: Optional[date] = None
    description: Optional[str] = None
    notes: Optional[str] = None
    payment_method: Optional[str] = None
    payment_reference: Optional[str] = None
    payment_notes: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)





class InvoiceCreate(BaseModel):
    """Schema for creating an Invoice."""
    client_id: UUID
    project_id: Optional[UUID] = None
    proposal_id: Optional[UUID] = None
    items: List[InvoiceItemCreate] = Field(min_items=1)
    due_date: date
    description: Optional[str] = None
    notes: Optional[str] = None
    currency: str = "BRL"

    model_config = ConfigDict(from_attributes=True)


class InvoiceUpdate(BaseModel):
    """Schema for updating an Invoice."""
    status: Optional[InvoiceStatus] = None
    subtotal_cents: Optional[int] = Field(default=None, ge=0)
    tax_amount_cents: Optional[int] = Field(default=None, ge=0)
    total_amount_cents: Optional[int] = Field(default=None, ge=0)
    currency: Optional[str] = None
    due_date: Optional[date] = None
    paid_date: Optional[date] = None
    description: Optional[str] = None
    notes: Optional[str] = None
    payment_method: Optional[str] = None
    payment_reference: Optional[str] = None
    payment_notes: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class InvoiceItemUpdate(BaseModel):
    """Schema for updating an Invoice Item."""
    description: Optional[str] = Field(default=None, min_length=1)
    quantity: Optional[Decimal] = Field(default=None, gt=0)
    unit_price_cents: Optional[int] = Field(default=None, gt=0)
    total_cents: Optional[int] = Field(default=None, gt=0)
    category: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class Invoice(InvoiceBase):
    """Schema for Invoice response."""
    id: UUID
    organization_id: UUID
    created_at: datetime
    updated_at: datetime


class InvoiceWithItems(Invoice):
    """Schema for Invoice response with items."""
    items: List[InvoiceItem] = []
    client: Optional['Client'] = None
    project: Optional['Project'] = None

    model_config = ConfigDict(from_attributes=True)


class ProjectFinancialReport(BaseModel):
    """Schema for project financial report."""
    project_id: UUID
    project_title: str
    currency: str = "BRL"

    # Revenue
    total_revenue_cents: int = 0
    paid_revenue_cents: int = 0
    outstanding_revenue_cents: int = 0

    # Expenses by category
    expenses_by_category: dict = {}  # {"crew_hire": 500000, "equipment_rental": 200000, ...}
    total_expenses_cents: int = 0

    # Profitability
    gross_profit_cents: int = 0  # revenue - expenses
    tax_amount_cents: int = 0
    net_profit_cents: int = 0    # gross_profit - taxes

    # Detailed breakdowns
    invoice_breakdown: List[dict] = []
    expense_breakdown: List[dict] = []

    generated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Budget Line schemas
class ProjectBudgetLineBase(BaseModel):
    """Base schema for budget line."""
    category: BudgetCategoryEnum
    description: str
    estimated_amount_cents: int = Field(ge=0)
    stakeholder_id: Optional[UUID] = None
    supplier_id: Optional[UUID] = None
    notes: Optional[str] = None
    sort_order: int = 0


class ProjectBudgetLineCreate(ProjectBudgetLineBase):
    """Schema for creating a budget line."""
    project_id: UUID


class ProjectBudgetLineUpdate(BaseModel):
    """Schema for updating a budget line."""
    category: Optional[BudgetCategoryEnum] = None
    description: Optional[str] = None
    estimated_amount_cents: Optional[int] = Field(default=None, ge=0)
    stakeholder_id: Optional[UUID] = None
    supplier_id: Optional[UUID] = None
    notes: Optional[str] = None
    sort_order: Optional[int] = None


class ProjectBudgetLineResponse(ProjectBudgetLineBase):
    """Response schema for budget line with computed fields."""
    id: UUID
    project_id: UUID
    organization_id: UUID
    created_at: datetime
    updated_at: datetime

    # Computed fields (set by service)
    actual_amount_cents: int = 0
    variance_cents: int = 0
    variance_percentage: float = 0.0

    model_config = ConfigDict(from_attributes=True)


class CategoryBudgetSummary(BaseModel):
    """Summary of budget vs actual for a category."""
    category: BudgetCategoryEnum
    estimated_cents: int
    actual_cents: int
    variance_cents: int
    variance_percentage: float


class ProjectBudgetSummary(BaseModel):
    """Complete project budget summary."""
    project_id: UUID
    total_estimated_cents: int
    total_actual_cents: int
    total_variance_cents: int
    variance_percentage: float
    by_category: List[CategoryBudgetSummary]
    lines: List[ProjectBudgetLineResponse]


# Import at end to avoid circular imports
from app.schemas.clients import Client
from app.schemas.projects import Project

# Rebuild models to resolve forward references
InvoiceWithItems.model_rebuild()
