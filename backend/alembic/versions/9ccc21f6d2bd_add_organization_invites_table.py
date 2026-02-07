"""add_organization_invites_table_and_supplier_profile_id

Revision ID: 9ccc21f6d2bd
Revises: 5bd342bc298d
Create Date: 2026-02-07 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '9ccc21f6d2bd'
down_revision: Union[str, None] = '5bd342bc298d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create organization_invites table
    op.create_table(
        'organization_invites',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('org_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id'), nullable=False),
        sa.Column('invited_email', sa.String(), nullable=False),
        sa.Column('role_v2', sa.String(), nullable=False),
        sa.Column('invited_by_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('profiles.id'), nullable=False),
        sa.Column('supplier_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('suppliers.id'), nullable=True),
        sa.Column('status', sa.String(), nullable=False, server_default='pending'),
        sa.Column('token_hash', sa.String(), nullable=False),
        sa.Column('expires_at', sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column('accepted_by_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('profiles.id'), nullable=True),
        sa.Column('accepted_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint(
            "role_v2 IN ('admin', 'producer', 'finance', 'freelancer')",
            name='ck_org_invites_role_v2',
        ),
        sa.CheckConstraint(
            "status IN ('pending', 'accepted', 'revoked', 'expired')",
            name='ck_org_invites_status',
        ),
    )

    # Partial unique index: only one pending invite per (org, email)
    op.execute("""
        CREATE UNIQUE INDEX uq_org_invites_pending
        ON organization_invites (org_id, invited_email)
        WHERE status = 'pending'
    """)

    op.create_index('ix_org_invites_org_id', 'organization_invites', ['org_id'])
    op.create_index('ix_org_invites_token_hash', 'organization_invites', ['token_hash'])

    # 2. Add profile_id column to suppliers
    op.add_column('suppliers', sa.Column('profile_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('profiles.id'), nullable=True))


def downgrade() -> None:
    op.drop_column('suppliers', 'profile_id')
    op.drop_index('ix_org_invites_token_hash', table_name='organization_invites')
    op.drop_index('ix_org_invites_org_id', table_name='organization_invites')
    op.drop_index('uq_org_invites_pending', table_name='organization_invites')
    op.drop_table('organization_invites')
