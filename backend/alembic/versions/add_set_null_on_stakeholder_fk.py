"""add_set_null_on_stakeholder_fk

Revision ID: c5d6e7f8a9b0
Revises: b4c5d6e7f8a9
Create Date: 2026-02-05

Note: This migration modifies the stakeholder_id foreign key in the transactions 
table to use ON DELETE SET NULL, allowing stakeholders to be deleted while 
preserving their transaction records.
"""
from alembic import op


# revision identifiers, used by Alembic.
revision = 'c5d6e7f8a9b0'
down_revision = 'b4c5d6e7f8a9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop the existing foreign key constraint
    op.drop_constraint('transactions_stakeholder_id_fkey', 'transactions', type_='foreignkey')
    
    # Recreate it with ON DELETE SET NULL
    op.create_foreign_key(
        'transactions_stakeholder_id_fkey',
        'transactions', 'stakeholders',
        ['stakeholder_id'], ['id'],
        ondelete='SET NULL'
    )


def downgrade() -> None:
    # Drop the new constraint
    op.drop_constraint('transactions_stakeholder_id_fkey', 'transactions', type_='foreignkey')
    
    # Recreate without ON DELETE clause
    op.create_foreign_key(
        'transactions_stakeholder_id_fkey',
        'transactions', 'stakeholders',
        ['stakeholder_id'], ['id']
    )
