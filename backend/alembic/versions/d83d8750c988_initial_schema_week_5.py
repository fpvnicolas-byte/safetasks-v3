"""initial_schema_week_5

Revision ID: d83d8750c988
Revises: 
Create Date: 2026-01-25 14:22:00.913574

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd83d8750c988'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # This historical migration was generated against an existing DB where
    # invoice_items already existed. Make it safe for clean databases.
    op.execute(
        sa.text(
            """
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1
                    FROM information_schema.tables
                    WHERE table_schema = 'public'
                      AND table_name = 'invoice_items'
                )
                AND EXISTS (
                    SELECT 1
                    FROM information_schema.tables
                    WHERE table_schema = 'public'
                      AND table_name = 'invoices'
                ) THEN
                    ALTER TABLE invoice_items
                        DROP CONSTRAINT IF EXISTS invoice_items_invoice_id_fkey;

                    ALTER TABLE invoice_items
                        ADD CONSTRAINT invoice_items_invoice_id_fkey
                        FOREIGN KEY (invoice_id) REFERENCES invoices(id);
                END IF;
            END $$;
            """
        )
    )


def downgrade() -> None:
    op.execute(
        sa.text(
            """
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1
                    FROM information_schema.tables
                    WHERE table_schema = 'public'
                      AND table_name = 'invoice_items'
                )
                AND EXISTS (
                    SELECT 1
                    FROM information_schema.tables
                    WHERE table_schema = 'public'
                      AND table_name = 'invoices'
                ) THEN
                    ALTER TABLE invoice_items
                        DROP CONSTRAINT IF EXISTS invoice_items_invoice_id_fkey;

                    ALTER TABLE invoice_items
                        ADD CONSTRAINT invoice_items_invoice_id_fkey
                        FOREIGN KEY (invoice_id) REFERENCES invoices(id)
                        ON DELETE CASCADE;
                END IF;
            END $$;
            """
        )
    )
