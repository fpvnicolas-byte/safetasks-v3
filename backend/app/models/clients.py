from sqlalchemy import Column, String, TIMESTAMP, Boolean, func, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from app.core.base import Base


class Client(Base):
    """
    Client/Customer model for video production projects.

    Represents companies or individuals who commission video production work.
    """
    __tablename__ = "clients"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    name = Column(String, nullable=False)
    email = Column(String)
    document = Column(String)  # CPF/CNPJ (Brazil) or Tax ID (international)
    phone = Column(String)

    # Status management (soft delete)
    is_active = Column(Boolean, default=True, nullable=False)

    # Audit
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    projects = relationship("Project", back_populates="client", cascade="all, delete-orphan")
    invoices = relationship("Invoice", back_populates="client", cascade="all, delete-orphan")
