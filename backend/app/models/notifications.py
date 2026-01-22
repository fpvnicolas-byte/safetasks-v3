from sqlalchemy import Column, String, TEXT, TIMESTAMP, func, ForeignKey, Boolean
from sqlalchemy.dialects.postgresql import UUID
from app.core.base import Base
import uuid


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    profile_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id"), nullable=False)
    title = Column(String, nullable=False)
    message = Column(TEXT, nullable=False)
    type = Column(String, nullable=False)  # info, warning, success, error
    is_read = Column(Boolean, default=False)
    metadata = Column(TEXT)  # JSON string for additional data
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    read_at = Column(TIMESTAMP(timezone=True), nullable=True)
