"""backfill_stakeholder_supplier_id

Revision ID: a1c2d3e4f5a6
Revises: feb1cf3e58ed
Create Date: 2026-02-08 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import text
import uuid


# revision identifiers, used by Alembic.
revision: str = 'a1c2d3e4f5a6'
down_revision: Union[str, None] = 'feb1cf3e58ed'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    # 1. Find all stakeholders without a supplier_id
    orphans = conn.execute(text(
        "SELECT id, organization_id, name, email, phone "
        "FROM stakeholders WHERE supplier_id IS NULL"
    )).fetchall()

    for row in orphans:
        stakeholder_id = row[0]
        org_id = row[1]
        name = row[2]
        email = row[3]
        phone = row[4]

        # 2. Try to match by (organization_id, name, email)
        match_query = text(
            "SELECT id FROM suppliers "
            "WHERE organization_id = :org_id AND name = :name "
            "AND (email = :email OR (email IS NULL AND :email IS NULL)) "
            "LIMIT 1"
        )
        match = conn.execute(match_query, {
            "org_id": org_id, "name": name, "email": email
        }).fetchone()

        if match:
            supplier_id = match[0]
        else:
            # 3. Create a new Supplier
            supplier_id = uuid.uuid4()
            conn.execute(text(
                "INSERT INTO suppliers (id, organization_id, name, category, email, phone, is_active) "
                "VALUES (:id, :org_id, :name, 'freelancer', :email, :phone, true)"
            ), {
                "id": supplier_id, "org_id": org_id,
                "name": name, "email": email, "phone": phone,
            })

        # 4. Link the stakeholder
        conn.execute(text(
            "UPDATE stakeholders SET supplier_id = :supplier_id WHERE id = :id"
        ), {"supplier_id": supplier_id, "id": stakeholder_id})

    # 5. Set NOT NULL
    op.alter_column('stakeholders', 'supplier_id', nullable=False)


def downgrade() -> None:
    op.alter_column('stakeholders', 'supplier_id', nullable=True)
