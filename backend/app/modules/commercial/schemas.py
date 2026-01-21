from datetime import datetime
from decimal import Decimal
from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field, field_validator, ConfigDict

from app.core.schemas import BaseSchema, CreateSchema, UpdateSchema


# Client Schemas
class ClientBase(BaseModel):
    """Base schema for client data."""
    name: str = Field(..., max_length=255)
    legal_name: Optional[str] = Field(None, max_length=255)
    tax_id: Optional[str] = Field(None, max_length=20)
    email: Optional[str] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, max_length=50)
    address: Optional[str] = None

    # Contact information
    contact_name: Optional[str] = Field(None, max_length=255)
    contact_email: Optional[str] = Field(None, max_length=255)
    contact_phone: Optional[str] = Field(None, max_length=50)

    # Payment terms
    payment_terms_days: int = Field(default=30, ge=0)
    credit_limit: Decimal = Field(default=Decimal('0'), ge=0)

    is_active: bool = True


class ClientCreate(ClientBase, CreateSchema):
    """Schema for creating a new client."""
    pass


class ClientUpdate(ClientBase, UpdateSchema):
    """Schema for updating an existing client."""
    pass


class ClientRead(ClientBase, BaseSchema):
    """Schema for reading client data."""
    model_config = ConfigDict(from_attributes=True)


# Budget Line Item Schema
class BudgetLineItem(BaseModel):
    """Schema for individual budget line items."""
    category: str
    description: str
    quantity: int = Field(default=1, ge=1)
    unit_price_cents: int = Field(..., ge=0)
    amount_cents: int = Field(..., ge=0)

    @field_validator('amount_cents', mode='before')
    @classmethod
    def calculate_amount(cls, v, values):
        """Auto-calculate amount if not provided."""
        if v is not None:
            return v
        if 'quantity' in values and 'unit_price_cents' in values:
            return values['quantity'] * values['unit_price_cents']
        return 0


# Budget Schemas
class BudgetBase(BaseModel):
    """Base schema for budget data."""
    name: str = Field(..., max_length=255)
    description: Optional[str] = None
    client_id: int

    # Financial settings
    tax_rate_percent: Decimal = Field(default=Decimal('0'), ge=0, le=100)
    discount_cents: int = Field(default=0, ge=0)
    profit_margin_percent: Decimal = Field(default=Decimal('0'), ge=0)

    # Line items
    line_items: List[BudgetLineItem] = Field(default_factory=list)

    # Metadata
    change_log: Optional[str] = None


class BudgetCreate(BudgetBase, CreateSchema):
    """Schema for creating a new budget."""
    pass


class BudgetUpdate(BudgetBase, UpdateSchema):
    """Schema for updating an existing budget."""
    pass


class BudgetRead(BaseSchema):
    """Schema for reading budget data."""
    model_config = ConfigDict(from_attributes=True)

    name: str
    description: Optional[str]
    version: int
    client_id: int
    client: Optional[Dict[str, Any]] = None

    # Financial data (returned as decimals for API)
    subtotal: Decimal
    tax_rate_percent: Decimal
    tax_amount: Decimal
    discount: Decimal
    total: Decimal
    profit_margin_percent: Decimal
    profit_amount: Decimal

    # Line items
    line_items: List[BudgetLineItem]

    # Status
    status: str
    is_active: bool

    # Metadata
    created_by: Optional[str]
    approved_by: Optional[str]
    approved_at: Optional[datetime]
    change_log: Optional[str]


class BudgetCalculationRequest(BaseModel):
    """Schema for budget calculation requests."""
    line_items: List[BudgetLineItem] = Field(default_factory=list)
    tax_rate_percent: Decimal = Field(default=Decimal('0'), ge=0, le=100)
    discount_cents: int = Field(default=0, ge=0)
    profit_margin_percent: Decimal = Field(default=Decimal('0'), ge=0)


class BudgetCalculationResponse(BaseModel):
    """Schema for budget calculation responses."""
    subtotal: Decimal
    tax_amount: Decimal
    discount: Decimal
    profit_amount: Decimal
    total: Decimal

    # Breakdown
    line_items_total: Decimal
    taxable_amount: Decimal
    discounted_amount: Decimal
    pre_profit_total: Decimal


class BudgetVersionCreate(BaseModel):
    """Schema for creating a new budget version."""
    name: Optional[str] = None
    description: Optional[str] = None
    line_items: Optional[List[BudgetLineItem]] = None
    tax_rate_percent: Optional[Decimal] = None
    discount_cents: Optional[int] = None
    profit_margin_percent: Optional[Decimal] = None
    change_log: str = Field(..., description="Description of changes made")


# Proposal Schemas
class ProposalBase(BaseModel):
    """Base schema for proposal data."""
    title: str = Field(..., max_length=255)
    client_id: int
    budget_id: int

    # Proposal content
    introduction: Optional[str] = None
    scope_of_work: Optional[str] = None
    terms_and_conditions: Optional[str] = None
    validity_days: int = Field(default=30, ge=1)

    currency: str = Field(default="BRL", max_length=3)


class ProposalCreate(ProposalBase, CreateSchema):
    """Schema for creating a new proposal."""
    pass


class ProposalUpdate(ProposalBase, UpdateSchema):
    """Schema for updating an existing proposal."""
    status: Optional[str] = None
    rejection_reason: Optional[str] = None


class ProposalRead(BaseSchema):
    """Schema for reading proposal data."""
    model_config = ConfigDict(from_attributes=True)

    title: str
    proposal_number: Optional[str]
    client_id: int
    client: Optional[Dict[str, Any]] = None
    budget_id: int
    budget: Optional[Dict[str, Any]] = None

    # Content
    introduction: Optional[str]
    scope_of_work: Optional[str]
    terms_and_conditions: Optional[str]
    validity_days: int
    proposed_amount: Decimal
    currency: str

    # Status
    status: str
    rejection_reason: Optional[str]

    # Metadata
    created_by: str
    sent_by: Optional[str]
    approved_by: Optional[str]

    # Dates
    sent_at: Optional[datetime]
    approved_at: Optional[datetime]
    expires_at: Optional[datetime]
    rejected_at: Optional[datetime]

    @field_validator('expires_at', mode='before')
    @classmethod
    def calculate_expires_at(cls, v, values):
        """Auto-calculate expires_at if not provided."""
        if v is not None:
            return v
        if 'created_at' in values and 'validity_days' in values:
            # This would be calculated in the service layer
            return None
        return None


class ProposalSendRequest(BaseModel):
    """Schema for sending a proposal."""
    pass  # No additional data needed, just the action


class ProposalApprovalRequest(BaseModel):
    """Schema for approving a proposal."""
    pass  # No additional data needed, just the action


class ProposalRejectionRequest(BaseModel):
    """Schema for rejecting a proposal."""
    reason: str = Field(..., description="Reason for rejection")


# Filter Schemas
class ClientFilter(BaseModel):
    """Filter parameters for client queries."""
    search: Optional[str] = None
    is_active: Optional[bool] = None
    tax_id: Optional[str] = None


class BudgetFilter(BaseModel):
    """Filter parameters for budget queries."""
    search: Optional[str] = None
    client_id: Optional[int] = None
    status: Optional[str] = None
    is_active: Optional[bool] = True


class ProposalFilter(BaseModel):
    """Filter parameters for proposal queries."""
    search: Optional[str] = None
    client_id: Optional[int] = None
    budget_id: Optional[int] = None
    status: Optional[str] = None