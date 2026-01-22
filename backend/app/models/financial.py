from sqlalchemy import Column, String, TEXT, TIMESTAMP, func, ForeignKey, BIGINT, DECIMAL, Date, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.base import Base
import uuid
import enum


class TaxTypeEnum(enum.Enum):
    iss = "iss"          # Service Tax (Brazil)
    irrf = "irrf"        # Income Tax Withholding
    pis = "pis"          # Social Contribution Tax
    cofins = "cofins"    # Social Contribution Tax
    csll = "csll"        # Social Contribution Tax
    inss = "inss"        # Social Security
    rental_tax = "rental_tax"  # Equipment rental tax
    other = "other"


class InvoiceStatusEnum(enum.Enum):
    draft = "draft"
    sent = "sent"
    paid = "paid"
    overdue = "overdue"
    cancelled = "cancelled"


class TaxTable(Base):
    __tablename__ = "tax_tables"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)

    name = Column(String, nullable=False)  # e.g., "ISS 5%", "IRRF 1.5%"
    tax_type = Column(Enum(TaxTypeEnum), nullable=False)
    rate_percentage = Column(DECIMAL(5, 2), nullable=False)  # e.g., 5.00 for 5%
    description = Column(TEXT, nullable=True)

    # Applicability rules
    applies_to_income = Column(TEXT, nullable=True)  # JSON: {"categories": ["production_revenue"]}
    applies_to_expenses = Column(TEXT, nullable=True)  # JSON: {"categories": ["crew_hire"]}

    is_active = Column(TEXT, nullable=False, default=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        {'schema': None}
    )


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=True)

    invoice_number = Column(String, nullable=False)  # Auto-generated: INV-{year}-{sequential}
    status = Column(Enum(InvoiceStatusEnum), nullable=False, default=InvoiceStatusEnum.draft)

    # Financial amounts (in cents)
    subtotal_cents = Column(BIGINT, nullable=False)  # Before taxes
    tax_amount_cents = Column(BIGINT, nullable=False, default=0)  # Total taxes
    total_amount_cents = Column(BIGINT, nullable=False)  # Final amount

    currency = Column(String, nullable=False, default="BRL")

    # Dates
    issue_date = Column(Date, nullable=False, server_default=func.current_date())
    due_date = Column(Date, nullable=False)
    paid_date = Column(Date, nullable=True)

    # Invoice details
    description = Column(TEXT, nullable=True)
    notes = Column(TEXT, nullable=True)

    # Relationships
    client = relationship("Client", back_populates="invoices")
    project = relationship("Project", back_populates="invoices")

    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        {'schema': None}
    )


class InvoiceItem(Base):
    __tablename__ = "invoice_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("invoices.id"), nullable=False)

    description = Column(String, nullable=False)
    quantity = Column(DECIMAL(10, 2), nullable=False, default=1)
    unit_price_cents = Column(BIGINT, nullable=False)
    total_cents = Column(BIGINT, nullable=False)  # quantity * unit_price_cents

    # Optional link to project elements
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=True)
    category = Column(String, nullable=True)  # crew_hire, equipment_rental, etc.

    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    # Relationships
    invoice = relationship("Invoice", back_populates="items")

    __table_args__ = (
        {'schema': None}
    )
