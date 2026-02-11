"""fix project_drive_folders missing columns

Revision ID: bb22cc33dd44
Revises: aa11bb22cc33
Create Date: 2026-02-10 21:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "bb22cc33dd44"
down_revision: Union[str, None] = "aa11bb22cc33"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add all columns that may be missing from project_drive_folders
    op.execute("ALTER TABLE project_drive_folders ADD COLUMN IF NOT EXISTS project_folder_id VARCHAR")
    op.execute("ALTER TABLE project_drive_folders ADD COLUMN IF NOT EXISTS project_folder_url VARCHAR")
    op.execute("ALTER TABLE project_drive_folders ADD COLUMN IF NOT EXISTS scripts_folder_id VARCHAR")
    op.execute("ALTER TABLE project_drive_folders ADD COLUMN IF NOT EXISTS scripts_folder_url VARCHAR")
    op.execute("ALTER TABLE project_drive_folders ADD COLUMN IF NOT EXISTS shooting_days_folder_id VARCHAR")
    op.execute("ALTER TABLE project_drive_folders ADD COLUMN IF NOT EXISTS shooting_days_folder_url VARCHAR")
    op.execute("ALTER TABLE project_drive_folders ADD COLUMN IF NOT EXISTS media_folder_id VARCHAR")
    op.execute("ALTER TABLE project_drive_folders ADD COLUMN IF NOT EXISTS media_folder_url VARCHAR")


def downgrade() -> None:
    pass  # No downgrade needed for safety columns
