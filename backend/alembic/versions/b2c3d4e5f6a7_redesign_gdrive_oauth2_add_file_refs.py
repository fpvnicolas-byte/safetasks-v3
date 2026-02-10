"""redesign google_drive_credentials for oauth2 and add cloud_file_references

Revision ID: b2c3d4e5f6a7
Revises: a1c2d3e4f5a6
Create Date: 2026-02-10 02:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, None] = "a1c2d3e4f5a6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── 1. Redesign google_drive_credentials ─────────────────
    # Drop old columns
    # Drop old columns safely (ignoring if they don't exist)
    op.execute("ALTER TABLE google_drive_credentials DROP COLUMN IF EXISTS credentials")
    op.execute("ALTER TABLE google_drive_credentials DROP COLUMN IF EXISTS service_account_key")
    op.execute("ALTER TABLE google_drive_credentials DROP COLUMN IF EXISTS auto_sync_enabled")
    op.execute("ALTER TABLE google_drive_credentials DROP COLUMN IF EXISTS sync_on_proposal_approval")
    op.execute("ALTER TABLE google_drive_credentials DROP COLUMN IF EXISTS sync_on_shooting_day_finalized")
    op.execute("ALTER TABLE google_drive_credentials DROP COLUMN IF EXISTS last_sync_at")

    # Add OAuth2 columns
    op.add_column(
        "google_drive_credentials",
        sa.Column("access_token", sa.TEXT(), nullable=True),
    )
    op.add_column(
        "google_drive_credentials",
        sa.Column("refresh_token", sa.TEXT(), nullable=True),
    )
    op.add_column(
        "google_drive_credentials",
        sa.Column(
            "token_expiry",
            sa.TIMESTAMP(timezone=True),
            nullable=True,
        ),
    )
    op.add_column(
        "google_drive_credentials",
        sa.Column("connected_email", sa.String(), nullable=True),
    )
    op.add_column(
        "google_drive_credentials",
        sa.Column("oauth_scopes", sa.String(), nullable=True),
    )

    # ── 2. Create cloud_file_references ──────────────────────
    op.create_table(
        "cloud_file_references",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "organization_id",
            UUID(as_uuid=True),
            sa.ForeignKey("organizations.id"),
            nullable=False,
        ),
        sa.Column(
            "project_id",
            UUID(as_uuid=True),
            sa.ForeignKey("projects.id"),
            nullable=True,
        ),
        sa.Column("module", sa.String(), nullable=True),
        sa.Column("file_name", sa.String(), nullable=False),
        sa.Column("file_size", sa.String(), nullable=True),
        sa.Column("mime_type", sa.String(), nullable=True),
        sa.Column("storage_provider", sa.String(), nullable=False),
        sa.Column("supabase_path", sa.String(), nullable=True),
        sa.Column("external_id", sa.String(), nullable=True),
        sa.Column("external_url", sa.String(), nullable=True),
        sa.Column("thumbnail_path", sa.String(), nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.func.now(),
        ),
    )

    # Add indexes
    op.create_index(
        "ix_cloud_file_references_org_id",
        "cloud_file_references",
        ["organization_id"],
    )
    op.create_index(
        "ix_cloud_file_references_project_id",
        "cloud_file_references",
        ["project_id"],
    )


def downgrade() -> None:
    # Drop cloud_file_references
    op.drop_index("ix_cloud_file_references_project_id", table_name="cloud_file_references")
    op.drop_index("ix_cloud_file_references_org_id", table_name="cloud_file_references")
    op.drop_table("cloud_file_references")

    # Restore old google_drive_credentials columns
    op.drop_column("google_drive_credentials", "oauth_scopes")
    op.drop_column("google_drive_credentials", "connected_email")
    op.drop_column("google_drive_credentials", "token_expiry")
    op.drop_column("google_drive_credentials", "refresh_token")
    op.drop_column("google_drive_credentials", "access_token")

    op.add_column(
        "google_drive_credentials",
        sa.Column("credentials", sa.JSON(), nullable=True),
    )
    op.add_column(
        "google_drive_credentials",
        sa.Column("service_account_key", sa.JSON(), nullable=True),
    )
    op.add_column(
        "google_drive_credentials",
        sa.Column("auto_sync_enabled", sa.Boolean(), server_default="true"),
    )
    op.add_column(
        "google_drive_credentials",
        sa.Column("sync_on_proposal_approval", sa.Boolean(), server_default="true"),
    )
    op.add_column(
        "google_drive_credentials",
        sa.Column("sync_on_shooting_day_finalized", sa.Boolean(), server_default="true"),
    )
    op.add_column(
        "google_drive_credentials",
        sa.Column("last_sync_at", sa.TIMESTAMP(timezone=True), nullable=True),
    )
