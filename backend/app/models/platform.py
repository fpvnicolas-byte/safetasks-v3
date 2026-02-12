from sqlalchemy import Column, String, TIMESTAMP, Boolean, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from app.core.base import Base

class PlatformAdminUser(Base):
    __tablename__ = "platform_admin_users"

    profile_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id"), primary_key=True)
    role = Column(String, server_default="superadmin", nullable=False) # superadmin, viewer
    is_active = Column(Boolean, default=True, nullable=False)
    
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
