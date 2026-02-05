"""add budget increment fields

Revision ID: b4c5d6e7f8a9
Revises: a3b4c5d6e7f8
Create Date: 2026-02-05 02:22:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b4c5d6e7f8a9'
down_revision = 'a3b4c5d6e7f8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add budget increment columns
    op.add_column('projects', sa.Column('budget_increment_requested_cents', sa.BIGINT(), server_default='0', nullable=False))
    op.add_column('projects', sa.Column('budget_increment_notes', sa.String(), nullable=True))
    op.add_column('projects', sa.Column('budget_increment_requested_at', sa.TIMESTAMP(timezone=True), nullable=True))
    op.add_column('projects', sa.Column('budget_increment_requested_by', sa.UUID(), nullable=True))
    
    # Add foreign key for budget_increment_requested_by
    op.create_foreign_key(
        'fk_projects_budget_increment_requested_by',
        'projects',
        'profiles',
        ['budget_increment_requested_by'],
        ['id']
    )
    
    # Update budget_status check constraint to include 'increment_pending'
    op.drop_constraint('ck_projects_budget_status', 'projects', type_='check')
    op.create_check_constraint(
        'ck_projects_budget_status',
        'projects',
        "budget_status IN ('draft', 'pending_approval', 'approved', 'rejected', 'increment_pending')"
    )


def downgrade() -> None:
    # Revert budget_status check constraint
    op.drop_constraint('ck_projects_budget_status', 'projects', type_='check')
    op.create_check_constraint(
        'ck_projects_budget_status',
        'projects',
        "budget_status IN ('draft', 'pending_approval', 'approved', 'rejected')"
    )
    
    # Drop foreign key
    op.drop_constraint('fk_projects_budget_increment_requested_by', 'projects', type_='foreignkey')
    
    # Drop budget increment columns
    op.drop_column('projects', 'budget_increment_requested_by')
    op.drop_column('projects', 'budget_increment_requested_at')
    op.drop_column('projects', 'budget_increment_notes')
    op.drop_column('projects', 'budget_increment_requested_cents')
