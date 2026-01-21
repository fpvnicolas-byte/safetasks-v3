from datetime import datetime, timedelta
from decimal import Decimal
from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.crud import CRUDBase
from .models import Client, Budget, Proposal
from .schemas import (
    BudgetCalculationRequest,
    BudgetCalculationResponse,
    BudgetLineItem,
    BudgetVersionCreate,
    ProposalCreate,
    ProposalUpdate,
    ClientFilter,
    BudgetFilter,
    ProposalFilter
)


class ClientService(CRUDBase[Client, Any, Any]):
    """Service for client management operations."""

    def __init__(self):
        super().__init__(Client)

    async def get_clients_with_stats(
        self,
        db: AsyncSession,
        filters: Optional[ClientFilter] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """
        Get clients with budget and proposal statistics.
        """
        query = select(
            Client,
            func.count(Budget.id).label('budget_count'),
            func.count(Proposal.id).label('proposal_count'),
            func.sum(Budget.total_cents).label('total_budget_value')
        ).outerjoin(Budget).outerjoin(Proposal)

        # Apply filters
        if filters:
            if filters.search:
                query = query.where(
                    Client.name.ilike(f"%{filters.search}%") |
                    Client.email.ilike(f"%{filters.search}%")
                )
            if filters.is_active is not None:
                query = query.where(Client.is_active == filters.is_active)
            if filters.tax_id:
                query = query.where(Client.tax_id == filters.tax_id)

        query = query.group_by(Client.id).offset(skip).limit(limit)

        result = await db.execute(query)
        clients_with_stats = []

        for row in result:
            client, budget_count, proposal_count, total_budget_value = row
            clients_with_stats.append({
                'client': client,
                'stats': {
                    'budget_count': budget_count or 0,
                    'proposal_count': proposal_count or 0,
                    'total_budget_value': Decimal(total_budget_value or 0) / 100
                }
            })

        return clients_with_stats


class BudgetService(CRUDBase[Budget, Any, Any]):
    """Service for budget management operations."""

    def __init__(self):
        super().__init__(Budget)

    async def calculate_budget(
        self,
        request: BudgetCalculationRequest
    ) -> BudgetCalculationResponse:
        """
        Calculate budget totals based on line items and settings.
        """
        # Calculate line items total
        line_items_total = sum(item.amount_cents for item in request.line_items)

        # Calculate tax
        tax_amount = int(line_items_total * (request.tax_rate_percent / 100))

        # Apply discount
        taxable_amount = line_items_total + tax_amount
        discounted_amount = taxable_amount - request.discount_cents

        # Apply profit margin
        profit_amount = int(discounted_amount * (request.profit_margin_percent / 100))

        # Final total
        total = discounted_amount + profit_amount

        return BudgetCalculationResponse(
            subtotal=Decimal(line_items_total) / 100,
            tax_amount=Decimal(tax_amount) / 100,
            discount=Decimal(request.discount_cents) / 100,
            profit_amount=Decimal(profit_amount) / 100,
            total=Decimal(total) / 100,
            line_items_total=Decimal(line_items_total) / 100,
            taxable_amount=Decimal(taxable_amount) / 100,
            discounted_amount=Decimal(discounted_amount) / 100,
            pre_profit_total=Decimal(discounted_amount) / 100
        )

    async def create_budget_version(
        self,
        db: AsyncSession,
        parent_budget_id: int,
        version_data: BudgetVersionCreate,
        created_by: str
    ) -> Budget:
        """
        Create a new version of an existing budget.
        """
        # Get the parent budget
        parent_budget = await self.get(db=db, id=parent_budget_id)
        if not parent_budget:
            raise ValueError("Parent budget not found")

        # Get the next version number
        result = await db.execute(
            select(func.max(Budget.version)).where(Budget.client_id == parent_budget.client_id)
        )
        next_version = (result.scalar() or 0) + 1

        # Create new budget version
        new_budget_data = {
            'version': next_version,
            'name': version_data.name or parent_budget.name,
            'description': version_data.description or parent_budget.description,
            'client_id': parent_budget.client_id,
            'subtotal_cents': parent_budget.subtotal_cents,
            'tax_rate_percent': version_data.tax_rate_percent if version_data.tax_rate_percent is not None else parent_budget.tax_rate_percent,
            'tax_amount_cents': parent_budget.tax_amount_cents,
            'discount_cents': version_data.discount_cents if version_data.discount_cents is not None else parent_budget.discount_cents,
            'total_cents': parent_budget.total_cents,
            'line_items': version_data.line_items or parent_budget.line_items,
            'profit_margin_percent': version_data.profit_margin_percent if version_data.profit_margin_percent is not None else parent_budget.profit_margin_percent,
            'profit_amount_cents': parent_budget.profit_amount_cents,
            'status': 'draft',
            'created_by': created_by,
            'parent_budget_id': parent_budget_id,
            'change_log': version_data.change_log
        }

        # Create the new budget
        new_budget = Budget(**new_budget_data)

        # Recalculate totals if line items changed
        if version_data.line_items:
            new_budget.calculate_totals()

        db.add(new_budget)
        await db.commit()
        await db.refresh(new_budget)

        return new_budget

    async def approve_budget(
        self,
        db: AsyncSession,
        budget_id: int,
        approved_by: str
    ) -> Budget:
        """
        Approve a budget.
        """
        budget = await self.get(db=db, id=budget_id)
        if not budget:
            raise ValueError("Budget not found")

        if budget.status != 'draft':
            raise ValueError("Only draft budgets can be approved")

        budget.status = 'approved'
        budget.approved_by = approved_by
        budget.approved_at = datetime.utcnow()

        await db.commit()
        await db.refresh(budget)

        return budget

    async def get_budget_versions(
        self,
        db: AsyncSession,
        client_id: int,
        budget_name: Optional[str] = None
    ) -> List[Budget]:
        """
        Get all versions of budgets for a client.
        """
        query = select(Budget).where(Budget.client_id == client_id)

        if budget_name:
            query = query.where(Budget.name.ilike(f"%{budget_name}%"))

        query = query.order_by(Budget.version.desc())

        result = await db.execute(query)
        return result.scalars().all()


class ProposalService(CRUDBase[Proposal, ProposalCreate, ProposalUpdate]):
    """Service for proposal management operations."""

    def __init__(self):
        super().__init__(Proposal)

    async def create_proposal(
        self,
        db: AsyncSession,
        proposal_data: ProposalCreate,
        created_by: str
    ) -> Proposal:
        """
        Create a new proposal with auto-generated proposal number.
        """
        # Generate proposal number (format: PROP-YYYY-NNNN)
        current_year = datetime.utcnow().year
        result = await db.execute(
            select(func.count(Proposal.id)).where(
                func.extract('year', Proposal.created_at) == current_year
            )
        )
        sequence_number = (result.scalar() or 0) + 1
        proposal_number = "04d"

        # Get budget to snapshot the amount
        budget_result = await db.execute(
            select(Budget).where(Budget.id == proposal_data.budget_id)
        )
        budget = budget_result.scalar_one_or_none()
        if not budget:
            raise ValueError("Budget not found")

        # Calculate expiration date
        expires_at = datetime.utcnow() + timedelta(days=proposal_data.validity_days)

        proposal_dict = proposal_data.model_dump()
        proposal_dict.update({
            'proposal_number': proposal_number,
            'proposed_amount_cents': budget.total_cents,
            'created_by': created_by,
            'expires_at': expires_at
        })

        return await super().create(db=db, obj_in=proposal_dict)

    async def send_proposal(
        self,
        db: AsyncSession,
        proposal_id: int,
        sent_by: str
    ) -> Proposal:
        """
        Send a proposal to the client.
        """
        proposal = await self.get(db=db, id=proposal_id)
        if not proposal:
            raise ValueError("Proposal not found")

        if proposal.status != 'draft':
            raise ValueError("Only draft proposals can be sent")

        proposal.status = 'sent'
        proposal.sent_by = sent_by
        proposal.sent_at = datetime.utcnow()

        await db.commit()
        await db.refresh(proposal)

        return proposal

    async def approve_proposal(
        self,
        db: AsyncSession,
        proposal_id: int,
        approved_by: str
    ) -> Proposal:
        """
        Approve a proposal.
        """
        proposal = await self.get(db=db, id=proposal_id)
        if not proposal:
            raise ValueError("Proposal not found")

        if proposal.status != 'sent':
            raise ValueError("Only sent proposals can be approved")

        proposal.status = 'approved'
        proposal.approved_by = approved_by
        proposal.approved_at = datetime.utcnow()

        await db.commit()
        await db.refresh(proposal)

        return proposal

    async def reject_proposal(
        self,
        db: AsyncSession,
        proposal_id: int,
        rejected_by: str,
        reason: str
    ) -> Proposal:
        """
        Reject a proposal.
        """
        proposal = await self.get(db=db, id=proposal_id)
        if not proposal:
            raise ValueError("Proposal not found")

        if proposal.status not in ['sent', 'draft']:
            raise ValueError("Proposal cannot be rejected in its current status")

        proposal.status = 'rejected'
        proposal.rejection_reason = reason
        proposal.rejected_at = datetime.utcnow()

        await db.commit()
        await db.refresh(proposal)

        return proposal

    async def check_expired_proposals(self, db: AsyncSession) -> List[Proposal]:
        """
        Check and update expired proposals.
        Returns the list of proposals that were expired.
        """
        current_time = datetime.utcnow()

        result = await db.execute(
            select(Proposal).where(
                Proposal.status == 'sent',
                Proposal.expires_at < current_time
            )
        )

        expired_proposals = result.scalars().all()

        # Update status to expired
        for proposal in expired_proposals:
            proposal.status = 'expired'

        if expired_proposals:
            await db.commit()

        return expired_proposals


# Service instances
client_service = ClientService()
budget_service = BudgetService()
proposal_service = ProposalService()