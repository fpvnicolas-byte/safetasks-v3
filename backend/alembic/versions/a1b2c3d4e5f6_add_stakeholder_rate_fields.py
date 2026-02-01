"""Add stakeholder rate fields

Revision ID: a1b2c3d4e5f6
Revises: 9d3140875e97
Create Date: 2026-01-31 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '9d3140875e97'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add rate management fields to stakeholders table
    op.add_column('stakeholders', sa.Column('rate_type', sa.String(20), nullable=True))
    op.add_column('stakeholders', sa.Column('rate_value_cents', sa.BigInteger(), nullable=True))
    op.add_column('stakeholders', sa.Column('estimated_units', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('stakeholders', 'estimated_units')
    op.drop_column('stakeholders', 'rate_value_cents')
    op.drop_column('stakeholders', 'rate_type')
