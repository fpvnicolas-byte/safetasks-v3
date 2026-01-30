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

    async def create(self, db, *, organization_id, obj_in):
        """Create project with services."""
        # Handle service_ids
        service_ids = obj_in.service_ids
        del obj_in.service_ids
        
        # Create project object manually to handle M2M
        obj_data = obj_in.model_dump()
        db_obj = self.model(**obj_data)
        db_obj.organization_id = organization_id
        
        if service_ids:
            from sqlalchemy import select
            result = await db.execute(select(ServiceModel).where(ServiceModel.id.in_(service_ids)))
            services = result.scalars().all()
            db_obj.services = services

        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    async def update(self, db, *, organization_id, id, obj_in):
        """Update project with services."""
        # Handle service_ids
        if obj_in.service_ids is not None:
             # Fetch services
            from sqlalchemy import select
            result = await db.execute(select(ServiceModel).where(ServiceModel.id.in_(obj_in.service_ids)))
            services = result.scalars().all()
            
            # We need to load existing project to update relationship
            project = await self.get(db=db, organization_id=organization_id, id=id)
            if project:
                project.services = services
                
            del obj_in.service_ids

        return await super().update(db=db, organization_id=organization_id, id=id, obj_in=obj_in)


class ProposalService(BaseService[ProposalModel, ProposalCreate, ProposalUpdate]):
    """Service for Proposal operations with approval/conversion logic."""

    def __init__(self):
        super().__init__(ProposalModel)

    async def get(self, db: AsyncSession, *, organization_id: UUID, id: UUID) -> ProposalModel | None:
        """Get proposal with services loaded."""
        return await super().get(
            db=db, 
            organization_id=organization_id, 
            id=id, 
            options=[selectinload(ProposalModel.services)]
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
        """Get multiple proposals with services loaded."""
        return await super().get_multi(
            db=db, 
            organization_id=organization_id, 
            skip=skip, 
            limit=limit, 
            filters=filters, 
            options=[selectinload(ProposalModel.services)]
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
        # Get the proposal
        proposal = await self.get(db=db, organization_id=organization_id, id=proposal_id)
        if not proposal:
            raise ValueError("Proposal not found")

        if proposal.status != "sent":
            raise ValueError("Only proposals with 'sent' status can be approved")

        # Use transaction context to ensure atomic operations
        async with db.begin():
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
                service_ids=[s.id for s in proposal.services] # Copy services from proposal
            )

            project = await project_service.create(
                db=db,
                organization_id=organization_id,
                obj_in=project_data
            )

            # Link the project back to the proposal
            proposal.project_id = project.id

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

        # Handle service_ids
        service_ids = obj_in.service_ids
        del obj_in.service_ids
        
        # Create proposal object manually to handle M2M
        obj_data = obj_in.model_dump()
        db_obj = self.model(**obj_data)
        db_obj.organization_id = organization_id
        
        if service_ids:
            # Fetch services
            from sqlalchemy import select
            result = await db.execute(select(ServiceModel).where(ServiceModel.id.in_(service_ids)))
            services = result.scalars().all()
            db_obj.services = services

        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    async def update(self, db, *, organization_id, id, obj_in):
        """Update proposal with client validation if client_id is changing."""
        if obj_in.client_id is not None:
            await self._validate_client_ownership(db, organization_id, obj_in.client_id)

        # Handle service_ids
        if obj_in.service_ids is not None:
             # Fetch services
            from sqlalchemy import select
            result = await db.execute(select(ServiceModel).where(ServiceModel.id.in_(obj_in.service_ids)))
            services = result.scalars().all()
            
            # We need to load existing proposal to update relationship
            proposal = await self.get(db=db, organization_id=organization_id, id=id)
            if proposal:
                proposal.services = services
                
            del obj_in.service_ids

        return await super().update(db=db, organization_id=organization_id, id=id, obj_in=obj_in)


# Service instances
organization_service = OrganizationService()
client_service = ClientService()
project_service = ProjectService()
proposal_service = ProposalService()
