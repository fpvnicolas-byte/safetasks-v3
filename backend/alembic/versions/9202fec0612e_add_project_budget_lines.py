"""add_project_budget_lines

Revision ID: 9202fec0612e
Revises: fc79ec9568a2
Create Date: 2026-02-01 00:36:30.606578

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '9202fec0612e'
down_revision: Union[str, None] = 'fc79ec9568a2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create budget category enum (use raw SQL with IF NOT EXISTS for safety)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE budgetcategoryenum AS ENUM (
                'crew', 'equipment', 'locations', 'talent', 'transportation',
                'catering', 'post_production', 'music_licensing', 'insurance',
                'contingency', 'other'
            );
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)

    # Create project_budget_lines table using raw SQL to reference existing enum
    op.execute("""
        CREATE TABLE project_budget_lines (
            id UUID PRIMARY KEY,
            organization_id UUID NOT NULL REFERENCES organizations(id),
            project_id UUID NOT NULL REFERENCES projects(id),
            category budgetcategoryenum NOT NULL,
            description VARCHAR NOT NULL,
            estimated_amount_cents BIGINT NOT NULL DEFAULT 0,
            stakeholder_id UUID REFERENCES stakeholders(id),
            supplier_id UUID REFERENCES suppliers(id),
            notes TEXT,
            sort_order BIGINT NOT NULL DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
        );
    """)

    # Create indexes
    op.create_index('ix_project_budget_lines_project_id', 'project_budget_lines', ['project_id'])
    op.create_index('ix_project_budget_lines_organization_id', 'project_budget_lines', ['organization_id'])
    op.create_index('ix_project_budget_lines_category', 'project_budget_lines', ['category'])

    # Add budget_line_id to transactions
    op.add_column('transactions',
        sa.Column('budget_line_id', postgresql.UUID(as_uuid=True), nullable=True)
    )
    op.execute('ALTER TABLE transactions ADD CONSTRAINT fk_transactions_budget_line FOREIGN KEY (budget_line_id) REFERENCES project_budget_lines(id)')
    op.create_index('ix_transactions_budget_line_id', 'transactions', ['budget_line_id'])


def downgrade() -> None:
    op.drop_index('ix_transactions_budget_line_id', table_name='transactions')
    op.execute('ALTER TABLE transactions DROP CONSTRAINT IF EXISTS fk_transactions_budget_line')
    op.drop_column('transactions', 'budget_line_id')
    op.drop_index('ix_project_budget_lines_category', table_name='project_budget_lines')
    op.drop_index('ix_project_budget_lines_organization_id', table_name='project_budget_lines')
    op.drop_index('ix_project_budget_lines_project_id', table_name='project_budget_lines')
    op.drop_table('project_budget_lines')
    op.execute('DROP TYPE IF EXISTS budgetcategoryenum')
