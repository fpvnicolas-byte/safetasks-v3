"""add_clients_approvals_indexes

Revision ID: 5bd342bc298d
Revises: 8681bffd095e
Create Date: 2026-02-07 00:48:38.519530

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '5bd342bc298d'
down_revision: Union[str, None] = '8681bffd095e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # CREATE INDEX CONCURRENTLY must run outside a transaction.
    with op.get_context().autocommit_block():
        op.execute(
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_clients_org_is_active "
            "ON clients (organization_id, is_active)"
        )
        op.execute(
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_projects_org_budget_status_updated_at "
            "ON projects (organization_id, budget_status, updated_at)"
        )
        op.execute(
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_transactions_org_payment_status_dates "
            "ON transactions (organization_id, payment_status, transaction_date, created_at)"
        )


def downgrade() -> None:
    # DROP INDEX CONCURRENTLY must run outside a transaction.
    with op.get_context().autocommit_block():
        op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_transactions_org_payment_status_dates")
        op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_projects_org_budget_status_updated_at")
        op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_clients_org_is_active")
