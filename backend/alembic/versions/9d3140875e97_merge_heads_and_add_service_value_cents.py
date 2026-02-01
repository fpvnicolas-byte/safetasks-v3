"""merge_heads_and_add_service_value_cents

Revision ID: 9d3140875e97
Revises: 990dd3078435, b1f3c9a4e6d2
Create Date: 2026-01-31 02:49:05.705462

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9d3140875e97'
down_revision: Union[str, None] = ('990dd3078435', 'b1f3c9a4e6d2')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add value_cents column to services table
    op.add_column('services', sa.Column('value_cents', sa.BIGINT(), nullable=False, server_default='0'))


def downgrade() -> None:
    op.drop_column('services', 'value_cents')
