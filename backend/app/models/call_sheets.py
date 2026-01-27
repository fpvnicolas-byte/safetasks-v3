from sqlalchemy import Column, String, TEXT, TIMESTAMP, DATE, TIME, func, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from app.core.base import Base


class CallSheet(Base):
    """
    Professional Call Sheet Model for Video Production.
    Contains all essential information for production day coordination.
    """
    __tablename__ = "call_sheets"

    # Core Fields
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    shooting_day = Column(DATE, nullable=False)
    status = Column(String, default="draft")  # draft, confirmed, completed

    # Location Information
    location = Column(String, nullable=True)  # Location name (e.g., "Studio A", "Client Office")
    location_address = Column(TEXT, nullable=True)  # Full address with Google Maps link
    parking_info = Column(TEXT, nullable=True)  # Parking instructions for crew

    # Time Schedule
    crew_call = Column(TIME, nullable=True)  # General crew call time
    on_set = Column(TIME, nullable=True)  # On-set ready time (shooting call)
    lunch_time = Column(TIME, nullable=True)  # Lunch break time
    wrap_time = Column(TIME, nullable=True)  # Expected wrap time

    # Production Information
    weather = Column(String, nullable=True)  # Weather forecast
    notes = Column(TEXT, nullable=True)  # General production notes

    # Safety & Logistics
    hospital_info = Column(TEXT, nullable=True)  # Nearest hospital/emergency contact

    # Audit Fields
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    project = relationship("Project", back_populates="call_sheets")
