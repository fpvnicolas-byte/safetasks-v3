from app.services.base import BaseService
from app.models.call_sheets import CallSheet
from app.schemas.call_sheets import CallSheetCreate, CallSheetUpdate


class CallSheetService(BaseService[CallSheet, CallSheetCreate, CallSheetUpdate]):
    """Service for Call Sheet operations."""

    def __init__(self):
        super().__init__(CallSheet)

    async def _validate_project_ownership(self, db, organization_id, project_id):
        """Validate that project belongs to the organization."""
        from app.modules.commercial.service import project_service
        project = await project_service.get(db=db, organization_id=organization_id, id=project_id)
        if not project:
            raise ValueError("Project not found or does not belong to your organization")
        return project

    async def create(self, db, *, organization_id, obj_in):
        """Create call sheet with project validation."""
        # Validate project ownership
        await self._validate_project_ownership(db, organization_id, obj_in.project_id)

        return await super().create(db=db, organization_id=organization_id, obj_in=obj_in)

    async def update(self, db, *, organization_id, id, obj_in):
        """Update call sheet with project validation if project_id is changing."""
        if obj_in.project_id is not None:
            await self._validate_project_ownership(db, organization_id, obj_in.project_id)

        return await super().update(db=db, organization_id=organization_id, id=id, obj_in=obj_in)


# Service instance
call_sheet_service = CallSheetService()
