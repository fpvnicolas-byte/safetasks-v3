from decimal import Decimal
from sqlalchemy import Column, Integer, String, Text, Numeric, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.base import Base


class Client(Base):
    """
    Client/Company model for managing production clients.
    Represents the business entities that commission audiovisual productions.
    """
    __tablename__ = "clients"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    legal_name = Column(String(255))  # Razão social
    tax_id = Column(String(20), unique=True, index=True)  # CNPJ/CPF
    email = Column(String(255))
    phone = Column(String(50))
    address = Column(Text)

    # Contact information
    contact_name = Column(String(255))
    contact_email = Column(String(255))
    contact_phone = Column(String(50))

    # Payment terms
    payment_terms_days = Column(Integer, default=30)  # Days for payment
    credit_limit = Column(Numeric(15, 2), default=0)

    # Status
    is_active = Column(Boolean, default=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    budgets = relationship("Budget", back_populates="client")
    proposals = relationship("Proposal", back_populates="client")

    def __repr__(self):
        return f"<Client(id={self.id}, name={self.name})>"


class Budget(Base):
    """
    Budget model for production financial planning.
    Supports versioning, auto-calculations, and tax integration.
    """
    __tablename__ = "budgets"

    id = Column(Integer, primary_key=True, index=True)
    version = Column(Integer, nullable=False, default=1)  # Version control
    name = Column(String(255), nullable=False)
    description = Column(Text)

    # Relationships
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    client = relationship("Client", back_populates="budgets")

    # Financial data (stored in cents to avoid floating point issues)
    subtotal_cents = Column(Integer, nullable=False, default=0)  # Before taxes
    tax_rate_percent = Column(Numeric(5, 2), default=0)  # Tax percentage
    tax_amount_cents = Column(Integer, default=0)  # Calculated tax amount
    discount_cents = Column(Integer, default=0)  # Discount amount
    total_cents = Column(Integer, nullable=False, default=0)  # Final total

    # Budget breakdown (JSON structure for flexible line items)
    line_items = Column(JSON, default=list)  # Array of budget line items

    # Profitability
    profit_margin_percent = Column(Numeric(5, 2), default=0)
    profit_amount_cents = Column(Integer, default=0)

    # Status
    status = Column(String(50), default="draft")  # draft, approved, rejected, finalized
    is_active = Column(Boolean, default=True)

    # Metadata
    created_by = Column(String, ForeignKey("users.id"))  # User who created
    approved_by = Column(String, ForeignKey("users.id"))  # User who approved
    approved_at = Column(DateTime(timezone=True))

    # Versioning
    parent_budget_id = Column(Integer, ForeignKey("budgets.id"))  # For version history
    change_log = Column(Text)  # Description of changes in this version

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    proposals = relationship("Proposal", back_populates="budget")
    parent_budget = relationship("Budget", remote_side=[id])

    @property
    def subtotal(self) -> Decimal:
        """Get subtotal in currency units."""
        return Decimal(self.subtotal_cents) / 100

    @property
    def tax_amount(self) -> Decimal:
        """Get tax amount in currency units."""
        return Decimal(self.tax_amount_cents) / 100

    @property
    def discount(self) -> Decimal:
        """Get discount in currency units."""
        return Decimal(self.discount_cents) / 100

    @property
    def total(self) -> Decimal:
        """Get total in currency units."""
        return Decimal(self.total_cents) / 100

    @property
    def profit_amount(self) -> Decimal:
        """Get profit amount in currency units."""
        return Decimal(self.profit_amount_cents) / 100

    def calculate_totals(self):
        """Recalculate all totals based on line items and settings."""
        # Calculate subtotal from line items
        subtotal = sum(item.get('amount_cents', 0) for item in self.line_items)
        self.subtotal_cents = subtotal

        # Calculate tax
        if self.tax_rate_percent:
            self.tax_amount_cents = int(subtotal * (self.tax_rate_percent / 100))
        else:
            self.tax_amount_cents = 0

        # Apply discount
        discounted_total = subtotal + self.tax_amount_cents - self.discount_cents

        # Apply profit margin
        if self.profit_margin_percent:
            self.profit_amount_cents = int(discounted_total * (self.profit_margin_percent / 100))
            self.total_cents = discounted_total + self.profit_amount_cents
        else:
            self.profit_amount_cents = 0
            self.total_cents = discounted_total

    def __repr__(self):
        return f"<Budget(id={self.id}, name={self.name}, version={self.version}, total={self.total})>"


class Proposal(Base):
    """
    Proposal/Quote model for formal offers to clients.
    Links budgets to formal proposals with approval workflow.
    """
    __tablename__ = "proposals"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    proposal_number = Column(String(50), unique=True, index=True)  # Auto-generated

    # Relationships
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    client = relationship("Client", back_populates="proposals")

    budget_id = Column(Integer, ForeignKey("budgets.id"), nullable=False)
    budget = relationship("Budget", back_populates="proposals")

    # Proposal details
    introduction = Column(Text)
    scope_of_work = Column(Text)
    terms_and_conditions = Column(Text)
    validity_days = Column(Integer, default=30)  # Days until proposal expires

    # Financial summary (snapshot from budget)
    proposed_amount_cents = Column(Integer, nullable=False)
    currency = Column(String(3), default="BRL")

    # Status workflow
    status = Column(String(50), default="draft")  # draft, sent, approved, rejected, expired
    rejection_reason = Column(Text)

    # Metadata
    created_by = Column(String, ForeignKey("users.id"), nullable=False)
    sent_by = Column(String, ForeignKey("users.id"))
    approved_by = Column(String, ForeignKey("users.id"))

    # Dates
    sent_at = Column(DateTime(timezone=True))
    approved_at = Column(DateTime(timezone=True))
    expires_at = Column(DateTime(timezone=True))
    rejected_at = Column(DateTime(timezone=True))

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    @property
    def proposed_amount(self) -> Decimal:
        """Get proposed amount in currency units."""
        return Decimal(self.proposed_amount_cents) / 100

    def is_expired(self) -> bool:
        """Check if proposal has expired."""
        if self.expires_at:
            return self.expires_at < func.now()
        return False

    def __repr__(self):
        return f"<Proposal(id={self.id}, number={self.proposal_number}, status={self.status})>"