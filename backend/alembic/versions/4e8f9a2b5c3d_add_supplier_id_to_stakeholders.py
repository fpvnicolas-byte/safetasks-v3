"""add_supplier_id_to_stakeholders

Revision ID: 4e8f9a2b5c3d
Revises: 3776f2d1424c
Create Date: 2026-01-28 22:52:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4e8f9a2b5c3d'
down_revision: Union[str, None] = '3776f2d1424c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add supplier_id column to stakeholders table
    op.add_column('stakeholders',
        sa.Column('supplier_id', sa.UUID(), nullable=True)
    )
    
    # Add foreign key constraint
    op.create_foreign_key(
        'fk_stakeholders_supplier_id',
        'stakeholders', 'suppliers',
        ['supplier_id'], ['id']
    )


def downgrade() -> None:
    # Drop foreign key constraint
    op.drop_constraint('fk_stakeholders_supplier_id', 'stakeholders', type_='foreignkey')
    
    # Drop supplier_id column
    op.drop_column('stakeholders', 'supplier_id')
