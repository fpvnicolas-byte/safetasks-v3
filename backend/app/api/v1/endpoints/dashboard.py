from typing import Dict, Any
from uuid import UUID
from fastapi import APIRouter, Depends, Query

from app.api.deps import get_current_profile, require_admin_producer_or_finance
from app.db.session import get_db
from app.services.analytics import analytics_service
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()


@router.get("/executive", response_model=Dict[str, Any], dependencies=[Depends(require_admin_producer_or_finance)])
async def get_executive_dashboard(
    months_back: int = Query(12, ge=1, le=24, description="Number of months to analyze"),
    profile=Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """
    Get executive dashboard with high-level business metrics.

    This endpoint provides comprehensive business analytics for CEOs and producers,
    including financial performance, production metrics, inventory health, and cloud sync status.

    **Requires admin or manager role.**

    Parameters:
    - `months_back`: Number of months to analyze for trends (1-24 months)

    Returns:
    - Financial metrics (MTD/YTD revenue, expenses, profit)
    - Production metrics (active projects, status breakdown)
    - Inventory metrics (equipment health, maintenance needs)
    - Cloud sync metrics (success rates, storage usage)
    - Trends data and key business insights
    """
    dashboard_data = await analytics_service.get_executive_dashboard(
        organization_id=profile.organization_id,
        db=db,
        months_back=months_back
    )

    return dashboard_data


@router.get("/executive/financial", response_model=Dict[str, Any], dependencies=[Depends(require_admin_producer_or_finance)])
async def get_financial_dashboard(
    profile=Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """
    Get focused financial dashboard metrics.

    Returns current month and year-to-date financial performance.
    """
    # This would call a specific financial analytics method
    # For now, return a subset of the full dashboard
    full_dashboard = await analytics_service.get_executive_dashboard(
        organization_id=profile.organization_id,
        db=db,
        months_back=1
    )

    return full_dashboard["financial"]


@router.get("/executive/production", response_model=Dict[str, Any], dependencies=[Depends(require_admin_producer_or_finance)])
async def get_production_dashboard(
    profile=Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """
    Get focused production dashboard metrics.

    Returns project status, active productions, and efficiency metrics.
    """
    # This would call a specific production analytics method
    # For now, return a subset of the full dashboard
    full_dashboard = await analytics_service.get_executive_dashboard(
        organization_id=profile.organization_id,
        db=db,
        months_back=1
    )

    return full_dashboard["production"]


@router.get("/executive/inventory", response_model=Dict[str, Any], dependencies=[Depends(require_admin_producer_or_finance)])
async def get_inventory_dashboard(
    profile=Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """
    Get focused inventory dashboard metrics.

    Returns equipment health, maintenance status, and utilization rates.
    """
    # This would call a specific inventory analytics method
    # For now, return a subset of the full dashboard
    full_dashboard = await analytics_service.get_executive_dashboard(
        organization_id=profile.organization_id,
        db=db,
        months_back=1
    )

    return full_dashboard["inventory"]


@router.get("/executive/cloud", response_model=Dict[str, Any], dependencies=[Depends(require_admin_producer_or_finance)])
async def get_cloud_dashboard(
    profile=Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """
    Get focused cloud sync dashboard metrics.

    Returns sync success rates, storage usage, and cloud health status.
    """
    # This would call a specific cloud analytics method
    # For now, return a subset of the full dashboard
    full_dashboard = await analytics_service.get_executive_dashboard(
        organization_id=profile.organization_id,
        db=db,
        months_back=1
    )

    return full_dashboard["cloud"]
