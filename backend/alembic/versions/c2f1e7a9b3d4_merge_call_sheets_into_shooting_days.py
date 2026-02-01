"""merge_call_sheets_into_shooting_days

Revision ID: c2f1e7a9b3d4
Revises: bb75e6fa421e
Create Date: 2026-02-01 12:58:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c2f1e7a9b3d4'
down_revision: Union[str, None] = 'bb75e6fa421e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'shooting_days',
        sa.Column('status', sa.String(), nullable=False, server_default='draft')
    )
    op.add_column('shooting_days', sa.Column('on_set', sa.Time(), nullable=True))
    op.add_column('shooting_days', sa.Column('lunch_time', sa.Time(), nullable=True))
    op.add_column('shooting_days', sa.Column('parking_info', sa.TEXT(), nullable=True))
    op.add_column('shooting_days', sa.Column('hospital_info', sa.TEXT(), nullable=True))

    # Migrate overlapping call sheet data into shooting days by project + date.
    op.execute("""
        UPDATE shooting_days sd
        SET status = cs.status,
            on_set = cs.on_set,
            lunch_time = cs.lunch_time,
            parking_info = cs.parking_info,
            hospital_info = cs.hospital_info
        FROM call_sheets cs
        WHERE sd.project_id = cs.project_id
          AND sd.date = cs.shooting_day
    """)


def downgrade() -> None:
    op.drop_column('shooting_days', 'hospital_info')
    op.drop_column('shooting_days', 'parking_info')
    op.drop_column('shooting_days', 'lunch_time')
    op.drop_column('shooting_days', 'on_set')
    op.drop_column('shooting_days', 'status')
