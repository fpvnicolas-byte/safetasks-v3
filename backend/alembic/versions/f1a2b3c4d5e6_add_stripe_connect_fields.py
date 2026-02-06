"""add stripe connect fields to organizations and invoices

Revision ID: f1a2b3c4d5e6
Revises: e5f6a7b8c9d0
Create Date: 2026-02-05

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'f1a2b3c4d5e6'
down_revision = 'e5f6a7b8c9d0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- Organization: Stripe Connect fields ---
    op.add_column('organizations', sa.Column('stripe_connect_account_id', sa.String(), nullable=True))
    op.add_column('organizations', sa.Column('stripe_connect_onboarding_complete', sa.Boolean(), nullable=False, server_default=sa.text('false')))
    op.add_column('organizations', sa.Column('stripe_connect_enabled_at', sa.TIMESTAMP(timezone=True), nullable=True))

    # --- Invoice: Stripe Connect payment fields ---
    op.add_column('invoices', sa.Column('stripe_checkout_session_id', sa.String(), nullable=True))
    op.add_column('invoices', sa.Column('stripe_payment_intent_id', sa.String(), nullable=True))
    op.add_column('invoices', sa.Column('payment_link_url', sa.String(), nullable=True))
    op.add_column('invoices', sa.Column('payment_link_expires_at', sa.TIMESTAMP(timezone=True), nullable=True))
    op.add_column('invoices', sa.Column('paid_at', sa.TIMESTAMP(timezone=True), nullable=True))
    op.add_column('invoices', sa.Column('paid_via', sa.String(), nullable=True))


def downgrade() -> None:
    # --- Invoice: remove Stripe Connect fields ---
    op.drop_column('invoices', 'paid_via')
    op.drop_column('invoices', 'paid_at')
    op.drop_column('invoices', 'payment_link_expires_at')
    op.drop_column('invoices', 'payment_link_url')
    op.drop_column('invoices', 'stripe_payment_intent_id')
    op.drop_column('invoices', 'stripe_checkout_session_id')

    # --- Organization: remove Stripe Connect fields ---
    op.drop_column('organizations', 'stripe_connect_enabled_at')
    op.drop_column('organizations', 'stripe_connect_onboarding_complete')
    op.drop_column('organizations', 'stripe_connect_account_id')
