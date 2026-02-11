from sqlalchemy import Column, String, TIMESTAMP, Boolean, func, CheckConstraint, ForeignKey, Numeric
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime
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

    # Default tax rates (percentages, e.g. 15.00 = 15%)
    cnpj_tax_rate = Column(Numeric(5, 2), nullable=True, default=0)
    produtora_tax_rate = Column(Numeric(5, 2), nullable=True, default=0)

    # Subscription & Billing
    plan = Column(String, default="free", nullable=False)  # free, starter, professional, enterprise
    subscription_status = Column(String, default="trialing", nullable=False)  # trialing, active, past_due, cancelled, paused
    billing_status = Column(String, nullable=True)  # trial_active, trial_ended, active, past_due, canceled, blocked, billing_pending_review
    trial_ends_at = Column(TIMESTAMP(timezone=True), nullable=True)
    stripe_customer_id = Column(String, nullable=True)
    stripe_subscription_id = Column(String, nullable=True)
    access_ends_at = Column(TIMESTAMP(timezone=True), nullable=True) # For pre-paid access (InfinityPay)

    # Stripe Connect (for receiving payments from clients)
    stripe_connect_account_id = Column(String, nullable=True)           # e.g., "acct_xxx"
    stripe_connect_onboarding_complete = Column(Boolean, default=False, nullable=False)
    stripe_connect_enabled_at = Column(TIMESTAMP(timezone=True), nullable=True)
    plan_id = Column(UUID(as_uuid=True), ForeignKey("plans.id"), nullable=True)
    billing_contact_user_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id"), nullable=True)
    owner_profile_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id"), nullable=True)
    default_bank_account_id = Column(UUID(as_uuid=True), ForeignKey("bank_accounts.id"), nullable=True)

    # Status management
    is_active = Column(Boolean, default=True, nullable=False)

    # Audit
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        CheckConstraint("plan IN ('free', 'starter', 'professional', 'pro', 'pro_annual', 'enterprise')"),
        CheckConstraint("subscription_status IN ('trialing', 'active', 'past_due', 'cancelled', 'paused')"),
        CheckConstraint(
            "billing_status IN ('trial_active', 'trial_ended', 'active', 'past_due', 'canceled', 'blocked', 'billing_pending_review')"
        ),
    )
