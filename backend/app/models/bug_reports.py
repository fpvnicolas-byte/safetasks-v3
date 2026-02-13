from sqlalchemy import Column, String, Text, TIMESTAMP, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
import uuid
from app.core.base import Base


class BugReport(Base):
    __tablename__ = "bug_reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True)
    reporter_profile_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id"), nullable=False)

    title = Column(String, nullable=False)
    category = Column(String, nullable=False)  # bug, feature_request, other
    description = Column(Text, nullable=False)

    status = Column(String, default="open", nullable=False, index=True)
    # open, in_review, resolved, closed

    admin_notes = Column(Text, nullable=True)

    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
