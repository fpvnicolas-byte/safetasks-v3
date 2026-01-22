from sqlalchemy import Column, String, TIMESTAMP, func, ForeignKey, TEXT
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.core.base import Base
import uuid


class Supplier(Base):
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

    is_active = Column(TEXT, nullable=False, default=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        {'schema': None}
    )
