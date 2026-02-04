from sqlalchemy import Column, String, TEXT, TIMESTAMP, DATE, func, ForeignKey, BIGINT
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
import uuid
from app.core.base import Base

class Proposal(Base):
    __tablename__ = "proposals"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=True)
    title = Column(String, nullable=False)
    description = Column(TEXT)
    status = Column(String, default="draft")  # draft, sent, approved, rejected, expired
    valid_until = Column(DATE)
    start_date = Column(DATE)
    end_date = Column(DATE)
    total_amount_cents = Column(BIGINT)
    base_amount_cents = Column(BIGINT, nullable=True)  # Discount stored as negative cents
    currency = Column(String, default="BRL")
    terms_conditions = Column(TEXT)
    
    # CORREÇÃO: Nome alterado para evitar conflito
    proposal_metadata = Column(JSONB)  
    
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())

    # Many-to-Many relationship with Service
    services = relationship("Service", secondary="proposal_services", backref="proposals")

    # Relationships
    client = relationship("Client", backref="proposals")


from sqlalchemy import Table

# Association table for Proposal <-> Service
proposal_services = Table(
    "proposal_services",
    Base.metadata,
    Column("proposal_id", UUID(as_uuid=True), ForeignKey("proposals.id"), primary_key=True),
    Column("service_id", UUID(as_uuid=True), ForeignKey("services.id"), primary_key=True),
)
