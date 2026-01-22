from sqlalchemy import Column, String, TIMESTAMP, func, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from app.core.base import Base


class Client(Base):
    __tablename__ = "clients"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    name = Column(String, nullable=False)
    email = Column(String)
    document_id = Column(String)  # CPF/CNPJ
    phone = Column(String)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    # Relationships
    invoices = relationship("Invoice", back_populates="client", cascade="all, delete-orphan")
