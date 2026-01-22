from pydantic import BaseModel, ConfigDict, Field
from uuid import UUID
from datetime import datetime, date
from typing import Optional, Literal


class ProjectBase(BaseModel):
    """Base schema for Project."""
    client_id: UUID
    title: str
    description: Optional[str] = None
    status: Literal["draft", "pre-production", "production", "post-production", "delivered", "archived"] = "draft"
    start_date: Optional[date] = None
    end_date: Optional[date] = None

    model_config = ConfigDict(from_attributes=True)


class ProjectCreate(ProjectBase):
    """Schema for creating a Project."""
    pass


class ProjectUpdate(BaseModel):
    """Schema for updating a Project."""
    client_id: Optional[UUID] = None
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[Literal["draft", "pre-production", "production", "post-production", "delivered", "archived"]] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None

    model_config = ConfigDict(from_attributes=True)


class Project(ProjectBase):
    """Schema for Project response."""
    id: UUID
    organization_id: UUID
    created_at: datetime


class ProjectWithClient(Project):
    """Schema for Project response with client information."""
    client: "Client" = Field(...)

    model_config = ConfigDict(from_attributes=True)


# Forward reference for circular imports
from app.schemas.clients import Client
