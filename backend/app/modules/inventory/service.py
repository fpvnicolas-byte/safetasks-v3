from app.services.base import BaseService
from app.models.kits import Kit
from app.schemas.kits import KitCreate, KitUpdate


class KitService(BaseService[Kit, KitCreate, KitUpdate]):
    """Service for Kit (equipment collection) operations."""

    def __init__(self):
        super().__init__(Kit)

    async def remove(self, db, *, organization_id, id):
        """Override remove to handle equipment relationships."""
        # Note: In a full implementation, this would handle equipment relationships
        # For now, keeping it simple - just ensure no hard deletion of equipment
        kit = await self.get(db=db, organization_id=organization_id, id=id)
        if not kit:
            return None

        # Here you could implement soft delete or set equipment to null
        # For now, we'll just delete the kit
        return await super().remove(db=db, organization_id=organization_id, id=id)


# Service instance
kit_service = KitService()
