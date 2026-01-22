from app.services.base import BaseService
from app.models.commercial import Supplier
from app.models.transactions import Transaction
from app.schemas.commercial import (
    SupplierCreate, SupplierUpdate,
    SupplierStatement, StakeholderSummary
)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime, date


class SupplierService(BaseService[Supplier, SupplierCreate, SupplierUpdate]):
    """Service for Supplier operations."""

    def __init__(self):
        super().__init__(Supplier)

    async def get_suppliers_with_transaction_summary(
        self,
        db: AsyncSession,
        *,
        organization_id: UUID,
        category: Optional[str] = None,
        active_only: bool = True
    ) -> List[Dict[str, Any]]:
        """
        Get suppliers with transaction summary information.
        """
        # Build base query
        conditions = [Supplier.organization_id == organization_id]
        if active_only:
            conditions.append(Supplier.is_active == True)
        if category:
            conditions.append(Supplier.category == category)

        # Get suppliers
        suppliers_query = select(Supplier).where(and_(*conditions))
        suppliers_result = await db.execute(suppliers_query)
        suppliers = suppliers_result.scalars().all()

        # Enrich with transaction data
        enriched_suppliers = []
        for supplier in suppliers:
            # Get transaction summary for this supplier
            tx_summary_query = select(
                func.count(Transaction.id).label('total_transactions'),
                func.sum(Transaction.amount_cents).label('total_amount_cents'),
                func.max(Transaction.transaction_date).label('last_transaction_date')
            ).where(
                and_(
                    Transaction.organization_id == organization_id,
                    Transaction.supplier_id == supplier.id,
                    Transaction.type == "expense"  # Only expenses to suppliers
                )
            )

            tx_result = await db.execute(tx_summary_query)
            tx_row = tx_result.first()

            enriched_suppliers.append({
                "id": supplier.id,
                "name": supplier.name,
                "category": supplier.category,
                "email": supplier.email,
                "phone": supplier.phone,
                "is_active": supplier.is_active,
                "total_transactions": tx_row.total_transactions or 0,
                "total_amount_cents": tx_row.total_amount_cents or 0,
                "last_transaction_date": tx_row.last_transaction_date,
                "created_at": supplier.created_at
            })

        return enriched_suppliers


class StakeholderService:
    """Service for managing all stakeholders in the organization."""

    def __init__(self):
        self.supplier_service = SupplierService()

    async def get_stakeholder_summary(
        self,
        db: AsyncSession,
        *,
        organization_id: UUID
    ) -> StakeholderSummary:
        """
        Get a unified view of all stakeholders in the organization.
        """
        # Get clients
        from app.models.clients import Client
        clients_query = select(Client).where(Client.organization_id == organization_id)
        clients_result = await db.execute(clients_query)
        clients = clients_result.scalars().all()

        clients_data = [
            {
                "id": str(client.id),
                "name": client.name,
                "email": client.email,
                "document_id": client.document_id,
                "type": "client",
                "relationship": "revenue_source"
            }
            for client in clients
        ]

        # Get suppliers with transaction data
        suppliers_data = await self.supplier_service.get_suppliers_with_transaction_summary(
            db=db, organization_id=organization_id, active_only=True
        )

        suppliers_formatted = [
            {
                "id": str(supplier["id"]),
                "name": supplier["name"],
                "category": supplier["category"],
                "email": supplier["email"],
                "phone": supplier["phone"],
                "type": "supplier",
                "relationship": "vendor",
                "total_spent_cents": supplier["total_amount_cents"],
                "transaction_count": supplier["total_transactions"],
                "last_transaction": supplier["last_transaction_date"]
            }
            for supplier in suppliers_data
        ]

        # Get crew members (internal stakeholders)
        from app.models.profiles import Profile
        crew_query = select(Profile).where(
            and_(
                Profile.organization_id == organization_id,
                Profile.role.in_(["crew", "manager", "admin"])
            )
        )
        crew_result = await db.execute(crew_query)
        crew_members = crew_result.scalars().all()

        crew_data = [
            {
                "id": str(member.id),
                "name": member.full_name,
                "email": None,  # Profiles don't have email in current model
                "role": member.role,
                "type": "crew",
                "relationship": "internal"
            }
            for member in crew_members
        ]

        # Get active projects count
        from app.models.projects import Project
        projects_query = select(func.count(Project.id)).where(
            and_(
                Project.organization_id == organization_id,
                Project.status.in_(["pre-production", "production", "post-production"])
            )
        )
        projects_result = await db.execute(projects_query)
        active_projects = projects_result.scalar() or 0

        return StakeholderSummary(
            organization_id=organization_id,
            clients=clients_data,
            suppliers=suppliers_formatted,
            crew_members=crew_data,
            total_clients=len(clients_data),
            total_suppliers=len(suppliers_formatted),
            total_crew=len(crew_data),
            total_active_projects=active_projects,
            generated_at=datetime.now()
        )


class SupplierStatementService:
    """Service for generating detailed supplier financial statements."""

    def __init__(self):
        self.supplier_service = SupplierService()

    async def get_supplier_statement(
        self,
        db: AsyncSession,
        *,
        organization_id: UUID,
        supplier_id: UUID,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None
    ) -> SupplierStatement:
        """
        Generate a detailed financial statement for a specific supplier.
        """
        # Get supplier details
        supplier = await self.supplier_service.get(
            db=db, organization_id=organization_id, id=supplier_id
        )
        if not supplier:
            raise ValueError("Supplier not found")

        # Build date filter
        date_conditions = []
        if date_from:
            date_conditions.append(Transaction.transaction_date >= date_from)
        if date_to:
            date_conditions.append(Transaction.transaction_date <= date_to)

        # Get all transactions for this supplier
        tx_conditions = [
            Transaction.organization_id == organization_id,
            Transaction.supplier_id == supplier_id,
            Transaction.type == "expense"  # Only expenses to suppliers
        ] + date_conditions

        transactions_query = select(Transaction).where(and_(*tx_conditions)).order_by(
            Transaction.transaction_date.desc()
        )
        tx_result = await db.execute(transactions_query)
        transactions = tx_result.scalars().all()

        # Convert transactions to dict format
        transactions_data = [
            {
                "transaction_id": str(tx.id),
                "amount_cents": tx.amount_cents,
                "category": tx.category,
                "description": tx.description,
                "date": tx.transaction_date.isoformat(),
                "project_id": str(tx.project_id) if tx.project_id else None
            }
            for tx in transactions
        ]

        # Calculate totals
        total_transactions = len(transactions)
        total_amount_cents = sum(tx.amount_cents for tx in transactions)

        # Group by project
        project_totals = {}
        for tx in transactions:
            project_key = str(tx.project_id) if tx.project_id else "No Project"
            if project_key not in project_totals:
                project_totals[project_key] = 0
            project_totals[project_key] += tx.amount_cents

        project_breakdown = [
            {
                "project_id": project_id,
                "total_cents": total,
                "formatted_total": f"R$ {total / 100:.2f}"
            }
            for project_id, total in project_totals.items()
        ]

        # Group by category
        category_totals = {}
        for tx in transactions:
            category = tx.category
            if category not in category_totals:
                category_totals[category] = 0
            category_totals[category] += tx.amount_cents

        category_breakdown = [
            {
                "category": category,
                "total_cents": total,
                "formatted_total": f"R$ {total / 100:.2f}"
            }
            for category, total in category_totals.items()
        ]

        # Determine date range
        if transactions:
            actual_date_from = min(tx.transaction_date for tx in transactions)
            actual_date_to = max(tx.transaction_date for tx in transactions)
        else:
            actual_date_from = date_from or date.today()
            actual_date_to = date_to or date.today()

        return SupplierStatement(
            supplier_id=supplier_id,
            supplier_name=supplier.name,
            supplier_category=supplier.category,
            total_transactions=total_transactions,
            total_amount_cents=total_amount_cents,
            currency="BRL",
            transactions=transactions_data,
            project_breakdown=project_breakdown,
            category_breakdown=category_breakdown,
            statement_period={
                "from": actual_date_from.isoformat(),
                "to": actual_date_to.isoformat()
            },
            generated_at=datetime.now()
        )


# Service instances
supplier_service = SupplierService()
stakeholder_service = StakeholderService()
supplier_statement_service = SupplierStatementService()
