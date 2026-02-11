"""Add missing billing columns, plan rename, and constraints

- organizations.access_ends_at (if not already present)
- billing_events: external_id, organization_id, provider, amount_cents, currency, plan_name, event_metadata
- billing_events.stripe_event_id: make nullable (was NOT NULL)
- organizations.plan CHECK constraint: add 'professional_annual'
- billing_events.external_id: unique constraint for idempotency
- Rename existing 'pro'/'pro_annual' plan values to 'professional'/'professional_annual'

NOTE: Uses IF NOT EXISTS to be idempotent — safe to run even if some
columns were already added manually outside Alembic.

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


def _add_column_if_not_exists(table: str, column: str, col_type: str, extra: str = "") -> None:
    """Add a column only if it doesn't already exist (idempotent)."""
    op.execute(sa.text(f"""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = '{table}' AND column_name = '{column}'
            ) THEN
                ALTER TABLE {table} ADD COLUMN {column} {col_type} {extra};
            END IF;
        END $$;
    """))


def _constraint_exists(name: str) -> sa.text:
    """Check if a constraint exists."""
    return sa.text(f"""
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = '{name}'
    """)


def upgrade() -> None:
    conn = op.get_bind()

    # ----------------------------------------------------------------
    # 1. Add missing access_ends_at column to organizations
    # ----------------------------------------------------------------
    _add_column_if_not_exists(
        'organizations', 'access_ends_at', 'TIMESTAMPTZ'
    )

    # ----------------------------------------------------------------
    # 2. Add missing columns to billing_events
    # ----------------------------------------------------------------
    _add_column_if_not_exists(
        'billing_events', 'external_id', 'VARCHAR'
    )
    _add_column_if_not_exists(
        'billing_events', 'organization_id', 'UUID'
    )
    _add_column_if_not_exists(
        'billing_events', 'provider', 'VARCHAR', "NOT NULL DEFAULT 'stripe'"
    )
    _add_column_if_not_exists(
        'billing_events', 'amount_cents', 'BIGINT'
    )
    _add_column_if_not_exists(
        'billing_events', 'currency', 'VARCHAR'
    )
    _add_column_if_not_exists(
        'billing_events', 'plan_name', 'VARCHAR'
    )
    _add_column_if_not_exists(
        'billing_events', 'event_metadata', 'JSONB'
    )

    # Make stripe_event_id nullable (was NOT NULL, now legacy)
    op.alter_column(
        'billing_events',
        'stripe_event_id',
        existing_type=sa.String(),
        nullable=True
    )

    # Add FK for organization_id (if not exists)
    result = conn.execute(_constraint_exists('fk_billing_events_organization_id'))
    if not result.fetchone():
        op.create_foreign_key(
            'fk_billing_events_organization_id',
            'billing_events',
            'organizations',
            ['organization_id'],
            ['id']
        )

    # Add unique constraint on external_id (if not exists)
    result = conn.execute(_constraint_exists('uq_billing_events_external_id'))
    if not result.fetchone():
        op.create_unique_constraint(
            'uq_billing_events_external_id',
            'billing_events',
            ['external_id']
        )

    # ----------------------------------------------------------------
    # 3. Update organizations.plan CHECK constraint
    #    Must use PL/pgSQL for drop — Python try/except corrupts the
    #    PostgreSQL transaction on failure (transactional DDL).
    # ----------------------------------------------------------------
    op.execute(sa.text("""
        DO $$
        BEGIN
            ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_plan_check;
            ALTER TABLE organizations DROP CONSTRAINT IF EXISTS ck_organizations_plan;
        EXCEPTION WHEN others THEN
            NULL;
        END $$;
    """))

    op.execute(sa.text("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.table_constraints
                WHERE constraint_name = 'ck_organizations_plan'
                  AND table_name = 'organizations'
            ) THEN
                ALTER TABLE organizations ADD CONSTRAINT ck_organizations_plan
                    CHECK (plan IN ('free', 'starter', 'professional', 'professional_annual', 'enterprise'));
            END IF;
        END $$;
    """))

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

    # Restore original CHECK constraint (PL/pgSQL to avoid transaction abort)
    op.execute(sa.text("""
        DO $$
        BEGIN
            ALTER TABLE organizations DROP CONSTRAINT IF EXISTS ck_organizations_plan;
        EXCEPTION WHEN others THEN NULL;
        END $$;
    """))
    op.execute(sa.text("""
        ALTER TABLE organizations ADD CONSTRAINT organizations_plan_check
            CHECK (plan IN ('free', 'starter', 'professional', 'enterprise'))
    """))

    # Remove unique constraint
    op.execute(sa.text("""
        DO $$
        BEGIN
            ALTER TABLE billing_events DROP CONSTRAINT IF EXISTS uq_billing_events_external_id;
        EXCEPTION WHEN others THEN NULL;
        END $$;
    """))

    # Remove FK
    op.execute(sa.text("""
        DO $$
        BEGIN
            ALTER TABLE billing_events DROP CONSTRAINT IF EXISTS fk_billing_events_organization_id;
        EXCEPTION WHEN others THEN NULL;
        END $$;
    """))

    # Revert stripe_event_id to NOT NULL
    op.alter_column(
        'billing_events',
        'stripe_event_id',
        existing_type=sa.String(),
        nullable=False
    )

    # Drop added billing_events columns
    for col in ('event_metadata', 'plan_name', 'currency', 'amount_cents', 'provider', 'organization_id', 'external_id'):
        op.execute(sa.text(f"""
            DO $$
            BEGIN
                ALTER TABLE billing_events DROP COLUMN IF EXISTS {col};
            EXCEPTION WHEN others THEN NULL;
            END $$;
        """))

    # Drop access_ends_at
    op.execute(sa.text("""
        DO $$
        BEGIN
            ALTER TABLE organizations DROP COLUMN IF EXISTS access_ends_at;
        EXCEPTION WHEN others THEN NULL;
        END $$;
    """))

