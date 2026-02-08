"""drop_call_sheets_table

Revision ID: feb1cf3e58ed
Revises: 52218c11704b
Create Date: 2026-02-08 00:57:28.821337

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'feb1cf3e58ed'
down_revision: Union[str, None] = '52218c11704b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop the call_sheets table
    op.drop_table('call_sheets')


def downgrade() -> None:
    # Recreate call_sheets table if needed to rollback
    # Note: This is a simplified recreation - adjust if you need to preserve data
    op.create_table(
        'call_sheets',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('organization_id', sa.UUID(), nullable=False),
        sa.Column('project_id', sa.UUID(), nullable=False),
        sa.Column('shooting_day', sa.Date(), nullable=False),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('location', sa.String(), nullable=True),
        sa.Column('location_address', sa.String(), nullable=True),
        sa.Column('parking_info', sa.String(), nullable=True),
        sa.Column('crew_call', sa.Time(), nullable=True),
        sa.Column('on_set', sa.Time(), nullable=True),
        sa.Column('lunch_time', sa.Time(), nullable=True),
        sa.Column('wrap_time', sa.Time(), nullable=True),
        sa.Column('weather', sa.String(), nullable=True),
        sa.Column('notes', sa.String(), nullable=True),
        sa.Column('hospital_info', sa.String(), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
