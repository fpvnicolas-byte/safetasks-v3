from sqlalchemy import BIGINT, TIMESTAMP, Column, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
import uuid
from app.core.base import Base


class BillingPurchase(Base):
    __tablename__ = "billing_purchases"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True)
    source_billing_event_id = Column(UUID(as_uuid=True), ForeignKey("billing_events.id"), nullable=True)
    
    provider = Column(String, nullable=False)  # payment provider slug (e.g. stripe)
    external_charge_id = Column(String, nullable=True)
    plan_name = Column(String, nullable=True)
    
    amount_paid_cents = Column(BIGINT, nullable=False)
    currency = Column(String, default="BRL", nullable=False)
    paid_at = Column(TIMESTAMP(timezone=True), nullable=False)
    
    total_refunded_cents = Column(BIGINT, default=0, nullable=False)
    
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
