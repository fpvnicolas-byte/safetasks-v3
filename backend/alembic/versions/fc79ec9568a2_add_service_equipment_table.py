"""add_service_equipment_table

Revision ID: fc79ec9568a2
Revises: bb75e6fa421e
Create Date: 2026-02-01 00:31:27.970447

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'fc79ec9568a2'
down_revision: Union[str, None] = 'bb75e6fa421e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'service_equipment',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id'), nullable=False),
        sa.Column('service_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('services.id'), nullable=False),
        sa.Column('kit_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('kits.id'), nullable=False),
        sa.Column('is_primary', sa.Boolean(), default=False),
        sa.Column('notes', sa.String(), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint('service_id', 'kit_id', name='uq_service_kit'),
    )

    op.create_index('ix_service_equipment_service_id', 'service_equipment', ['service_id'])
    op.create_index('ix_service_equipment_kit_id', 'service_equipment', ['kit_id'])
    op.create_index('ix_service_equipment_organization_id', 'service_equipment', ['organization_id'])


def downgrade() -> None:
    op.drop_index('ix_service_equipment_organization_id', table_name='service_equipment')
    op.drop_index('ix_service_equipment_kit_id', table_name='service_equipment')
    op.drop_index('ix_service_equipment_service_id', table_name='service_equipment')
    op.drop_table('service_equipment')
