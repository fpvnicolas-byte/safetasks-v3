from sqlalchemy import Column, String, TEXT, TIMESTAMP, Boolean, func, ForeignKey, BIGINT, DECIMAL, Date, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.base import Base
import uuid
import enum


class TaxTypeEnum(str, enum.Enum):
    iss = "iss"          # Service Tax (Brazil)
    irrf = "irrf"        # Income Tax Withholding
    pis = "pis"          # Social Contribution Tax
    cofins = "cofins"    # Social Contribution Tax
    csll = "csll"        # Social Contribution Tax
    inss = "inss"        # Social Security
    rental_tax = "rental_tax"  # Equipment rental tax
    other = "other"


class InvoiceStatusEnum(str, enum.Enum):
    draft = "draft"
    sent = "sent"
    paid = "paid"
    overdue = "overdue"
    cancelled = "cancelled"


class InvoicePaymentMethodEnum(str, enum.Enum):
    """How the client is expected to pay this invoice."""
    stripe = "stripe"                # Online payment via Stripe (enables payment link generation)
    bank_transfer = "bank_transfer"  # Manual bank transfer / TED / DOC
    pix_manual = "pix_manual"        # PIX sent manually (not via Stripe)
    boleto_manual = "boleto_manual"  # Boleto generated outside Stripe
    cash = "cash"                    # Cash payment
    other = "other"                  # Other method


class BudgetCategoryEnum(str, enum.Enum):
    """Standard production budget categories."""
    CREW = "crew"
    EQUIPMENT = "equipment"
    LOCATIONS = "locations"
    TALENT = "talent"
    TRANSPORTATION = "transportation"
    CATERING = "catering"
    POST_PRODUCTION = "post_production"
    MUSIC_LICENSING = "music_licensing"
    INSURANCE = "insurance"
    CONTINGENCY = "contingency"
    OTHER = "other"


class TaxTable(Base):
    """
    Tax configuration table for Brazilian tax compliance.

    Defines tax rates and applicability rules for different transaction types.
    """
    __tablename__ = "tax_tables"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)

    name = Column(String, nullable=False)  # e.g., "ISS 5%", "IRRF 1.5%"
    tax_type = Column(Enum(TaxTypeEnum, values_callable=lambda x: [e.value for e in x]), nullable=False)
    rate_percentage = Column(DECIMAL(5, 2), nullable=False)  # e.g., 5.00 for 5%
    description = Column(TEXT, nullable=True)

    # Applicability rules (JSON stored as TEXT)
    applies_to_income = Column(TEXT, nullable=True)  # JSON: {"categories": ["production_revenue"]}
    applies_to_expenses = Column(TEXT, nullable=True)  # JSON: {"categories": ["crew_hire"]}

    # Status management
    is_active = Column(Boolean, default=True, nullable=False)

    # Audit
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        {'schema': None}
    )


class Invoice(Base):
    """
    Invoice/Nota Fiscal model for billing clients.

    Tracks invoices issued to clients for video production services.
    All amounts stored in cents for precision (e.g., R$ 1.500,00 = 150000 cents).
    """
    __tablename__ = "invoices"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=True)
    proposal_id = Column(UUID(as_uuid=True), ForeignKey("proposals.id"), nullable=True)

    invoice_number = Column(String, nullable=False)  # Auto-generated: INV-{year}-{sequential}
    status = Column(Enum(InvoiceStatusEnum, values_callable=lambda x: [e.value for e in x]), nullable=False, default=InvoiceStatusEnum.draft)

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

    # Payment details
    payment_method = Column(String, nullable=True)  # InvoicePaymentMethodEnum value
    payment_reference = Column(String, nullable=True)
    payment_notes = Column(TEXT, nullable=True)

    # Stripe Connect payment fields
    stripe_checkout_session_id = Column(String, nullable=True)    # Checkout Session ID
    stripe_payment_intent_id = Column(String, nullable=True)      # PaymentIntent ID (after payment)
    payment_link_url = Column(String, nullable=True)              # Generated checkout URL
    payment_link_expires_at = Column(TIMESTAMP(timezone=True), nullable=True)  # Checkout session expiry
    paid_at = Column(TIMESTAMP(timezone=True), nullable=True)     # When payment was confirmed
    paid_via = Column(String, nullable=True)                      # Actual method: stripe_card, stripe_pix, stripe_boleto, manual

    # Status management
    is_active = Column(Boolean, default=True, nullable=False)

    # Audit
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    client = relationship("Client", back_populates="invoices")
    project = relationship("Project", back_populates="invoices")
    proposal = relationship("Proposal")
    items = relationship("InvoiceItem", back_populates="invoice", cascade="all, delete-orphan", passive_deletes=True)

    __table_args__ = (
        {'schema': None}
    )


class InvoiceItem(Base):
    """
    Line items for invoices.

    Represents individual services/products billed in an invoice.
    """
    __tablename__ = "invoice_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False)

    description = Column(String, nullable=False)
    quantity = Column(DECIMAL(10, 2), nullable=False, default=1)
    unit_price_cents = Column(BIGINT, nullable=False)
    total_cents = Column(BIGINT, nullable=False)  # quantity * unit_price_cents

    # Optional link to project elements
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=True)
    category = Column(String, nullable=True)  # crew_hire, equipment_rental, etc.

    # Status management
    is_active = Column(Boolean, default=True, nullable=False)

    # Audit
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    invoice = relationship("Invoice", back_populates="items")

    __table_args__ = (
        {'schema': None}
    )


class ProjectBudgetLine(Base):
    """Individual budget line item within a project."""
    __tablename__ = "project_budget_lines"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)

    # Budget line details
    category = Column(Enum(BudgetCategoryEnum, values_callable=lambda x: [e.value for e in x]), nullable=False)
    description = Column(String, nullable=False)

    # Amounts (in cents)
    estimated_amount_cents = Column(BIGINT, nullable=False, default=0)

    # Optional links
    stakeholder_id = Column(UUID(as_uuid=True), ForeignKey("stakeholders.id"), nullable=True)
    supplier_id = Column(UUID(as_uuid=True), ForeignKey("suppliers.id"), nullable=True)

    # Metadata
    notes = Column(TEXT, nullable=True)
    sort_order = Column(BIGINT, nullable=False, default=0)

    # Timestamps
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    project = relationship("Project", back_populates="budget_lines")
    stakeholder = relationship("Stakeholder")
    supplier = relationship("Supplier")
    transactions = relationship("Transaction", back_populates="budget_line")

    __table_args__ = (
        {'schema': None}
    )
