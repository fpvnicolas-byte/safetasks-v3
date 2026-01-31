"""add_access_billing_phase1

Revision ID: b1f3c9a4e6d2
Revises: 4e8f9a2b5c3d
Create Date: 2026-01-30 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b1f3c9a4e6d2'
down_revision: Union[str, None] = '4e8f9a2b5c3d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


BILLING_STATUS_CHECK = "billing_status IN ('trial_active', 'trial_ended', 'active', 'past_due', 'canceled', 'blocked', 'billing_pending_review')"
ROLE_V2_CHECK = "role_v2 IN ('owner', 'admin', 'producer', 'finance', 'freelancer')"


def upgrade() -> None:
    # Plans (needed before organization FK)
    op.create_table(
        'plans',
        sa.Column('id', sa.UUID(), primary_key=True),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('stripe_price_id', sa.String(), nullable=True),
        sa.Column('billing_interval', sa.String(), nullable=True),
        sa.Column('is_custom', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
    )

    # Organizations: billing fields
    op.add_column('organizations', sa.Column('billing_status', sa.String(), nullable=True))
    op.add_column('organizations', sa.Column('trial_ends_at', sa.TIMESTAMP(timezone=True), nullable=True))
    op.add_column('organizations', sa.Column('stripe_customer_id', sa.String(), nullable=True))
    op.add_column('organizations', sa.Column('stripe_subscription_id', sa.String(), nullable=True))
    op.add_column('organizations', sa.Column('plan_id', sa.UUID(), nullable=True))
    op.add_column('organizations', sa.Column('billing_contact_user_id', sa.UUID(), nullable=True))
    op.add_column('organizations', sa.Column('owner_profile_id', sa.UUID(), nullable=True))

    op.create_check_constraint('ck_organizations_billing_status', 'organizations', BILLING_STATUS_CHECK)
    op.create_foreign_key('fk_organizations_plan_id', 'organizations', 'plans', ['plan_id'], ['id'])
    op.create_foreign_key('fk_organizations_billing_contact_user_id', 'organizations', 'profiles', ['billing_contact_user_id'], ['id'])
    op.create_foreign_key('fk_organizations_owner_profile_id', 'organizations', 'profiles', ['owner_profile_id'], ['id'])

    # Profiles: role_v2 + master owner
    op.add_column('profiles', sa.Column('role_v2', sa.String(), nullable=True))
    op.add_column('profiles', sa.Column('is_master_owner', sa.Boolean(), nullable=False, server_default=sa.text('false')))
    op.create_check_constraint('ck_profiles_role_v2', 'profiles', ROLE_V2_CHECK)

    # Entitlements
    op.create_table(
        'entitlements',
        sa.Column('id', sa.UUID(), primary_key=True),
        sa.Column('plan_id', sa.UUID(), nullable=False),
        sa.Column('max_projects', sa.Integer(), nullable=True),
        sa.Column('max_clients', sa.Integer(), nullable=True),
        sa.Column('max_proposals', sa.Integer(), nullable=True),
        sa.Column('max_users', sa.Integer(), nullable=True),
        sa.Column('max_storage_bytes', sa.BIGINT(), nullable=True),
        sa.Column('ai_credits', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['plan_id'], ['plans.id'], name='fk_entitlements_plan_id'),
    )

    # Organization usage (1:1 with org)
    op.create_table(
        'organization_usage',
        sa.Column('org_id', sa.UUID(), primary_key=True),
        sa.Column('storage_bytes_used', sa.BIGINT(), nullable=False, server_default='0'),
        sa.Column('ai_credits_used', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('projects_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('clients_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('proposals_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('users_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['org_id'], ['organizations.id'], name='fk_organization_usage_org_id'),
    )

    # Project assignments (freelancer project scope)
    op.create_table(
        'project_assignments',
        sa.Column('id', sa.UUID(), primary_key=True),
        sa.Column('project_id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], name='fk_project_assignments_project_id'),
        sa.ForeignKeyConstraint(['user_id'], ['profiles.id'], name='fk_project_assignments_user_id'),
        sa.UniqueConstraint('project_id', 'user_id', name='uq_project_assignments_project_user'),
    )

    # Billing events (Stripe webhooks)
    op.create_table(
        'billing_events',
        sa.Column('id', sa.UUID(), primary_key=True),
        sa.Column('stripe_event_id', sa.String(), nullable=False),
        sa.Column('event_type', sa.String(), nullable=False),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('received_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('processed_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.UniqueConstraint('stripe_event_id', name='uq_billing_events_stripe_event_id'),
    )


def downgrade() -> None:
    op.drop_table('billing_events')
    op.drop_table('project_assignments')
    op.drop_table('organization_usage')
    op.drop_table('entitlements')

    op.drop_constraint('ck_profiles_role_v2', 'profiles', type_='check')
    op.drop_column('profiles', 'is_master_owner')
    op.drop_column('profiles', 'role_v2')

    op.drop_constraint('fk_organizations_owner_profile_id', 'organizations', type_='foreignkey')
    op.drop_constraint('fk_organizations_billing_contact_user_id', 'organizations', type_='foreignkey')
    op.drop_constraint('fk_organizations_plan_id', 'organizations', type_='foreignkey')
    op.drop_constraint('ck_organizations_billing_status', 'organizations', type_='check')
    op.drop_column('organizations', 'owner_profile_id')
    op.drop_column('organizations', 'billing_contact_user_id')
    op.drop_column('organizations', 'plan_id')
    op.drop_column('organizations', 'stripe_subscription_id')
    op.drop_column('organizations', 'stripe_customer_id')
    op.drop_column('organizations', 'trial_ends_at')
    op.drop_column('organizations', 'billing_status')

    op.drop_table('plans')
