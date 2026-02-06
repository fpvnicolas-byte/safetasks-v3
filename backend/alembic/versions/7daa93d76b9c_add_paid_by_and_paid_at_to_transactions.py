"""add paid_by and paid_at to transactions

Revision ID: 7daa93d76b9c
Revises: d4e5f6a7b8c9
Create Date: 2026-02-06

Adds nullable paid_by (UUID FK to profiles) and paid_at (TIMESTAMP) columns
to the transactions table for tracking who marked a transaction as paid and when.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, TIMESTAMP


# revision identifiers, used by Alembic.
revision: str = "7daa93d76b9c"
down_revision: Union[str, None] = "d4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "transactions",
        sa.Column("paid_by", UUID(as_uuid=True), sa.ForeignKey("profiles.id"), nullable=True),
    )
    op.add_column(
        "transactions",
        sa.Column("paid_at", TIMESTAMP(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("transactions", "paid_at")
    op.drop_column("transactions", "paid_by")
