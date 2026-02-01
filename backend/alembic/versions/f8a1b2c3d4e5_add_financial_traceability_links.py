"""add_financial_traceability_links

Revision ID: f8a1b2c3d4e5
Revises: 9d3140875e97
Create Date: 2026-01-31 11:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f8a1b2c3d4e5'
down_revision: Union[str, None] = '9d3140875e97'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('invoices', sa.Column('proposal_id', sa.UUID(), nullable=True))
    op.create_foreign_key(
        'fk_invoices_proposal_id',
        'invoices',
        'proposals',
        ['proposal_id'],
        ['id']
    )

    op.add_column('transactions', sa.Column('invoice_id', sa.UUID(), nullable=True))
    op.create_foreign_key(
        'fk_transactions_invoice_id',
        'transactions',
        'invoices',
        ['invoice_id'],
        ['id']
    )

    op.add_column('organizations', sa.Column('default_bank_account_id', sa.UUID(), nullable=True))
    op.create_foreign_key(
        'fk_organizations_default_bank_account_id',
        'organizations',
        'bank_accounts',
        ['default_bank_account_id'],
        ['id']
    )


def downgrade() -> None:
    op.drop_constraint('fk_organizations_default_bank_account_id', 'organizations', type_='foreignkey')
    op.drop_column('organizations', 'default_bank_account_id')

    op.drop_constraint('fk_transactions_invoice_id', 'transactions', type_='foreignkey')
    op.drop_column('transactions', 'invoice_id')

    op.drop_constraint('fk_invoices_proposal_id', 'invoices', type_='foreignkey')
    op.drop_column('invoices', 'proposal_id')
