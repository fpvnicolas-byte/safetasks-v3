from sqlalchemy import Column, String, TIMESTAMP, Boolean, func, CheckConstraint, ForeignKey
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
    tax_id = Column(String, nullable=True)

    # Subscription & Billing
    plan = Column(String, default="free", nullable=False)  # free, starter, professional, enterprise
    subscription_status = Column(String, default="trialing", nullable=False)  # trialing, active, past_due, cancelled, paused
    billing_status = Column(String, nullable=True)  # trial_active, trial_ended, active, past_due, canceled, blocked, billing_pending_review
    trial_ends_at = Column(TIMESTAMP(timezone=True), nullable=True)
    stripe_customer_id = Column(String, nullable=True)
    stripe_subscription_id = Column(String, nullable=True)
    plan_id = Column(UUID(as_uuid=True), ForeignKey("plans.id"), nullable=True)
    billing_contact_user_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id"), nullable=True)
    owner_profile_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id"), nullable=True)

    # Status management
    is_active = Column(Boolean, default=True, nullable=False)

    # Audit
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        CheckConstraint("plan IN ('free', 'starter', 'professional', 'enterprise')"),
        CheckConstraint("subscription_status IN ('trialing', 'active', 'past_due', 'cancelled', 'paused')"),
        CheckConstraint(
            "billing_status IN ('trial_active', 'trial_ended', 'active', 'past_due', 'canceled', 'blocked', 'billing_pending_review')"
        ),
    )
