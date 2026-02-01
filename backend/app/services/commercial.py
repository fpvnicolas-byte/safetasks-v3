from app.services.base import BaseService
from app.models.commercial import Supplier, Stakeholder
from app.models.transactions import Transaction
from app.models.clients import Client
from app.models.profiles import Profile
from app.models.projects import Project
from app.models.scheduling import ShootingDay
from app.schemas.commercial import (
    SupplierCreate, SupplierUpdate,
    SupplierStatement, StakeholderSummary,
    StakeholderCreate, StakeholderUpdate,
    StakeholderWithRateInfo, RateCalculationBreakdown
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

            # Create complete supplier data with all required fields
            supplier_data = {
                "id": supplier.id,
                "organization_id": supplier.organization_id,
                "name": supplier.name,
                "category": supplier.category,
                "document_id": supplier.document_id,
                "email": supplier.email,
                "phone": supplier.phone,
                "address": supplier.address,
                "bank_info": supplier.bank_info,
                "specialties": supplier.specialties,
                "notes": supplier.notes,
                "is_active": supplier.is_active,
                "created_at": supplier.created_at,
                "updated_at": supplier.updated_at,
                "total_transactions": tx_row.total_transactions or 0,
                "total_amount_cents": tx_row.total_amount_cents or 0,
                "last_transaction_date": tx_row.last_transaction_date
            }

            enriched_suppliers.append(supplier_data)

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
                "document_id": client.document,
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
                or_(
                    Profile.role.in_(["crew", "manager", "admin"]),
                    Profile.role_v2.in_(["freelancer", "producer", "admin", "owner"])
                )
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


class StakeholderCRUDService(BaseService[Stakeholder, StakeholderCreate, StakeholderUpdate]):
    """Service for project Stakeholder CRUD operations."""

    def __init__(self):
        super().__init__(Stakeholder)

    async def get_by_project(
        self,
        db: AsyncSession,
        *,
        organization_id: UUID,
        project_id: UUID,
        active_only: bool = True
    ) -> List[Stakeholder]:
        """Get all stakeholders for a specific project."""
        conditions = [
            Stakeholder.organization_id == organization_id,
            Stakeholder.project_id == project_id
        ]
        if active_only:
            conditions.append(Stakeholder.is_active == True)

        query = select(Stakeholder).where(and_(*conditions)).order_by(Stakeholder.created_at.desc())
        result = await db.execute(query)
        return list(result.scalars().all())

    async def get_with_rate_calculation(
        self,
        db: AsyncSession,
        *,
        organization_id: UUID,
        stakeholder_id: UUID
    ) -> Optional[StakeholderWithRateInfo]:
        """
        Get stakeholder with calculated payment suggestion and payment tracking.

        Returns rate info including:
        - suggested_amount_cents: calculated from rate × units
        - total_paid_cents: sum of transactions already paid
        - pending_amount_cents: suggested - paid
        - payment_status: not_configured, pending, partial, paid, overpaid
        """
        # Get stakeholder
        stakeholder = await self.get(db=db, organization_id=organization_id, id=stakeholder_id)
        if not stakeholder:
            return None

        # Count shooting days for the project
        shooting_days_query = select(func.count(ShootingDay.id)).where(
            and_(
                ShootingDay.organization_id == organization_id,
                ShootingDay.project_id == stakeholder.project_id
            )
        )
        shooting_days_result = await db.execute(shooting_days_query)
        shooting_days_count = shooting_days_result.scalar() or 0

        # Sum transactions already paid to this stakeholder
        paid_query = select(func.coalesce(func.sum(Transaction.amount_cents), 0)).where(
            and_(
                Transaction.organization_id == organization_id,
                Transaction.stakeholder_id == stakeholder_id,
                Transaction.type == "expense"
            )
        )
        paid_result = await db.execute(paid_query)
        total_paid_cents = paid_result.scalar() or 0

        # Calculate suggested amount based on rate
        suggested_amount_cents = None
        calculation_breakdown = None

        if stakeholder.rate_type and stakeholder.rate_value_cents:
            if stakeholder.rate_type == 'daily':
                # Use estimated_units if set, otherwise use shooting days count
                days = stakeholder.estimated_units or shooting_days_count
                suggested_amount_cents = stakeholder.rate_value_cents * days
                calculation_breakdown = RateCalculationBreakdown(
                    type="daily",
                    rate_per_day_cents=stakeholder.rate_value_cents,
                    days=days,
                    source="estimated_units" if stakeholder.estimated_units else "shooting_days"
                )
            elif stakeholder.rate_type == 'hourly':
                hours = stakeholder.estimated_units or 0
                suggested_amount_cents = stakeholder.rate_value_cents * hours
                calculation_breakdown = RateCalculationBreakdown(
                    type="hourly",
                    rate_per_hour_cents=stakeholder.rate_value_cents,
                    hours=hours
                )
            elif stakeholder.rate_type == 'fixed':
                suggested_amount_cents = stakeholder.rate_value_cents
                calculation_breakdown = RateCalculationBreakdown(
                    type="fixed",
                    fixed_amount_cents=stakeholder.rate_value_cents
                )

        # Calculate pending amount and payment status
        pending_amount_cents = None
        payment_status = "not_configured"

        if suggested_amount_cents is not None:
            pending_amount_cents = suggested_amount_cents - total_paid_cents
            if total_paid_cents == 0:
                payment_status = "pending"
            elif total_paid_cents < suggested_amount_cents:
                payment_status = "partial"
            elif total_paid_cents == suggested_amount_cents:
                payment_status = "paid"
            else:
                payment_status = "overpaid"

        return StakeholderWithRateInfo(
            id=stakeholder.id,
            organization_id=stakeholder.organization_id,
            project_id=stakeholder.project_id,
            supplier_id=stakeholder.supplier_id,
            name=stakeholder.name,
            role=stakeholder.role,
            email=stakeholder.email,
            phone=stakeholder.phone,
            notes=stakeholder.notes,
            is_active=stakeholder.is_active,
            rate_type=stakeholder.rate_type,
            rate_value_cents=stakeholder.rate_value_cents,
            estimated_units=stakeholder.estimated_units,
            created_at=stakeholder.created_at,
            updated_at=stakeholder.updated_at,
            shooting_days_count=shooting_days_count,
            suggested_amount_cents=suggested_amount_cents,
            calculation_breakdown=calculation_breakdown,
            total_paid_cents=total_paid_cents,
            pending_amount_cents=pending_amount_cents,
            payment_status=payment_status
        )

    async def get_project_stakeholders_with_rates(
        self,
        db: AsyncSession,
        *,
        organization_id: UUID,
        project_id: UUID,
        active_only: bool = True
    ) -> List[StakeholderWithRateInfo]:
        """Get all stakeholders for a project with rate calculations."""
        stakeholders = await self.get_by_project(
            db=db,
            organization_id=organization_id,
            project_id=project_id,
            active_only=active_only
        )

        result = []
        for stakeholder in stakeholders:
            rate_info = await self.get_with_rate_calculation(
                db=db,
                organization_id=organization_id,
                stakeholder_id=stakeholder.id
            )
            if rate_info:
                result.append(rate_info)

        return result


# Service instances
supplier_service = SupplierService()
stakeholder_service = StakeholderService()
supplier_statement_service = SupplierStatementService()
stakeholder_crud_service = StakeholderCRUDService()
