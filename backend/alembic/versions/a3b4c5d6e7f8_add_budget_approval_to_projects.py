"""add_budget_approval_to_projects

Revision ID: a3b4c5d6e7f8
Revises: b1f3c9a4e6d2
Create Date: 2026-02-04 20:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a3b4c5d6e7f8'
down_revision: Union[str, None] = 'beb962120563'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add budget approval fields to projects table
    op.add_column('projects', sa.Column('budget_status', sa.String(), server_default='draft', nullable=False))
    op.add_column('projects', sa.Column('budget_approved_by', sa.UUID(), nullable=True))
    op.add_column('projects', sa.Column('budget_approved_at', sa.TIMESTAMP(timezone=True), nullable=True))
    op.add_column('projects', sa.Column('budget_notes', sa.String(), nullable=True))
    
    # Add foreign key for budget_approved_by
    op.create_foreign_key(
        'fk_projects_budget_approved_by',
        'projects', 'profiles',
        ['budget_approved_by'], ['id']
    )
    
    # Add check constraint for budget_status
    op.create_check_constraint(
        'ck_projects_budget_status',
        'projects',
        "budget_status IN ('draft', 'pending_approval', 'approved', 'rejected')"
    )


def downgrade() -> None:
    # Remove check constraint
    op.drop_constraint('ck_projects_budget_status', 'projects', type_='check')
    
    # Remove foreign key
    op.drop_constraint('fk_projects_budget_approved_by', 'projects', type_='foreignkey')
    
    # Remove columns
    op.drop_column('projects', 'budget_notes')
    op.drop_column('projects', 'budget_approved_at')
    op.drop_column('projects', 'budget_approved_by')
    op.drop_column('projects', 'budget_status')
