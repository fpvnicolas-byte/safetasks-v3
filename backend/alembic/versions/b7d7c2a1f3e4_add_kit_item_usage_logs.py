"""add_kit_item_usage_logs

Revision ID: b7d7c2a1f3e4
Revises: f1a2b3c4d5e6
Create Date: 2026-02-06

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "b7d7c2a1f3e4"
down_revision = "f1a2b3c4d5e6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "kit_item_usage_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "organization_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id"),
            nullable=False,
        ),
        sa.Column(
            "project_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "kit_item_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("kit_items.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("hours", sa.Float(), nullable=False),
        sa.Column(
            "source",
            sa.String(),
            nullable=False,
            server_default=sa.text("'project_delivered'"),
        ),
        sa.Column("usage_metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint("project_id", "kit_item_id", name="uq_kit_item_usage_project_item"),
    )

    op.create_index(
        "ix_kit_item_usage_logs_organization_id",
        "kit_item_usage_logs",
        ["organization_id"],
    )
    op.create_index(
        "ix_kit_item_usage_logs_project_id",
        "kit_item_usage_logs",
        ["project_id"],
    )
    op.create_index(
        "ix_kit_item_usage_logs_kit_item_id",
        "kit_item_usage_logs",
        ["kit_item_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_kit_item_usage_logs_kit_item_id", table_name="kit_item_usage_logs")
    op.drop_index("ix_kit_item_usage_logs_project_id", table_name="kit_item_usage_logs")
    op.drop_index("ix_kit_item_usage_logs_organization_id", table_name="kit_item_usage_logs")
    op.drop_table("kit_item_usage_logs")

