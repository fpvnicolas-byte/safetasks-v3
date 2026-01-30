from pydantic import BaseModel, ConfigDict, Field
from uuid import UUID
from datetime import datetime, date
from typing import Optional, Literal, List
from app.schemas.services import Service


class ProjectBase(BaseModel):
    """Base schema for Project."""
    client_id: UUID
    title: str
    description: Optional[str] = None
    status: Literal["draft", "pre-production", "production", "post-production", "delivered", "archived"] = "draft"
    budget_total_cents: int = Field(default=0, ge=0, description="Total budget in cents")
    start_date: Optional[date] = None
    end_date: Optional[date] = None

    model_config = ConfigDict(from_attributes=True)


class ProjectCreate(ProjectBase):
    """Schema for creating a Project."""
    service_ids: Optional[List[UUID]] = None


class ProjectUpdate(BaseModel):
    """Schema for updating a Project."""
    client_id: Optional[UUID] = None
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[Literal["draft", "pre-production", "production", "post-production", "delivered", "archived"]] = None
    budget_total_cents: Optional[int] = Field(None, ge=0)
    start_date: Optional[date] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    service_ids: Optional[List[UUID]] = None

    model_config = ConfigDict(from_attributes=True)


class Project(ProjectBase):
    """Schema for Project response."""
    id: UUID
    organization_id: UUID
    is_active: bool
    created_at: datetime
    is_active: bool
    created_at: datetime
    updated_at: datetime
    services: List[Service] = []


class ProjectWithClient(Project):
    """Schema for Project response with client information."""
    client: "Client" = Field(...)

    model_config = ConfigDict(from_attributes=True)


# Forward reference for circular imports
from app.schemas.clients import Client
