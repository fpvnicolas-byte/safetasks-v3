from pydantic import BaseModel, ConfigDict
from uuid import UUID
from datetime import datetime
from typing import Optional, Literal


class OrganizationBase(BaseModel):
    """Base schema for Organization."""
    name: str
    slug: str
    tax_id: Optional[str] = None
    plan: Literal["free", "starter", "professional", "enterprise"] = "free"
    subscription_status: Literal["trialing", "active", "past_due", "cancelled", "paused"] = "trialing"

    model_config = ConfigDict(from_attributes=True)


class OrganizationCreate(OrganizationBase):
    """Schema for creating an Organization."""
    pass


class OrganizationUpdate(BaseModel):
    """Schema for updating an Organization."""
    name: Optional[str] = None
    slug: Optional[str] = None
    tax_id: Optional[str] = None
    plan: Optional[Literal["free", "starter", "professional", "enterprise"]] = None
    subscription_status: Optional[Literal["trialing", "active", "past_due", "cancelled", "paused"]] = None
    is_active: Optional[bool] = None

    model_config = ConfigDict(from_attributes=True)


class Organization(OrganizationBase):
    """Schema for Organization response."""
    id: UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
