from sqlalchemy import Column, String, TEXT, TIMESTAMP, func, ForeignKey, Time, Date
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.base import Base
import uuid


class ShootingDay(Base):
    __tablename__ = "shooting_days"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)

    date = Column(Date, nullable=False)
    status = Column(String, default="draft")  # draft, confirmed, completed
    call_time = Column(Time, nullable=False)
    on_set = Column(Time, nullable=True)
    lunch_time = Column(Time, nullable=True)
    wrap_time = Column(Time, nullable=True)

    # Location information (can be free text or reference to a location table)
    location_name = Column(String, nullable=False)
    location_address = Column(TEXT, nullable=True)

    # Weather and notes
    weather_forecast = Column(TEXT, nullable=True)
    notes = Column(TEXT, nullable=True)
    parking_info = Column(TEXT, nullable=True)
    hospital_info = Column(TEXT, nullable=True)

    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    project = relationship("Project", back_populates="shooting_days")
    scenes = relationship("Scene", back_populates="shooting_day")

    __table_args__ = (
        {'schema': None}
    )
