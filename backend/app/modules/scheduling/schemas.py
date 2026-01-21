from datetime import date, time, datetime
from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field, field_validator, ConfigDict

from app.core.schemas import BaseSchema, CreateSchema, UpdateSchema


# Shooting Day Schemas
class ShootingDayBase(BaseModel):
    """Base schema for shooting day data."""
    date: date
    day_number: int = Field(..., ge=1)
    unit_name: str = Field(default="Unit 01", max_length=100)

    # Location and logistics
    location: str = Field(..., max_length=255)
    location_address: Optional[str] = None
    location_coordinates: Optional[str] = Field(None, max_length=100, description="Lat,Lng format")

    # Weather
    weather_notes: Optional[str] = None

    # Timing
    call_time: time
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    wrap_time: Optional[time] = None

    # Status
    status: str = Field(default="scheduled", max_length=50)
    notes: Optional[str] = None


class ShootingDayCreate(ShootingDayBase, CreateSchema):
    """Schema for creating a new shooting day."""
    pass


class ShootingDayUpdate(ShootingDayBase, UpdateSchema):
    """Schema for updating an existing shooting day."""
    pass


class ShootingDayRead(BaseSchema):
    """Schema for reading shooting day data."""
    model_config = ConfigDict(from_attributes=True)

    date: date
    day_number: int
    unit_name: str
    location: str
    location_address: Optional[str]
    location_coordinates: Optional[str]
    weather_notes: Optional[str]
    call_time: time
    start_time: Optional[time]
    end_time: Optional[time]
    wrap_time: Optional[time]
    status: str
    notes: Optional[str]

    # Related data
    total_events: Optional[int] = Field(default=0)
    completed_events: Optional[int] = Field(default=0)


# Event Schemas
class EventBase(BaseModel):
    """Base schema for event data."""
    event_type: str = Field(..., max_length=50)
    title: str = Field(..., max_length=255)
    description: Optional[str] = None

    # Timing
    start_time: time
    end_time: time

    # Scene linkage
    scene_id: Optional[int] = None
    scene_number: Optional[str] = Field(None, max_length=50)

    # Location and setup
    location: Optional[str] = Field(None, max_length=255)
    setup_notes: Optional[str] = None

    # Assignments
    assigned_crew: List[Dict[str, Any]] = Field(default_factory=list)
    required_equipment: List[Dict[str, Any]] = Field(default_factory=list)
    props_costumes: List[Dict[str, Any]] = Field(default_factory=list)

    # Status
    status: str = Field(default="scheduled", max_length=50)
    completion_notes: Optional[str] = None
    actual_start_time: Optional[time] = None
    actual_end_time: Optional[time] = None

    # Dependencies
    depends_on_event_id: Optional[int] = None
    conflict_notes: Optional[str] = None

    # Metadata
    priority: int = Field(default=1, ge=1, le=5)
    is_contingency: bool = False


class EventCreate(EventBase, CreateSchema):
    """Schema for creating a new event."""
    shooting_day_id: int


class EventUpdate(EventBase, UpdateSchema):
    """Schema for updating an existing event."""
    pass


class EventRead(BaseSchema):
    """Schema for reading event data."""
    model_config = ConfigDict(from_attributes=True)

    shooting_day_id: int
    event_type: str
    title: str
    description: Optional[str]
    start_time: time
    end_time: time
    duration_minutes: Optional[int]
    scene_id: Optional[int]
    scene_number: Optional[str]
    location: Optional[str]
    setup_notes: Optional[str]
    assigned_crew: List[Dict[str, Any]]
    required_equipment: List[Dict[str, Any]]
    props_costumes: List[Dict[str, Any]]
    status: str
    completion_notes: Optional[str]
    actual_start_time: Optional[time]
    actual_end_time: Optional[time]
    depends_on_event_id: Optional[int]
    conflict_notes: Optional[str]
    priority: int
    is_contingency: bool


# Call Sheet Schemas
class CallSheetBase(BaseModel):
    """Base schema for call sheet data."""
    title: str = Field(..., max_length=255)

    # Production information
    production_title: Optional[str] = Field(None, max_length=255)
    director: Optional[str] = Field(None, max_length=255)
    producer: Optional[str] = Field(None, max_length=255)
    production_manager: Optional[str] = Field(None, max_length=255)

    # Contact information
    emergency_contacts: List[Dict[str, Any]] = Field(default_factory=list)
    hospital_info: Optional[str] = None

    # Crew and cast
    crew_list: List[Dict[str, Any]] = Field(default_factory=list)
    key_crew: List[Dict[str, Any]] = Field(default_factory=list)
    cast_list: List[Dict[str, Any]] = Field(default_factory=list)

    # Locations and logistics
    locations: List[Dict[str, Any]] = Field(default_factory=list)
    transportation: Dict[str, Any] = Field(default_factory=dict)
    catering: Dict[str, Any] = Field(default_factory=dict)

    # Equipment and props
    equipment_list: List[Dict[str, Any]] = Field(default_factory=list)
    props_costumes: List[Dict[str, Any]] = Field(default_factory=list)

    # Weather
    weather_info: Dict[str, Any] = Field(default_factory=dict)

    # Notes
    general_notes: Optional[str] = None
    safety_notes: Optional[str] = None
    script_notes: Optional[str] = None

    # Status
    status: str = Field(default="draft", max_length=50)


class CallSheetCreate(CallSheetBase, CreateSchema):
    """Schema for creating a new call sheet."""
    shooting_day_id: int


class CallSheetUpdate(CallSheetBase, UpdateSchema):
    """Schema for updating an existing call sheet."""
    pass


class CallSheetRead(BaseSchema):
    """Schema for reading call sheet data."""
    model_config = ConfigDict(from_attributes=True)

    shooting_day_id: int
    version: int
    title: str
    production_title: Optional[str]
    director: Optional[str]
    producer: Optional[str]
    production_manager: Optional[str]
    emergency_contacts: List[Dict[str, Any]]
    hospital_info: Optional[str]
    schedule_summary: Dict[str, Any]
    detailed_schedule: List[Dict[str, Any]]
    crew_list: List[Dict[str, Any]]
    key_crew: List[Dict[str, Any]]
    cast_list: List[Dict[str, Any]]
    locations: List[Dict[str, Any]]
    transportation: Dict[str, Any]
    catering: Dict[str, Any]
    equipment_list: List[Dict[str, Any]]
    props_costumes: List[Dict[str, Any]]
    weather_info: Dict[str, Any]
    general_notes: Optional[str]
    safety_notes: Optional[str]
    script_notes: Optional[str]
    distribution_list: List[str]
    distributed_at: Optional[datetime]
    last_modified_at: Optional[datetime]
    status: str
    file_url: Optional[str]


# API Request/Response Schemas
class ScheduleGenerationRequest(BaseModel):
    """Schema for schedule generation requests."""
    shooting_day_id: int
    include_scenes: List[int] = Field(default_factory=list, description="Scene IDs to include")
    start_time: time = Field(description="Schedule start time")
    buffer_minutes: int = Field(default=30, ge=0, description="Buffer time between events")


class CallSheetGenerationRequest(BaseModel):
    """Schema for call sheet generation requests."""
    shooting_day_id: int
    template_version: str = Field(default="standard", description="Call sheet template to use")


class CallSheetDistributionRequest(BaseModel):
    """Schema for call sheet distribution requests."""
    call_sheet_id: int
    recipients: List[str] = Field(..., description="Email addresses to send to")
    message: Optional[str] = Field(None, description="Optional message to include")


class ConflictDetectionRequest(BaseModel):
    """Schema for conflict detection requests."""
    shooting_day_id: int
    check_crew_conflicts: bool = True
    check_equipment_conflicts: bool = True
    check_location_conflicts: bool = True


class ConflictDetectionResponse(BaseModel):
    """Schema for conflict detection responses."""
    shooting_day_id: int
    has_conflicts: bool
    total_conflicts: int
    conflicts: List[Dict[str, Any]] = Field(default_factory=list)
    recommendations: List[str] = Field(default_factory=list)


class ScheduleOptimizationRequest(BaseModel):
    """Schema for schedule optimization requests."""
    shooting_day_id: int
    optimization_goal: str = Field(default="efficiency", description="efficiency, crew_utilization, equipment_usage")
    constraints: Dict[str, Any] = Field(default_factory=dict, description="Additional constraints")


class ScheduleOptimizationResponse(BaseModel):
    """Schema for schedule optimization responses."""
    shooting_day_id: int
    optimized_schedule: List[Dict[str, Any]] = Field(default_factory=list)
    improvements: List[str] = Field(default_factory=list)
    conflicts_resolved: int = 0


# Filter Schemas
class ShootingDayFilter(BaseModel):
    """Filter parameters for shooting day queries."""
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    status: Optional[str] = None
    location: Optional[str] = None


class EventFilter(BaseModel):
    """Filter parameters for event queries."""
    shooting_day_id: Optional[int] = None
    event_type: Optional[str] = None
    status: Optional[str] = None
    scene_id: Optional[int] = None
    has_conflicts: Optional[bool] = None


class CallSheetFilter(BaseModel):
    """Filter parameters for call sheet queries."""
    shooting_day_id: Optional[int] = None
    status: Optional[str] = None
    version: Optional[int] = None


# Bulk Operations
class BulkEventUpdate(BaseModel):
    """Schema for bulk event updates."""
    event_ids: List[int] = Field(..., description="Event IDs to update")
    updates: Dict[str, Any] = Field(..., description="Fields to update")


class BulkStatusUpdate(BaseModel):
    """Schema for bulk status updates."""
    event_ids: List[int] = Field(..., description="Event IDs to update")
    status: str = Field(..., description="New status for all events")


# Reporting Schemas
class ScheduleReport(BaseModel):
    """Schema for schedule reports."""
    shooting_day_id: int
    date: date
    total_events: int
    total_duration_hours: float
    crew_utilization: Dict[str, float]
    equipment_utilization: Dict[str, float]
    conflicts_count: int
    status_summary: Dict[str, int]


class ProductionScheduleSummary(BaseModel):
    """Schema for production schedule summaries."""
    total_shooting_days: int
    completed_days: int
    upcoming_days: int
    total_events: int
    average_day_duration: float
    crew_efficiency_score: float
    equipment_utilization_score: float