from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.deps import get_current_profile
from app.db.session import get_db
from app.models.profiles import Profile
from app.models.bug_reports import BugReport
from app.models.organizations import Organization
from app.schemas.bug_reports import BugReportCreate, BugReportResponse

router = APIRouter()


@router.post("/", response_model=BugReportResponse)
async def create_bug_report(
    *,
    db: AsyncSession = Depends(get_db),
    params: BugReportCreate,
    current_user: Profile = Depends(get_current_profile),
) -> Any:
    if not current_user.organization_id:
        raise HTTPException(status_code=403, detail="User not in organization")

    report = BugReport(
        organization_id=current_user.organization_id,
        reporter_profile_id=current_user.id,
        title=params.title,
        category=params.category,
        description=params.description,
    )
    db.add(report)
    await db.flush()

    organization_name = "Unknown Organization"
    try:
        org = await db.get(Organization, current_user.organization_id)
        if org and org.name:
            organization_name = org.name
    except Exception:
        pass

    try:
        from app.services.notification_triggers import notify_platform_superadmins

        await notify_platform_superadmins(
            db=db,
            source_organization_id=current_user.organization_id,
            title="platform_bug_report_title",
            message="platform_bug_report_message",
            type="warning",
            metadata={
                "bug_report_id": str(report.id),
                "organization_id": str(current_user.organization_id),
                "organization_name": organization_name,
                "reporter_email": current_user.email or "",
                "bug_title": report.title,
                "bug_category": report.category,
            },
        )
    except Exception:
        # Don't block bug-report submission if notification dispatch fails.
        pass

    await db.commit()
    await db.refresh(report)
    return report


@router.get("/", response_model=List[BugReportResponse])
async def list_bug_reports(
    db: AsyncSession = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    current_user: Profile = Depends(get_current_profile),
) -> Any:
    query = (
        select(BugReport)
        .where(BugReport.organization_id == current_user.organization_id)
        .offset(skip)
        .limit(limit)
        .order_by(BugReport.created_at.desc())
    )
    result = await db.execute(query)
    return result.scalars().all()
