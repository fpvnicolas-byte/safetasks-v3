"""merge_heads_financial_automation

Revision ID: ae4416eedee2
Revises: a1b2c3d4e5f6, f8a1b2c3d4e5
Create Date: 2026-01-31 14:22:09.136236

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ae4416eedee2'
down_revision: Union[str, None] = ('a1b2c3d4e5f6', 'f8a1b2c3d4e5')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
