from sqlalchemy import Column, String, TIMESTAMP, DATE, TIME, func, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
import uuid
from app.core.base import Base


class CallSheet(Base):
    __tablename__ = "call_sheets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    shooting_day = Column(DATE, nullable=False)
    location = Column(String)
    weather = Column(String)
    call_time = Column(TIME)
    status = Column(String, default="draft")  # draft, confirmed, completed
    notes = Column(String)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())
