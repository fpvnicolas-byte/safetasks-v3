from sqlalchemy import Column, String, TIMESTAMP, func, ForeignKey, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID
from app.core.base import Base


class Profile(Base):
    __tablename__ = "profiles"

    id = Column(UUID(as_uuid=True), primary_key=True)  # References auth.users(id)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=True)
    full_name = Column(String)
    avatar_url = Column(String)
    role = Column(String, default="viewer")  # admin, manager, crew, viewer
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint("role IN ('admin', 'manager', 'crew', 'viewer')"),
    )
