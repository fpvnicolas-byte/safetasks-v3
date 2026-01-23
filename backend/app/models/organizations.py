from sqlalchemy import Column, String, TIMESTAMP, Boolean, func, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID
import uuid
from app.core.base import Base


class Organization(Base):
    """
    Multi-tenant Organization model.

    Represents a video production company with subscription management.
    Each user belongs to one organization (multi-tenancy isolation).
    """
    __tablename__ = "organizations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    slug = Column(String, unique=True, nullable=False)

    # Subscription & Billing
    plan = Column(String, default="free", nullable=False)  # free, starter, professional, enterprise
    subscription_status = Column(String, default="trialing", nullable=False)  # trialing, active, past_due, cancelled, paused

    # Status management
    is_active = Column(Boolean, default=True, nullable=False)

    # Audit
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        CheckConstraint("plan IN ('free', 'starter', 'professional', 'enterprise')"),
        CheckConstraint("subscription_status IN ('trialing', 'active', 'past_due', 'cancelled', 'paused')"),
    )
