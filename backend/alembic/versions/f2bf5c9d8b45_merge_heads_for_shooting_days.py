"""merge heads for shooting days

Revision ID: f2bf5c9d8b45
Revises: 9202fec0612e, c2f1e7a9b3d4
Create Date: 2026-02-01 13:00:04.499530

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f2bf5c9d8b45'
down_revision: Union[str, None] = ('9202fec0612e', 'c2f1e7a9b3d4')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
