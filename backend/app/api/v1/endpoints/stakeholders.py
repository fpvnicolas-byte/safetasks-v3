from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_organization
from app.db.session import get_db
from app.services.commercial import stakeholder_service
from app.schemas.commercial import StakeholderSummary

router = APIRouter()


@router.get("/summary")
async def get_stakeholder_summary(
    organization_id: UUID = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
) -> StakeholderSummary:
    """
    Get a unified summary of all stakeholders in the organization.
    Includes clients (who pay), suppliers (who we pay), and crew (who work).
    """
    try:
        summary = await stakeholder_service.get_stakeholder_summary(
            db=db,
            organization_id=organization_id
        )
        return summary
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate stakeholder summary: {str(e)}"
        )
