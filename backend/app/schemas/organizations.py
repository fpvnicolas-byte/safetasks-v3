from pydantic import BaseModel, ConfigDict
from uuid import UUID
from datetime import datetime
from typing import Optional


class OrganizationBase(BaseModel):
    """Base schema for Organization."""
    name: str
    slug: str

    model_config = ConfigDict(from_attributes=True)


class OrganizationCreate(OrganizationBase):
    """Schema for creating an Organization."""
    pass


class OrganizationUpdate(BaseModel):
    """Schema for updating an Organization."""
    name: Optional[str] = None
    slug: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class Organization(OrganizationBase):
    """Schema for Organization response."""
    id: UUID
    created_at: datetime
