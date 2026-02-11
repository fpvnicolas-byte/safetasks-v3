"""Add missing billing columns, plan rename, and constraints

- organizations.access_ends_at (CRITICAL: missing from DB, causes all queries to fail)
- billing_events: external_id, organization_id, provider, amount_cents, currency, plan_name, event_metadata
- billing_events.stripe_event_id: make nullable (was NOT NULL)
- organizations.plan CHECK constraint: add 'professional_annual'
- billing_events.external_id: unique constraint for idempotency
- Rename existing 'pro'/'pro_annual' plan values to 'professional'/'professional_annual'

Revision ID: g1h2i3j4k5l6
Revises: bb22cc33dd44
Create Date: 2026-02-11

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers, used by Alembic.
revision: str = 'g1h2i3j4k5l6'
down_revision: Union[str, None] = 'bb22cc33dd44'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ----------------------------------------------------------------
    # 1. CRITICAL: Add missing access_ends_at column to organizations
    #    Without this column, every SELECT on organizations fails.
    # ----------------------------------------------------------------
    op.add_column(
        'organizations',
        sa.Column('access_ends_at', sa.TIMESTAMP(timezone=True), nullable=True)
    )

    # ----------------------------------------------------------------
    # 2. Add missing columns to billing_events
    #    The original migration only created: id, stripe_event_id,
    #    event_type, status, received_at, processed_at
    #    The model now has many more columns for InfinityPay support.
    # ----------------------------------------------------------------
    op.add_column(
        'billing_events',
        sa.Column('external_id', sa.String(), nullable=True)
    )
    op.add_column(
        'billing_events',
        sa.Column('organization_id', sa.UUID(), nullable=True)
    )
    op.add_column(
        'billing_events',
        sa.Column('provider', sa.String(), nullable=False, server_default='stripe')
    )
    op.add_column(
        'billing_events',
        sa.Column('amount_cents', sa.BIGINT(), nullable=True)
    )
    op.add_column(
        'billing_events',
        sa.Column('currency', sa.String(), nullable=True)
    )
    op.add_column(
        'billing_events',
        sa.Column('plan_name', sa.String(), nullable=True)
    )
    op.add_column(
        'billing_events',
        sa.Column('event_metadata', JSONB(), nullable=True)
    )

    # Make stripe_event_id nullable (was NOT NULL, now legacy)
    op.alter_column(
        'billing_events',
        'stripe_event_id',
        existing_type=sa.String(),
        nullable=True
    )

    # Add FK for organization_id
    op.create_foreign_key(
        'fk_billing_events_organization_id',
        'billing_events',
        'organizations',
        ['organization_id'],
        ['id']
    )

    # Add unique constraint on external_id for idempotency
    op.create_unique_constraint(
        'uq_billing_events_external_id',
        'billing_events',
        ['external_id']
    )

    # ----------------------------------------------------------------
    # 3. Update organizations.plan CHECK constraint
    #    Add 'professional_annual' to allowed values
    # ----------------------------------------------------------------
    # Drop existing constraint (may be named differently across envs)
    try:
        op.drop_constraint('organizations_plan_check', 'organizations', type_='check')
    except Exception:
        # Constraint might have a different auto-generated name
        try:
            op.drop_constraint('ck_organizations_plan', 'organizations', type_='check')
        except Exception:
            pass

    op.create_check_constraint(
        'ck_organizations_plan',
        'organizations',
        "plan IN ('free', 'starter', 'professional', 'professional_annual', 'enterprise')"
    )

    # ----------------------------------------------------------------
    # 4. Rename existing plan values in data
    # ----------------------------------------------------------------
    op.execute("UPDATE organizations SET plan = 'professional' WHERE plan = 'pro'")
    op.execute("UPDATE organizations SET plan = 'professional_annual' WHERE plan = 'pro_annual'")
    op.execute("UPDATE plans SET name = 'professional' WHERE name = 'pro'")
    op.execute("UPDATE plans SET name = 'professional_annual' WHERE name = 'pro_annual'")


def downgrade() -> None:
    # Reverse plan name changes
    op.execute("UPDATE plans SET name = 'pro' WHERE name = 'professional'")
    op.execute("UPDATE plans SET name = 'pro_annual' WHERE name = 'professional_annual'")
    op.execute("UPDATE organizations SET plan = 'pro' WHERE plan = 'professional'")
    op.execute("UPDATE organizations SET plan = 'pro_annual' WHERE plan = 'professional_annual'")

    # Restore original CHECK constraint
    try:
        op.drop_constraint('ck_organizations_plan', 'organizations', type_='check')
    except Exception:
        pass
    op.create_check_constraint(
        'organizations_plan_check',
        'organizations',
        "plan IN ('free', 'starter', 'professional', 'enterprise')"
    )

    # Remove unique constraint
    op.drop_constraint('uq_billing_events_external_id', 'billing_events', type_='unique')

    # Remove FK
    op.drop_constraint('fk_billing_events_organization_id', 'billing_events', type_='foreignkey')

    # Revert stripe_event_id to NOT NULL
    op.alter_column(
        'billing_events',
        'stripe_event_id',
        existing_type=sa.String(),
        nullable=False
    )

    # Drop added billing_events columns
    op.drop_column('billing_events', 'event_metadata')
    op.drop_column('billing_events', 'plan_name')
    op.drop_column('billing_events', 'currency')
    op.drop_column('billing_events', 'amount_cents')
    op.drop_column('billing_events', 'provider')
    op.drop_column('billing_events', 'organization_id')
    op.drop_column('billing_events', 'external_id')

    # Drop access_ends_at
    op.drop_column('organizations', 'access_ends_at')
