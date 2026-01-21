from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from .base import Base


class Organization(Base):
    """
    Organization/Tenant model for multi-tenancy.
    Represents a company or production company.
    """
    __tablename__ = "organizations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    domain = Column(String, unique=True, index=True)  # For domain-based tenant identification
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    users = relationship("User", back_populates="organization")


class User(Base):
    """
    User model for internal user management.
    Mirrors Supabase Auth users but allows for additional metadata.
    """
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True)  # Supabase user ID
    email = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String)
    avatar_url = Column(String)
    role = Column(String, default="user")  # admin, manager, user, etc.

    # Multi-tenancy
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    organization = relationship("Organization", back_populates="users")

    # Status
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_login_at = Column(DateTime(timezone=True))

    def __repr__(self):
        return f"<User(id={self.id}, email={self.email}, role={self.role})>"