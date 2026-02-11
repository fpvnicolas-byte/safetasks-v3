"""merge_billing_and_main_heads

Revision ID: 984bca99f12b
Revises: 5a6f1774fcda, g1h2i3j4k5l6
Create Date: 2026-02-11 00:25:56.878764

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '984bca99f12b'
down_revision: Union[str, None] = ('5a6f1774fcda', 'g1h2i3j4k5l6')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
