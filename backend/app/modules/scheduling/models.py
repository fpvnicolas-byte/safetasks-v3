from datetime import time
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, Time, Date, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.base import Base


class ShootingDay(Base):
    """
    ShootingDay model for managing production shooting schedules.
    Represents a single day of production with location, weather, and timing information.
    """
    __tablename__ = "shooting_days"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, nullable=False, index=True)

    # Production details
    day_number = Column(Integer, nullable=False)  # Day 1, 2, 3, etc.
    unit_name = Column(String(100), default="Unit 01")  # Production unit identifier

    # Location and logistics
    location = Column(String(255), nullable=False)
    location_address = Column(Text)
    location_coordinates = Column(String(100))  # Lat,Lng format

    # Weather and conditions
    weather_forecast = Column(JSON, default=dict)  # Weather API data
    weather_notes = Column(Text)

    # Timing
    call_time = Column(Time, nullable=False)  # When crew should arrive
    start_time = Column(Time)  # Actual shooting start time
    end_time = Column(Time)  # Expected/actual end time
    wrap_time = Column(Time)  # When shooting officially ends

    # Status and progress
    status = Column(String(50), default="scheduled")  # scheduled, in_progress, completed, cancelled
    completed_scenes = Column(JSON, default=list)  # List of completed scene IDs
    notes = Column(Text)

    # Metadata
    created_by = Column(String, ForeignKey("users.id"), nullable=False)
    updated_by = Column(String, ForeignKey("users.id"))

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    events = relationship("Event", back_populates="shooting_day", cascade="all, delete-orphan")
    call_sheets = relationship("CallSheet", back_populates="shooting_day")

    def get_total_scheduled_time(self) -> int:
        """Get total scheduled shooting time in minutes."""
        if self.start_time and self.end_time:
            start_minutes = self.start_time.hour * 60 + self.start_time.minute
            end_minutes = self.end_time.hour * 60 + self.end_time.minute
            return max(0, end_minutes - start_minutes)
        return 0

    def __repr__(self):
        return f"<ShootingDay(id={self.id}, date={self.date}, day_number={self.day_number}, location={self.location})>"


class Event(Base):
    """
    Event model for individual scheduled events within a shooting day.
    Represents scenes, setups, meals, travel, etc. with time slots and assignments.
    """
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    shooting_day_id = Column(Integer, ForeignKey("shooting_days.id"), nullable=False)

    # Event identification
    event_type = Column(String(50), nullable=False, index=True)  # scene, setup, meal, travel, etc.
    title = Column(String(255), nullable=False)
    description = Column(Text)

    # Timing
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    duration_minutes = Column(Integer)  # Calculated duration

    # Scene linkage (if applicable)
    scene_id = Column(Integer, ForeignKey("scenes.id"))  # From production module
    scene_number = Column(String(50))  # Cached for performance

    # Location and setup
    location = Column(String(255))  # Specific location within shooting day location
    setup_notes = Column(Text)

    # Crew and equipment assignments
    assigned_crew = Column(JSON, default=list)  # List of crew member assignments
    required_equipment = Column(JSON, default=list)  # Equipment needed
    props_costumes = Column(JSON, default=list)  # Props and costumes needed

    # Status and completion
    status = Column(String(50), default="scheduled")  # scheduled, in_progress, completed, cancelled
    completion_notes = Column(Text)
    actual_start_time = Column(Time)
    actual_end_time = Column(Time)

    # Dependencies and conflicts
    depends_on_event_id = Column(Integer, ForeignKey("events.id"))  # Event that must complete first
    conflict_notes = Column(Text)

    # Metadata
    priority = Column(Integer, default=1)  # 1=low, 5=high
    is_contingency = Column(Boolean, default=False)  # Backup plan event

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    shooting_day = relationship("ShootingDay", back_populates="events")
    depends_on_event = relationship("Event", remote_side=[id])

    def calculate_duration(self) -> int:
        """Calculate duration in minutes."""
        if self.start_time and self.end_time:
            start_minutes = self.start_time.hour * 60 + self.start_time.minute
            end_minutes = self.end_time.hour * 60 + self.end_time.minute
            return max(0, end_minutes - start_minutes)
        return 0

    def has_conflicts(self) -> bool:
        """Check if this event has any scheduling conflicts."""
        # This would be implemented with more complex logic
        # For now, just check if it overlaps with other events
        return bool(self.conflict_notes)

    def __repr__(self):
        return f"<Event(id={self.id}, type={self.event_type}, title={self.title}, start={self.start_time})>"


class CallSheet(Base):
    """
    CallSheet model for automated call sheet generation and distribution.
    Contains all information needed for a shooting day: schedule, crew, locations, etc.
    """
    __tablename__ = "call_sheets"

    id = Column(Integer, primary_key=True, index=True)
    shooting_day_id = Column(Integer, ForeignKey("shooting_days.id"), nullable=False)

    # Call sheet metadata
    version = Column(Integer, default=1)  # Version control for updates
    title = Column(String(255), nullable=False)  # "Call Sheet - Day X"

    # Production information
    production_title = Column(String(255))
    director = Column(String(255))
    producer = Column(String(255))
    production_manager = Column(String(255))

    # Contact information
    emergency_contacts = Column(JSON, default=list)
    hospital_info = Column(Text)

    # Schedule summary
    schedule_summary = Column(JSON, default=dict)  # High-level schedule overview

    # Detailed schedule (cached from events)
    detailed_schedule = Column(JSON, default=list)

    # Crew information
    crew_list = Column(JSON, default=list)  # All crew members with roles and contacts
    key_crew = Column(JSON, default=list)  # Director, DP, AD, etc.

    # Cast information
    cast_list = Column(JSON, default=list)  # Cast members appearing that day

    # Locations and logistics
    locations = Column(JSON, default=list)  # All locations for the day
    transportation = Column(JSON, default=dict)  # Transport arrangements
    catering = Column(JSON, default=dict)  # Meal arrangements

    # Equipment and props
    equipment_list = Column(JSON, default=list)
    props_costumes = Column(JSON, default=list)

    # Weather and conditions
    weather_info = Column(JSON, default=dict)

    # Special notes and instructions
    general_notes = Column(Text)
    safety_notes = Column(Text)
    script_notes = Column(Text)

    # Distribution
    distribution_list = Column(JSON, default=list)  # Email addresses for distribution
    distributed_at = Column(DateTime(timezone=True))
    last_modified_at = Column(DateTime(timezone=True))

    # Status
    status = Column(String(50), default="draft")  # draft, final, distributed, archived

    # File storage (if generated as PDF)
    file_url = Column(String(500))  # Supabase Storage URL

    # Metadata
    created_by = Column(String, ForeignKey("users.id"), nullable=False)
    updated_by = Column(String, ForeignKey("users.id"))

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    shooting_day = relationship("ShootingDay", back_populates="call_sheets")

    def generate_schedule_summary(self) -> dict:
        """Generate a summary of the day's schedule."""
        # This would aggregate data from related events
        return {
            "call_time": self.shooting_day.call_time.isoformat() if self.shooting_day.call_time else None,
            "locations": self.locations,
            "total_events": len(self.detailed_schedule),
            "estimated_wrap": self.shooting_day.wrap_time.isoformat() if self.shooting_day.wrap_time else None
        }

    def mark_distributed(self, distributed_to: list):
        """Mark the call sheet as distributed."""
        self.distribution_list = distributed_to
        self.distributed_at = func.now()
        self.status = "distributed"

    def __repr__(self):
        return f"<CallSheet(id={self.id}, shooting_day_id={self.shooting_day_id}, version={self.version}, status={self.status})>"


# Predefined event types
EVENT_TYPES = {
    "SCENE": "Actual shooting scene",
    "SETUP": "Equipment/camera setup",
    "TEARDOWN": "Equipment breakdown",
    "MEAL": "Lunch, dinner, crafty breaks",
    "TRAVEL": "Travel between locations",
    "PREP": "Pre-shooting preparation",
    "WRAP": "End of day wrap",
    "REHEARSAL": "Rehearsal time",
    "TESTS": "Camera/lighting tests",
    "OTHER": "Miscellaneous events"
}

# Call sheet statuses
CALL_SHEET_STATUSES = ["draft", "final", "distributed", "archived"]

# Shooting day statuses
SHOOTING_DAY_STATUSES = ["scheduled", "in_progress", "completed", "cancelled", "postponed"]