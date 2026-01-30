from pydantic import BaseModel, ConfigDict, Field
from uuid import UUID
from datetime import datetime, date, time
from typing import Optional, Literal


class CallSheetBase(BaseModel):
    """
    Base schema for Professional Call Sheet.
    Includes all fields required for video production coordination.
    """
    project_id: UUID
    shooting_day: date
    status: Literal["draft", "confirmed", "completed"] = "draft"

    # Location Information
    location: Optional[str] = None  # Location name
    location_address: Optional[str] = None  # Full address with Google Maps link
    parking_info: Optional[str] = None  # Parking instructions

    # Time Schedule
    crew_call: Optional[time] = None  # General crew call time
    on_set: Optional[time] = None  # On-set ready time (shooting call)
    lunch_time: Optional[time] = None  # Lunch break time
    wrap_time: Optional[time] = None  # Expected wrap time

    # Production Information
    weather: Optional[str] = None  # Weather forecast
    notes: Optional[str] = None  # General production notes

    # Safety & Logistics
    hospital_info: Optional[str] = None  # Nearest hospital/emergency contact

    model_config = ConfigDict(from_attributes=True)


class CallSheetCreate(CallSheetBase):
    """Schema for creating a Call Sheet."""
    pass


class CallSheetUpdate(BaseModel):
    """Schema for updating a Call Sheet."""
    project_id: Optional[UUID] = None
    shooting_day: Optional[date] = None
    status: Optional[Literal["draft", "confirmed", "completed"]] = None

    # Location Information
    location: Optional[str] = None
    location_address: Optional[str] = None
    parking_info: Optional[str] = None

    # Time Schedule
    crew_call: Optional[time] = None
    on_set: Optional[time] = None
    lunch_time: Optional[time] = None
    wrap_time: Optional[time] = None

    # Production Information
    weather: Optional[str] = None
    notes: Optional[str] = None

    # Safety & Logistics
    hospital_info: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


from app.schemas.production import ProjectSummary

class CallSheet(CallSheetBase):
    """Schema for Call Sheet response."""
    id: UUID
    organization_id: UUID
    created_at: datetime
    updated_at: datetime
    project: Optional[ProjectSummary] = None

    model_config = ConfigDict(from_attributes=True)


class CallSheetWithProject(CallSheet):
    """Schema for Call Sheet response with project information."""
    project: "Project" = Field(...)

    model_config = ConfigDict(from_attributes=True)


# Forward reference for circular imports
from app.schemas.projects import Project
