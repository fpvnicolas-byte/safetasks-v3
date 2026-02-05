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
    proposal_id: Optional[UUID] = None


# Budget status type
BudgetStatus = Literal["draft", "pending_approval", "approved", "rejected", "increment_pending"]


class ProjectUpdate(BaseModel):
    """Schema for updating a Project."""
    client_id: Optional[UUID] = None
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[Literal["draft", "pre-production", "production", "post-production", "delivered", "archived"]] = None
    budget_total_cents: Optional[int] = Field(None, ge=0)
    budget_status: Optional[BudgetStatus] = None
    budget_notes: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    service_ids: Optional[List[UUID]] = None
    proposal_id: Optional[UUID] = None

    model_config = ConfigDict(from_attributes=True)


class Project(ProjectBase):
    """Schema for Project response."""
    id: UUID
    organization_id: UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime
    services: List[Service] = []
    
    # Budget approval fields
    budget_status: BudgetStatus = "draft"
    budget_approved_by: Optional[UUID] = None
    budget_approved_at: Optional[datetime] = None
    budget_notes: Optional[str] = None
    
    # Budget increment fields
    budget_increment_requested_cents: int = 0
    budget_increment_notes: Optional[str] = None
    budget_increment_requested_at: Optional[datetime] = None
    budget_increment_requested_by: Optional[UUID] = None


class ProjectWithClient(Project):
    """Schema for Project response with client information."""
    client: "Client" = Field(...)

    model_config = ConfigDict(from_attributes=True)


# Forward reference for circular imports
from app.schemas.clients import Client


class ProjectStats(BaseModel):
    """Schema for project statistics."""
    scenes_count: int = 0
    characters_count: int = 0
    shooting_days_count: int = 0
    confirmed_shooting_days_count: int = 0
    team_count: int = 0
    
    model_config = ConfigDict(from_attributes=True)

