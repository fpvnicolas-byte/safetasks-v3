"""Add professional_annual to org plan CHECK constraint and unique constraint on billing_events.external_id

Revision ID: g1h2i3j4k5l6
Revises: bb22cc33dd44
Create Date: 2026-02-11

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'g1h2i3j4k5l6'
down_revision = 'bb22cc33dd44'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Drop + recreate the plan CHECK constraint to allow 'professional_annual'
    op.drop_constraint('organizations_plan_check', 'organizations', type_='check')
    op.create_check_constraint(
        'organizations_plan_check',
        'organizations',
        "plan IN ('free', 'starter', 'professional', 'professional_annual', 'enterprise')"
    )

    # 2. Add unique constraint on billing_events.external_id for idempotency
    op.create_unique_constraint(
        'uq_billing_events_external_id',
        'billing_events',
        ['external_id']
    )

    # 3. Rename any existing 'pro' or 'pro_annual' values in organizations.plan to new names
    op.execute("UPDATE organizations SET plan = 'professional' WHERE plan = 'pro'")
    op.execute("UPDATE organizations SET plan = 'professional_annual' WHERE plan = 'pro_annual'")

    # 4. Rename plan rows in plans table (if they exist with old names)
    op.execute("UPDATE plans SET name = 'professional' WHERE name = 'pro'")
    op.execute("UPDATE plans SET name = 'professional_annual' WHERE name = 'pro_annual'")


def downgrade() -> None:
    # Reverse plan name changes
    op.execute("UPDATE plans SET name = 'pro' WHERE name = 'professional'")
    op.execute("UPDATE plans SET name = 'pro_annual' WHERE name = 'professional_annual'")
    op.execute("UPDATE organizations SET plan = 'pro' WHERE plan = 'professional'")
    op.execute("UPDATE organizations SET plan = 'pro_annual' WHERE plan = 'professional_annual'")

    # Remove unique constraint
    op.drop_constraint('uq_billing_events_external_id', 'billing_events', type_='unique')

    # Restore original CHECK constraint
    op.drop_constraint('organizations_plan_check', 'organizations', type_='check')
    op.create_check_constraint(
        'organizations_plan_check',
        'organizations',
        "plan IN ('free', 'starter', 'professional', 'enterprise')"
    )
