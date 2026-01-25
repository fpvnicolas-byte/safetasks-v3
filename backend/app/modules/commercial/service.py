from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.services.base import BaseService
from app.models.organizations import Organization as OrganizationModel
from app.models.clients import Client as ClientModel
from app.models.projects import Project as ProjectModel
from app.models.proposals import Proposal as ProposalModel
from app.schemas.organizations import OrganizationCreate, OrganizationUpdate
from app.schemas.clients import ClientCreate, ClientUpdate
from app.schemas.projects import ProjectCreate, ProjectUpdate
from app.schemas.proposals import ProposalCreate, ProposalUpdate, ProposalApproval
from uuid import UUID


class OrganizationService(BaseService[OrganizationModel, OrganizationCreate, OrganizationUpdate]):
    """Service for Organization operations."""

    def __init__(self):
        super().__init__(OrganizationModel)


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


class ProposalService(BaseService[ProposalModel, ProposalCreate, ProposalUpdate]):
    """Service for Proposal operations with approval/conversion logic."""

    def __init__(self):
        super().__init__(ProposalModel)

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
                status="pre-production"  # Default status for new projects
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

        return await super().create(db=db, organization_id=organization_id, obj_in=obj_in)

    async def update(self, db, *, organization_id, id, obj_in):
        """Update proposal with client validation if client_id is changing."""
        if obj_in.client_id is not None:
            await self._validate_client_ownership(db, organization_id, obj_in.client_id)

        return await super().update(db=db, organization_id=organization_id, id=id, obj_in=obj_in)


# Service instances
organization_service = OrganizationService()
client_service = ClientService()
project_service = ProjectService()
proposal_service = ProposalService()
