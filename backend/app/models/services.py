from sqlalchemy import Column, String, TIMESTAMP, BIGINT, func, ForeignKey, Boolean, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from app.core.base import Base


class Service(Base):
    __tablename__ = "services"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(String)
    value_cents = Column(BIGINT, default=0, nullable=False)  # Service value/price in cents

    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    equipment_links = relationship("ServiceEquipment", back_populates="service", cascade="all, delete-orphan")


class ServiceEquipment(Base):
    """Links equipment kits to services."""
    __tablename__ = "service_equipment"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    service_id = Column(UUID(as_uuid=True), ForeignKey("services.id"), nullable=False)
    kit_id = Column(UUID(as_uuid=True), ForeignKey("kits.id"), nullable=False)

    # Usage tracking
    is_primary = Column(Boolean, default=False)  # Main equipment for this service
    notes = Column(String, nullable=True)

    # Timestamps
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    service = relationship("Service", back_populates="equipment_links")
    kit = relationship("Kit", back_populates="service_links")

    __table_args__ = (
        UniqueConstraint('service_id', 'kit_id', name='uq_service_kit'),
    )
