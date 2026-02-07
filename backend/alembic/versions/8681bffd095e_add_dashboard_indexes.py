"""add_dashboard_indexes

Revision ID: 8681bffd095e
Revises: b7d7c2a1f3e4
Create Date: 2026-02-06 23:34:03.791290

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '8681bffd095e'
down_revision: Union[str, None] = 'b7d7c2a1f3e4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # CREATE INDEX CONCURRENTLY must run outside a transaction.
    with op.get_context().autocommit_block():
        op.execute(
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_transactions_org_transaction_date "
            "ON transactions (organization_id, transaction_date)"
        )
        op.execute(
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_transactions_org_category_type_payment_status "
            "ON transactions (organization_id, category, type, payment_status)"
        )
        op.execute(
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_projects_org_status "
            "ON projects (organization_id, status)"
        )
        op.execute(
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_kit_items_org_health_status "
            "ON kit_items (organization_id, health_status)"
        )
        op.execute(
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_cloud_sync_status_org_sync_status "
            "ON cloud_sync_status (organization_id, sync_status)"
        )
        op.execute(
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_cloud_sync_status_org_sync_started_at "
            "ON cloud_sync_status (organization_id, sync_started_at)"
        )


def downgrade() -> None:
    # DROP INDEX CONCURRENTLY must run outside a transaction.
    with op.get_context().autocommit_block():
        op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_cloud_sync_status_org_sync_started_at")
        op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_cloud_sync_status_org_sync_status")
        op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_kit_items_org_health_status")
        op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_projects_org_status")
        op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_transactions_org_category_type_payment_status")
        op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_transactions_org_transaction_date")
