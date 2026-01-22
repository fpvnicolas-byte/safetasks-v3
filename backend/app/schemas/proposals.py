from pydantic import BaseModel, ConfigDict, Field
from uuid import UUID
from datetime import datetime, date
from typing import Optional, Literal
from decimal import Decimal


class ProposalBase(BaseModel):
    """Base schema for Proposal."""
    client_id: UUID
    project_id: Optional[UUID] = None
    title: str
    description: Optional[str] = None
    status: Literal["draft", "sent", "approved", "rejected", "expired"] = "draft"
    valid_until: Optional[date] = None
    total_amount_cents: Optional[int] = None
    currency: str = "BRL"
    terms_conditions: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ProposalCreate(ProposalBase):
    """Schema for creating a Proposal."""
    pass


class ProposalUpdate(BaseModel):
    """Schema for updating a Proposal."""
    client_id: Optional[UUID] = None
    project_id: Optional[UUID] = None
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[Literal["draft", "sent", "approved", "rejected", "expired"]] = None
    valid_until: Optional[date] = None
    total_amount_cents: Optional[int] = None
    currency: Optional[str] = None
    terms_conditions: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class Proposal(ProposalBase):
    """Schema for Proposal response."""
    id: UUID
    organization_id: UUID
    created_at: datetime
    updated_at: datetime


class ProposalWithClient(Proposal):
    """Schema for Proposal response with client information."""
    # Note: In full implementation, this would include client relationship
    # For now, keeping it simple as requested
    pass


class ProposalApproval(BaseModel):
    """Schema for proposal approval request."""
    notes: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
