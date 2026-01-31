from sqlalchemy import Column, String, TIMESTAMP, Boolean, Integer, BIGINT, ForeignKey, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
import uuid
from app.core.base import Base


class Plan(Base):
    __tablename__ = "plans"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    stripe_price_id = Column(String, nullable=True)
    billing_interval = Column(String, nullable=True)  # monthly, annual
    is_custom = Column(Boolean, default=False, nullable=False)

    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class Entitlement(Base):
    __tablename__ = "entitlements"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    plan_id = Column(UUID(as_uuid=True), ForeignKey("plans.id"), nullable=False)

    max_projects = Column(Integer, nullable=True)
    max_clients = Column(Integer, nullable=True)
    max_proposals = Column(Integer, nullable=True)
    max_users = Column(Integer, nullable=True)
    max_storage_bytes = Column(BIGINT, nullable=True)
    ai_credits = Column(Integer, nullable=True)

    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class OrganizationUsage(Base):
    __tablename__ = "organization_usage"

    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), primary_key=True)
    storage_bytes_used = Column(BIGINT, default=0, nullable=False)
    ai_credits_used = Column(Integer, default=0, nullable=False)
    projects_count = Column(Integer, default=0, nullable=False)
    clients_count = Column(Integer, default=0, nullable=False)
    proposals_count = Column(Integer, default=0, nullable=False)
    users_count = Column(Integer, default=0, nullable=False)

    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class BillingEvent(Base):
    __tablename__ = "billing_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    stripe_event_id = Column(String, nullable=False, unique=True)
    event_type = Column(String, nullable=False)
    status = Column(String, nullable=False)  # received, processed, failed
    received_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    processed_at = Column(TIMESTAMP(timezone=True), nullable=True)

    __table_args__ = (
        UniqueConstraint("stripe_event_id", name="uq_billing_events_stripe_event_id"),
    )
