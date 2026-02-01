"""add_base_amount_cents_to_proposals

Revision ID: 52a1b2c3d4e7
Revises: fc79ec9568a2
Create Date: 2026-02-01 15:37:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '52a1b2c3d4e7'
down_revision = 'f2bf5c9d8b45'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('proposals', sa.Column('base_amount_cents', sa.BigInteger(), nullable=True))


def downgrade() -> None:
    op.drop_column('proposals', 'base_amount_cents')
