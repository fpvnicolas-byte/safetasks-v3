from sqlalchemy import Column, String, TIMESTAMP, Boolean, func, ForeignKey, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID
from app.core.base import Base


class Profile(Base):
    """
    User Profile model.

    Architecture: Profile.id = auth.users(id) from Supabase Auth.
    Email is DENORMALIZED from Supabase for query performance and display purposes.

    This design allows:
    - Fast email lookups without Supabase API calls
    - Soft-delete via is_active flag
    - Full audit trail with created_at/updated_at
    """
    __tablename__ = "profiles"

    id = Column(UUID(as_uuid=True), primary_key=True)  # References auth.users(id) in Supabase
    email = Column(String, nullable=False)  # Denormalized from auth.users for performance
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=True)
    full_name = Column(String)
    avatar_url = Column(String)
    phone = Column(String, nullable=True)
    role = Column(String, default="viewer")  # admin, manager, crew, viewer
    role_v2 = Column(String, nullable=True)  # owner, admin, producer, finance, freelancer
    is_master_owner = Column(Boolean, default=False, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        CheckConstraint("role IN ('admin', 'manager', 'crew', 'viewer')"),
        CheckConstraint("role_v2 IN ('owner', 'admin', 'producer', 'finance', 'freelancer')"),
    )
