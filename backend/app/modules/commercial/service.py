from sqlalchemy import update, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.services.base import BaseService
from app.models.organizations import Organization as OrganizationModel
from app.models.clients import Client as ClientModel
from app.models.projects import Project as ProjectModel
from app.models.proposals import Proposal as ProposalModel
from app.models.services import Service as ServiceModel
from app.schemas.organizations import OrganizationCreate, OrganizationUpdate
from app.schemas.clients import ClientCreate, ClientUpdate
from app.schemas.projects import ProjectCreate, ProjectUpdate
from app.schemas.proposals import ProposalCreate, ProposalUpdate, ProposalApproval
from uuid import UUID


class OrganizationService(BaseService[OrganizationModel, OrganizationCreate, OrganizationUpdate]):
    """Service for Organization operations."""

    def __init__(self):
        super().__init__(OrganizationModel)

    async def get(
        self,
        db: AsyncSession,
        *,
        organization_id: UUID,
        id: UUID,
        options = None
    ) -> OrganizationModel | None:
        """
        Get organization by ID.
        Override BaseService because Organization model has no organization_id column.
        """
        from sqlalchemy import select
        
        # Verify we are requesting the correct organization
        if organization_id != id:
            return None

        query = select(self.model).where(self.model.id == id)

        if options:
            query = query.options(*options)

        result = await db.execute(query)
        return result.scalar_one_or_none()

    async def update(
        self,
        db: AsyncSession,
        *,
        organization_id: UUID,
        id: UUID,
        obj_in: OrganizationUpdate
    ) -> OrganizationModel | None:
        """
        Update organization.
        Override BaseService because Organization model has no organization_id column.
        """
        from sqlalchemy import update
        
        # Verify we are updating the correct organization
        if organization_id != id:
            return None

        obj_data = obj_in.dict(exclude_unset=True)

        query = (
            update(self.model)
            .where(self.model.id == id)
            .values(**obj_data)
        )

        await db.execute(query)
        
        # Return updated object
        return await self.get(db, organization_id=organization_id, id=id)


class ClientService(BaseService[ClientModel, ClientCreate, ClientUpdate]):
    """Service for Client operations."""

    def __init__(self):
        super().__init__(ClientModel)


class ProjectService(BaseService[ProjectModel, ProjectCreate, ProjectUpdate]):
    """Service for Project operations."""

    def __init__(self):
        super().__init__(ProjectModel)

    async def get_with_client(self, *args, **kwargs):
        """
        Get projects with client relationship loaded.
        Note: This bypasses organization filtering - use with caution.
        """
        kwargs["options"] = [selectinload(ProjectModel.client)]
        return await self.get_multi(*args, **kwargs)

    async def get(
        self, 
        db: AsyncSession, 
        *, 
        organization_id: UUID, 
        id: UUID,
        options = None
    ) -> ProjectModel | None:
        """Get project with services loaded."""
        default_options = [selectinload(ProjectModel.services)]
        final_options = default_options + (options or [])

        return await super().get(
            db=db, 
            organization_id=organization_id, 
            id=id, 
            options=final_options
        )

    async def get_multi(
        self, 
        db: AsyncSession, 
        *, 
        organization_id: UUID, 
        skip: int = 0, 
        limit: int = 100, 
        filters=None,
        options=None
    ) -> list[ProjectModel]:
        """Get multiple projects with services loaded."""
        default_options = [selectinload(ProjectModel.services)]
        final_options = default_options + (options or [])

        return await super().get_multi(
            db=db, 
            organization_id=organization_id, 
            skip=skip, 
            limit=limit, 
            filters=filters, 
            options=final_options
        )

    async def create(self, db, *, organization_id, obj_in, commit: bool = True):
        """Create project with services. Auto-adds service values to budget."""
        # Handle service_ids
        service_ids = obj_in.service_ids
        # Handle proposal_id
        proposal_id = getattr(obj_in, "proposal_id", None)
        
        # Remove service_ids and proposal_id from obj_in if they are not in the model
        del obj_in.service_ids
        if hasattr(obj_in, "proposal_id"):
            del obj_in.proposal_id

        # Create project object manually to handle M2M
        obj_data = obj_in.model_dump()
        db_obj = self.model(**obj_data)
        db_obj.organization_id = organization_id

        if service_ids:
            from sqlalchemy import select
            result = await db.execute(select(ServiceModel).where(ServiceModel.id.in_(service_ids)))
            services = result.scalars().all()
            db_obj.services = services
            # Note: We do NOT auto-set budget_total_cents from services.
            # Service values represent client pricing, not operational budget.

        db.add(db_obj)
        
        # Link to proposal if provided
        if proposal_id:
            from sqlalchemy import select
            from app.models.proposals import Proposal as ProposalModel
            result = await db.execute(select(ProposalModel).where(ProposalModel.id == proposal_id, ProposalModel.organization_id == organization_id))
            proposal = result.scalar_one_or_none()
            if proposal:
                # Ensure the project is flushed/committed to have an ID
                await db.flush()
                proposal.project_id = db_obj.id
                proposal.status = "approved"

        if commit:
            await db.commit()
            await db.refresh(db_obj)
        else:
            await db.flush()
            await db.refresh(db_obj)
            
        # Send notification for project creation (started/budget confirmed)
        try:
            from app.services.notification_triggers import notify_project_created
            # Calculate initial budget based on manual entry or services if manually set
            initial_budget = db_obj.budget_total_cents or 0
            
            await notify_project_created(
                db=db,
                organization_id=organization_id,
                project_title=db_obj.title,
                project_id=db_obj.id,
                budget_cents=initial_budget
            )
        except Exception as e:
            print(f"Failed to send project creation notification: {e}")
            
        return db_obj

    async def update(self, db, *, organization_id, id, obj_in):
        """Update project with services. Auto-updates budget when services change."""
        # Check for status change before update
        old_status = None
        project = None
        if obj_in.status is not None:
            project = await self.get(db=db, organization_id=organization_id, id=id)
            if project:
                old_status = project.status

        # Handle service_ids
        if obj_in.service_ids is not None:
            from sqlalchemy import select

            # Get existing project with services if not already fetched
            if not project:
                project = await self.get(db=db, organization_id=organization_id, id=id)
            
            if project:
                # Fetch new services
                result = await db.execute(select(ServiceModel).where(ServiceModel.id.in_(obj_in.service_ids)))
                services = result.scalars().all()

                # Update services relationship (do NOT modify budget)
                project.services = services

            del obj_in.service_ids
            
        updated_project = await super().update(db=db, organization_id=organization_id, id=id, obj_in=obj_in)
        
        # Check for completion status change
        if old_status and updated_project and updated_project.status != old_status:
            if updated_project.status in ["delivered", "completed", "archived"] and old_status not in ["delivered", "completed", "archived"]:
                 try:
                    from app.services.notification_triggers import notify_project_finished
                    await notify_project_finished(
                        db=db,
                        organization_id=organization_id,
                        project_title=updated_project.title,
                        project_id=updated_project.id
                    )
                 except Exception as e:
                    print(f"Failed to send project completion notification: {e}")
                    
        return updated_project


class ProposalService(BaseService[ProposalModel, ProposalCreate, ProposalUpdate]):
    """Service for Proposal operations with approval/conversion logic."""

    def __init__(self):
        super().__init__(ProposalModel)

    @staticmethod
    def _sum_line_items(proposal_metadata: dict | None) -> int:
        if not proposal_metadata:
            return 0
        line_items = proposal_metadata.get("line_items") if isinstance(proposal_metadata, dict) else None
        if not line_items:
            return 0

        total = 0
        for item in line_items:
            if isinstance(item, dict):
                value = item.get("value_cents", 0)
            else:
                value = getattr(item, "value_cents", 0)
            try:
                total += int(value or 0)
            except (TypeError, ValueError):
                continue
        return total

    async def get(self, db: AsyncSession, *, organization_id: UUID, id: UUID) -> ProposalModel | None:
        """Get proposal with services and client loaded."""
        return await super().get(
            db=db, 
            organization_id=organization_id, 
            id=id, 
            options=[
                selectinload(ProposalModel.services),
                selectinload(ProposalModel.client)
            ]
        )

    async def get_multi(
        self, 
        db: AsyncSession, 
        *, 
        organization_id: UUID, 
        skip: int = 0, 
        limit: int = 100, 
        filters=None
    ) -> list[ProposalModel]:
        """Get multiple proposals with services and client loaded."""
        return await super().get_multi(
            db=db, 
            organization_id=organization_id, 
            skip=skip, 
            limit=limit, 
            filters=filters, 
            options=[
                selectinload(ProposalModel.services),
                selectinload(ProposalModel.client)
            ]
        )

    async def approve_proposal(
        self,
        db: AsyncSession,
        *,
        organization_id: UUID,
        proposal_id: UUID,
        approval_data: ProposalApproval
    ) -> ProposalModel:
        """Approve proposal and automatically convert to project."""
        # Use transaction context to ensure atomic operations
        async with db.begin_nested():
            # Get the proposal inside the transaction
            proposal = await self.get(db=db, organization_id=organization_id, id=proposal_id)
            if not proposal:
                raise ValueError("Proposal not found")

            if proposal.status != "sent":
                raise ValueError("Only proposals with 'sent' status can be approved")

            # Update proposal status
            proposal.status = "approved"
            if approval_data.notes:
                # TODO: Store approval notes in proposal metadata if needed
                pass

            # Create new project from proposal
            project_data = ProjectCreate(
                client_id=proposal.client_id,
                title=proposal.title,
                description=proposal.description,
                status="pre-production",  # Default status for new projects
                start_date=proposal.start_date, # Copy dates
                end_date=proposal.end_date,
                service_ids=[s.id for s in proposal.services]  # Copy services from proposal
            )

            project = await project_service.create(
                db=db,
                organization_id=organization_id,
                obj_in=project_data,
                commit=False
            )

            # Link the project back to the proposal
            proposal.project_id = project.id

            # Create invoice from approved proposal when automation is enabled
            from app.core.config import settings
            if settings.FINANCIAL_AUTOMATION_ENABLED:
                from app.services.financial_advanced import invoice_service
                await invoice_service.create_from_proposal(
                    db=db,
                    organization_id=organization_id,
                    proposal=proposal
                )

            # Flush changes to database before notifications
            await db.flush()
            await db.refresh(proposal)

            # Send notifications after successful approval
            await self._send_proposal_approval_notifications(
                db=db,
                organization_id=organization_id,
                proposal=proposal,
                project=project
            )
            # Transaction auto-commits on success, auto-rollbacks on exception

        return proposal

    async def _send_proposal_approval_notifications(
        self,
        db: AsyncSession,
        *,
        organization_id: UUID,
        proposal: ProposalModel,
        project: ProjectModel
    ):
        """Send notifications when a proposal is approved."""
        try:
            from app.services.notifications import notification_service

            # Get all admin and manager users in the organization
            from app.models.profiles import Profile
            from sqlalchemy import select

            query = select(Profile).where(
                Profile.organization_id == organization_id,
                Profile.role.in_(["admin", "manager"])
            )

            result = await db.execute(query)
            admin_manager_profiles = result.scalars().all()

            # Send notification to each admin/manager
            for profile in admin_manager_profiles:
                await notification_service.create_for_user(
                    db=db,
                    organization_id=organization_id,
                    profile_id=profile.id,
                    title="Proposal Approved",
                    message=f"Proposal '{proposal.title}' has been approved and converted to project '{project.title}'.",
                    type="success",
                    metadata={
                        "proposal_id": str(proposal.id),
                        "project_id": str(project.id),
                        "client_id": str(proposal.client_id)
                    }
                )

        except Exception as e:
            # Log but don't fail the approval if notifications fail
            print(f"Failed to send proposal approval notifications: {str(e)}")

    async def _validate_client_ownership(self, db: AsyncSession, organization_id: UUID, client_id: UUID):
        """Validate that client belongs to the organization."""
        client = await client_service.get(db=db, organization_id=organization_id, id=client_id)
        if not client:
            raise ValueError("Client not found or does not belong to your organization")
        return client

    async def create(self, db, *, organization_id, obj_in):
        """Create proposal with client validation."""
        # Validate client ownership
        await self._validate_client_ownership(db, organization_id, obj_in.client_id)

        # Prepare create data explicitly excluding service_ids
        create_data = obj_in.model_dump(exclude={"service_ids"})
        create_data["organization_id"] = organization_id
        
        # Create proposal object manually
        db_obj = self.model(**create_data)
        
        # Handle service_ids
        if obj_in.service_ids:
            from sqlalchemy import select
            result = await db.execute(select(ServiceModel).where(ServiceModel.id.in_(obj_in.service_ids)))
            services = result.scalars().all()
            db_obj.services = services
        else:
            services = []
            
        # Auto-calculate total amount (base_amount_cents is negative for discounts)
        base_amount = obj_in.base_amount_cents or 0
        services_total = sum(s.value_cents for s in services)
        line_items_total = self._sum_line_items(obj_in.proposal_metadata)
        if base_amount < -(services_total + line_items_total):
            raise ValueError("Discount cannot exceed subtotal (services + line items)")
        db_obj.base_amount_cents = base_amount
        db_obj.total_amount_cents = base_amount + services_total + line_items_total

        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        
        # Reload with relationships to avoid MissingGreenlet during Pydantic serialization
        return await self.get(db, organization_id=organization_id, id=db_obj.id)

    async def update(self, db, *, organization_id, id, obj_in):
        """Update proposal with client validation if client_id is changing."""
        if obj_in.client_id is not None:
            await self._validate_client_ownership(db, organization_id, obj_in.client_id)

        # Prepare update data explicitly excluding service_ids
        update_data = obj_in.model_dump(exclude_unset=True, exclude={"service_ids"})
        
        # Handle service_ids relationship update
        # Need to recalculate total if services OR base_amount changes
        should_recalculate = False
        services = []
        proposal = None
        
        if obj_in.service_ids is not None:
             # Fetch new services
            from sqlalchemy import select
            result = await db.execute(select(ServiceModel).where(ServiceModel.id.in_(obj_in.service_ids)))
            services = result.scalars().all()
            should_recalculate = True
            
            # Load existing proposal to update relationship
            proposal = await self.get(db=db, organization_id=organization_id, id=id)
            if proposal:
                proposal.services = services
        
        if obj_in.base_amount_cents is not None:
            should_recalculate = True

        if obj_in.proposal_metadata is not None and isinstance(obj_in.proposal_metadata, dict) and "line_items" in obj_in.proposal_metadata:
            should_recalculate = True
            
        if should_recalculate:
            # If we didn't load services yet (only base_amount changed), we need to fetch them
            if proposal is None:
                proposal = await self.get(db=db, organization_id=organization_id, id=id)

            if obj_in.service_ids is None:
                services = proposal.services if proposal else []
            
            # Use new base amount if provided, otherwise existing
            # Note: We need to be careful with update_data vs db_obj here
            # Since we are doing a manual update query later, we should update update_data
            
            base_amount = obj_in.base_amount_cents if obj_in.base_amount_cents is not None else (
                proposal.base_amount_cents if proposal else 0
            )
            services_total = sum(s.value_cents for s in services)
            if obj_in.proposal_metadata is not None and isinstance(obj_in.proposal_metadata, dict) and "line_items" in obj_in.proposal_metadata:
                line_items_total = self._sum_line_items(obj_in.proposal_metadata)
            else:
                line_items_total = self._sum_line_items(proposal.proposal_metadata if proposal else None)

            if base_amount < -(services_total + line_items_total):
                raise ValueError("Discount cannot exceed subtotal (services + line items)")

            update_data["total_amount_cents"] = base_amount + services_total + line_items_total
        
        # Perform the standard update with filtered data
        # We manually call super implementation logic here to avoid passing invalid columns
        query = (
            update(self.model)
            .where(
                and_(
                    self.model.id == id,
                    self.model.organization_id == organization_id
                )
            )
            .values(**update_data)
        )
        await db.execute(query)
        
        # Return the updated object
        return await self.get(db, organization_id=organization_id, id=id)
        
    async def remove(self, db: AsyncSession, *, organization_id: UUID, id: UUID) -> ProposalModel | None:
        """Delete proposal."""
        # Fetch the proposal fully loaded BEFORE deleting it
        # This is critical because returning a deleted object with unloaded relationships
        # causes serialization errors (MissingGreenlet)
        proposal = await self.get(
            db=db,
            organization_id=organization_id,
            id=id,
            options=[
                selectinload(ProposalModel.services),
                selectinload(ProposalModel.client),
            ],
        )
        if not proposal:
            return None
            
        # Clear relationships first to avoid ForeignKeyViolationError
        proposal.services = []
        await db.flush()

        # Fix: Nullify proposal_id in invoices before deletion to avoid IntegrityError
        # Invoices should remain (historical record) but unlink from the deleted proposal
        from app.models.financial import Invoice
        await db.execute(
            update(Invoice)
            .where(and_(Invoice.organization_id == organization_id, Invoice.proposal_id == id))
            .values(proposal_id=None)
        )
            
        await super().remove(db=db, organization_id=organization_id, id=id)
        
        return proposal


# Service instances
organization_service = OrganizationService()
client_service = ClientService()
project_service = ProjectService()
proposal_service = ProposalService()
