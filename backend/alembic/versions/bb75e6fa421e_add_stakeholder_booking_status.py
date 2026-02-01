"""add_stakeholder_booking_status

Revision ID: bb75e6fa421e
Revises: ae4416eedee2
Create Date: 2026-02-01 00:23:33.837573

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'bb75e6fa421e'
down_revision: Union[str, None] = 'ae4416eedee2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add status enum type
    stakeholder_status_enum = sa.Enum(
        'requested', 'confirmed', 'working', 'completed', 'cancelled',
        name='stakeholderstatusenum'
    )
    stakeholder_status_enum.create(op.get_bind(), checkfirst=True)

    # Add columns to stakeholders table
    op.add_column('stakeholders',
        sa.Column('status', sa.Enum('requested', 'confirmed', 'working', 'completed', 'cancelled', name='stakeholderstatusenum'),
                  nullable=False, server_default='requested')
    )
    op.add_column('stakeholders',
        sa.Column('status_changed_at', sa.TIMESTAMP(timezone=True), nullable=True)
    )
    op.add_column('stakeholders',
        sa.Column('status_notes', sa.TEXT(), nullable=True)
    )
    op.add_column('stakeholders',
        sa.Column('booking_start_date', sa.Date(), nullable=True)
    )
    op.add_column('stakeholders',
        sa.Column('booking_end_date', sa.Date(), nullable=True)
    )
    op.add_column('stakeholders',
        sa.Column('confirmed_rate_cents', sa.BigInteger(), nullable=True)
    )
    op.add_column('stakeholders',
        sa.Column('confirmed_rate_type', sa.String(20), nullable=True)
    )

    # Create indexes for status queries
    op.create_index('ix_stakeholders_status', 'stakeholders', ['status'])
    op.create_index('ix_stakeholders_project_status', 'stakeholders', ['project_id', 'status'])


def downgrade() -> None:
    op.drop_index('ix_stakeholders_project_status', table_name='stakeholders')
    op.drop_index('ix_stakeholders_status', table_name='stakeholders')
    op.drop_column('stakeholders', 'confirmed_rate_type')
    op.drop_column('stakeholders', 'confirmed_rate_cents')
    op.drop_column('stakeholders', 'booking_end_date')
    op.drop_column('stakeholders', 'booking_start_date')
    op.drop_column('stakeholders', 'status_notes')
    op.drop_column('stakeholders', 'status_changed_at')
    op.drop_column('stakeholders', 'status')

    # Drop enum type
    sa.Enum(name='stakeholderstatusenum').drop(op.get_bind(), checkfirst=True)
