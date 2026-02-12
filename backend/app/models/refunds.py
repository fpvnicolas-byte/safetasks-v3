from sqlalchemy import Column, String, TIMESTAMP, Boolean, BIGINT, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
import uuid
from app.core.base import Base

class BillingPurchase(Base):
    __tablename__ = "billing_purchases"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True)
    source_billing_event_id = Column(UUID(as_uuid=True), ForeignKey("billing_events.id"), nullable=True)
    
    provider = Column(String, nullable=False) # infinitypay, stripe
    external_charge_id = Column(String, nullable=True)
    plan_name = Column(String, nullable=True)
    
    amount_paid_cents = Column(BIGINT, nullable=False)
    currency = Column(String, default="BRL", nullable=False)
    paid_at = Column(TIMESTAMP(timezone=True), nullable=False)
    
    total_refunded_cents = Column(BIGINT, default=0, nullable=False)
    
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class RefundRequest(Base):
    __tablename__ = "refund_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    purchase_id = Column(UUID(as_uuid=True), ForeignKey("billing_purchases.id"), nullable=False)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True)
    requester_profile_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id"), nullable=False)
    
    status = Column(String, default="requested", nullable=False, index=True) 
    # requested, approved, rejected, processing, refunded, failed, canceled
    
    reason_code = Column(String, nullable=True)
    reason_detail = Column(String, nullable=True)
    
    amount_paid_cents = Column(BIGINT, nullable=False)
    consumed_usage_value_cents = Column(BIGINT, default=0, nullable=False)
    calculated_max_refund_cents = Column(BIGINT, nullable=False)
    
    approved_amount_cents = Column(BIGINT, nullable=True)
    eligible_until = Column(TIMESTAMP(timezone=True), nullable=False)
    
    requested_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    decided_at = Column(TIMESTAMP(timezone=True), nullable=True)
    processed_at = Column(TIMESTAMP(timezone=True), nullable=True)
    
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class RefundTransaction(Base):
    __tablename__ = "refund_transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    refund_request_id = Column(UUID(as_uuid=True), ForeignKey("refund_requests.id"), nullable=False)
    
    provider = Column(String, nullable=False)
    provider_refund_id = Column(String, nullable=True) # External Proof
    amount_cents = Column(BIGINT, nullable=False)
    
    status = Column(String, default="pending", nullable=False) # pending, succeeded, failed
    failure_reason = Column(String, nullable=True)
    
    requested_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    completed_at = Column(TIMESTAMP(timezone=True), nullable=True)
    
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class RefundEvent(Base):
    __tablename__ = "refund_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    refund_request_id = Column(UUID(as_uuid=True), ForeignKey("refund_requests.id"), nullable=False)
    
    actor_type = Column(String, nullable=False) # system, user, platform_admin
    actor_id = Column(UUID(as_uuid=True), nullable=True)
    
    event_type = Column(String, nullable=False) # created, approved, rejected, refunded
    event_metadata = Column(JSONB, nullable=True)
    
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
