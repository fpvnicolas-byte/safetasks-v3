from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID

from app.api.deps import require_platform_admin
from app.db.session import get_db
from app.models.profiles import Profile
from app.models.bug_reports import BugReport
from app.schemas.bug_reports import BugReportResponse, PlatformBugReportUpdate

router = APIRouter()


@router.get("/", response_model=List[BugReportResponse])
async def list_all_bug_reports(
    db: AsyncSession = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    current_user: Profile = Depends(require_platform_admin),
) -> Any:
    query = select(BugReport).order_by(BugReport.created_at.desc())

    if status:
        query = query.where(BugReport.status == status)

    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{id}", response_model=BugReportResponse)
async def get_bug_report_detail(
    id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Profile = Depends(require_platform_admin),
) -> Any:
    query = select(BugReport).where(BugReport.id == id)
    result = await db.execute(query)
    report = result.scalar_one_or_none()

    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    return report


@router.patch("/{id}", response_model=BugReportResponse)
async def update_bug_report(
    id: UUID,
    update: PlatformBugReportUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Profile = Depends(require_platform_admin),
) -> Any:
    query = select(BugReport).where(BugReport.id == id)
    result = await db.execute(query)
    report = result.scalar_one_or_none()

    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    if update.status is not None:
        report.status = update.status
    if update.admin_notes is not None:
        report.admin_notes = update.admin_notes

    await db.commit()
    await db.refresh(report)
    return report
