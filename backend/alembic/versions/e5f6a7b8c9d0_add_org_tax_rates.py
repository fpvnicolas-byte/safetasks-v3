"""add cnpj_tax_rate and produtora_tax_rate to organizations

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-02-05

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "e5f6a7b8c9d0"
down_revision = "7daa93d76b9c"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "organizations",
        sa.Column("cnpj_tax_rate", sa.Numeric(precision=5, scale=2), nullable=True, server_default="0"),
    )
    op.add_column(
        "organizations",
        sa.Column("produtora_tax_rate", sa.Numeric(precision=5, scale=2), nullable=True, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("organizations", "produtora_tax_rate")
    op.drop_column("organizations", "cnpj_tax_rate")
