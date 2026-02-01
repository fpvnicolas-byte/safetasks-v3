from sqlalchemy import Column, String, TIMESTAMP, Boolean, func, ForeignKey, TEXT, Integer, BigInteger
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.core.base import Base
import uuid
import enum


class StakeholderStatusEnum(enum.Enum):
    """Booking status for stakeholder on a project."""
    REQUESTED = "requested"      # Initial outreach
    CONFIRMED = "confirmed"      # Accepted booking
    WORKING = "working"          # Currently on project
    COMPLETED = "completed"      # Work finished
    CANCELLED = "cancelled"      # Booking cancelled


class Supplier(Base):
    """
    Supplier/Vendor model for production equipment and services.

    Represents rental houses, freelancers, catering companies, and other vendors.
    """
    __tablename__ = "suppliers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)

    name = Column(String, nullable=False)
    category = Column(String, nullable=False)  # rental_house, freelancer, catering, transport, post_production, other
    document_id = Column(String)  # CPF/CNPJ
    email = Column(String)
    phone = Column(String)
    address = Column(TEXT)

    # Payment information (JSONB for flexibility)
    bank_info = Column(JSONB)  # {"bank": "123", "agency": "4567", "account": "890123", "pix_key": "email@domain.com"}

    # Specialization details
    specialties = Column(JSONB)  # ["drone_rental", "camera_gear", "lighting"] for rental houses
    notes = Column(TEXT)

    # Status management
    is_active = Column(Boolean, default=True, nullable=False)

    # Relationships
    transactions = relationship("Transaction", back_populates="supplier")
    stakeholders = relationship("Stakeholder", back_populates="supplier")

    # Audit
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        {'schema': None}
    )


class Stakeholder(Base):
    """
    Stakeholder model for project team members and collaborators.

    Represents directors, producers, DPs, and other key project personnel.
    Can be optionally linked to a Supplier for payment tracking.
    """
    __tablename__ = "stakeholders"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    supplier_id = Column(UUID(as_uuid=True), ForeignKey("suppliers.id"), nullable=True)  # Link to payment records

    name = Column(String, nullable=False)
    role = Column(String, nullable=False)  # Director, Producer, DP, Gaffer, Sound, etc.
    email = Column(String)
    phone = Column(String)
    notes = Column(TEXT)

    # Rate management fields
    rate_type = Column(String(20), nullable=True)  # 'daily', 'hourly', 'fixed'
    rate_value_cents = Column(BigInteger, nullable=True)  # Rate in cents for precision
    estimated_units = Column(Integer, nullable=True)  # Hours for hourly, days override for daily

    is_active = Column(Boolean, default=True, nullable=False)

    # Relationships
    supplier = relationship("Supplier", back_populates="stakeholders")
    transactions = relationship("Transaction", back_populates="stakeholder")

    # Audit
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        {'schema': None}
    )
