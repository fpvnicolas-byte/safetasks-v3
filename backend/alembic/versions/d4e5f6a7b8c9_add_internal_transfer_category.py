"""add_internal_transfer_category

Revision ID: d4e5f6a7b8c9
Revises: c5d6e7f8a9b0
Create Date: 2026-02-05

Adds 'internal_transfer' to the allowed values for transactions.category.
"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, None] = "c5d6e7f8a9b0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop any existing CHECK constraints that reference "category" (name may vary).
    op.execute(
        """
        DO $$
        DECLARE
          r RECORD;
        BEGIN
          FOR r IN
            SELECT conname
            FROM pg_constraint
            WHERE conrelid = 'transactions'::regclass
              AND contype = 'c'
              AND pg_get_constraintdef(oid) ILIKE '%category%'
          LOOP
            EXECUTE format('ALTER TABLE transactions DROP CONSTRAINT %I', r.conname);
          END LOOP;
        END $$;
        """
    )

    op.execute(
        """
        ALTER TABLE transactions
        ADD CONSTRAINT transactions_category_check
        CHECK (
          category IN (
            'crew_hire',
            'equipment_rental',
            'logistics',
            'post_production',
            'maintenance',
            'other',
            'production_revenue',
            'internal_transfer'
          )
        );
        """
    )


def downgrade() -> None:
    op.execute("ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_category_check;")
    op.execute(
        """
        ALTER TABLE transactions
        ADD CONSTRAINT transactions_category_check
        CHECK (
          category IN (
            'crew_hire',
            'equipment_rental',
            'logistics',
            'post_production',
            'maintenance',
            'other',
            'production_revenue'
          )
        );
        """
    )

