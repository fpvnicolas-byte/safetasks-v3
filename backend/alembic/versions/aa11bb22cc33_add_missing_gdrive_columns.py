"""add missing columns to google_drive_credentials

Revision ID: aa11bb22cc33
Revises: c3d4e5f6a7b8
Create Date: 2026-02-10 20:40:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "aa11bb22cc33"
down_revision: Union[str, None] = "c3d4e5f6a7b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add missing columns to google_drive_credentials
    op.execute("ALTER TABLE google_drive_credentials ADD COLUMN IF NOT EXISTS root_folder_id VARCHAR")
    op.execute("ALTER TABLE google_drive_credentials ADD COLUMN IF NOT EXISTS root_folder_url VARCHAR")
    op.execute("ALTER TABLE google_drive_credentials ADD COLUMN IF NOT EXISTS connected_at TIMESTAMP WITH TIME ZONE")


def downgrade() -> None:
    op.execute("ALTER TABLE google_drive_credentials DROP COLUMN IF EXISTS root_folder_id")
    op.execute("ALTER TABLE google_drive_credentials DROP COLUMN IF EXISTS root_folder_url")
    op.execute("ALTER TABLE google_drive_credentials DROP COLUMN IF EXISTS connected_at")
