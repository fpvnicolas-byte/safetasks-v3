"""add project_drive_folders table

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-02-10 20:35:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, None] = "b2c3d4e5f6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create project_drive_folders table (if not exists)
    op.execute("""
        CREATE TABLE IF NOT EXISTS project_drive_folders (
            id UUID PRIMARY KEY,
            organization_id UUID NOT NULL REFERENCES organizations(id),
            project_id UUID NOT NULL UNIQUE REFERENCES projects(id),
            project_folder_id VARCHAR,
            project_folder_url VARCHAR,
            scripts_folder_id VARCHAR,
            scripts_folder_url VARCHAR,
            shooting_days_folder_id VARCHAR,
            shooting_days_folder_url VARCHAR,
            media_folder_id VARCHAR,
            media_folder_url VARCHAR,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
        )
    """)

    # Add indexes
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_project_drive_folders_org_id
        ON project_drive_folders (organization_id)
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_project_drive_folders_project_id
        ON project_drive_folders (project_id)
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS project_drive_folders")
