from sqlalchemy import Column, String, BIGINT, TIMESTAMP, func, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from app.core.base import Base


class BankAccount(Base):
    __tablename__ = "bank_accounts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    name = Column(String, nullable=False)
    balance_cents = Column(BIGINT, default=0)
    currency = Column(String, default="BRL")
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    # Relationships
    transactions = relationship("Transaction", back_populates="bank_account")
