from sqlalchemy import Column, String, TIMESTAMP, ForeignKey, func, CheckConstraint, Index
from sqlalchemy.dialects.postgresql import UUID
from app.core.base import Base
import uuid


class OrganizationInvite(Base):
    """
    Invite model for team member invitations.

    Tracks pending, accepted, revoked, and expired invitations.
    Token is stored as SHA-256 hash; raw token is only returned once on creation.
    """
    __tablename__ = "organization_invites"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    invited_email = Column(String, nullable=False)
    role_v2 = Column(String, nullable=False)
    invited_by_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id"), nullable=False)
    supplier_id = Column(UUID(as_uuid=True), ForeignKey("suppliers.id"), nullable=True)
    status = Column(String, nullable=False, default="pending")
    token_hash = Column(String, nullable=False)
    expires_at = Column(TIMESTAMP(timezone=True), nullable=False)
    accepted_by_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id"), nullable=True)
    accepted_at = Column(TIMESTAMP(timezone=True), nullable=True)

    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        CheckConstraint(
            "role_v2 IN ('admin', 'producer', 'finance', 'freelancer')",
            name="ck_org_invites_role_v2",
        ),
        CheckConstraint(
            "status IN ('pending', 'accepted', 'revoked', 'expired')",
            name="ck_org_invites_status",
        ),
        Index(
            "uq_org_invites_pending",
            "org_id",
            "invited_email",
            unique=True,
            postgresql_where="status = 'pending'",
        ),
    )
