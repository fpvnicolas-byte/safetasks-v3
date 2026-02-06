from __future__ import annotations

from dataclasses import dataclass
from datetime import time
from typing import Any, Optional
from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.inventory import KitItem, KitItemUsageLog
from app.models.projects import Project as ProjectModel
from app.models.scheduling import ShootingDay as ShootingDayModel
from app.models.services import ServiceEquipment as ServiceEquipmentModel


def _time_to_minutes(value: time) -> float:
    return (value.hour * 60) + value.minute + (value.second / 60)


def compute_shooting_day_usage_hours(
    *,
    call_time: time,
    on_set: Optional[time],
    wrap_time: Optional[time],
) -> float:
    """
    Compute equipment usage hours for a shooting day.

    Preference: on_set -> wrap_time; fallback: call_time -> wrap_time.
    If wrap_time is earlier than start time, assumes wrap happened after midnight.
    """
    if not wrap_time:
        return 0.0

    start_time = on_set or call_time
    start_minutes = _time_to_minutes(start_time)
    end_minutes = _time_to_minutes(wrap_time)

    if end_minutes < start_minutes:
        end_minutes += 24 * 60

    minutes = end_minutes - start_minutes
    if minutes <= 0:
        return 0.0

    # Safety clamp to avoid wildly incorrect entries.
    minutes = min(minutes, 24 * 60)
    return minutes / 60


@dataclass(frozen=True)
class ProjectEquipmentUsageResult:
    recorded: bool
    reason: str
    project_hours: float
    shooting_days_used: int
    services_count: int
    kits_count: int
    kit_items_total: int
    kit_items_updated: int


class EquipmentUsageService:
    async def record_usage_when_project_concluded(
        self,
        db: AsyncSession,
        *,
        organization_id: UUID,
        project_id: UUID,
        source: str = "project_delivered",
    ) -> ProjectEquipmentUsageResult:
        """
        Record equipment usage for a concluded project.

        - Calculates hours from shooting days (on_set->wrap, fallback call->wrap)
        - Finds kits linked to the project's services (deduped across services)
        - Applies the computed hours to ALL kit items in those kits
        - Idempotent per (project_id, kit_item_id) via KitItemUsageLog uniqueness
        """
        project_result = await db.execute(
            select(ProjectModel)
            .options(selectinload(ProjectModel.services))
            .where(ProjectModel.id == project_id)
            .where(ProjectModel.organization_id == organization_id)
        )
        project = project_result.scalar_one_or_none()
        if not project:
            raise ValueError("Project not found or does not belong to your organization")

        service_ids = [s.id for s in (project.services or [])]
        if not service_ids:
            return ProjectEquipmentUsageResult(
                recorded=False,
                reason="project_has_no_services",
                project_hours=0.0,
                shooting_days_used=0,
                services_count=0,
                kits_count=0,
                kit_items_total=0,
                kit_items_updated=0,
            )

        # Compute total hours from shooting days.
        sd_result = await db.execute(
            select(ShootingDayModel.call_time, ShootingDayModel.on_set, ShootingDayModel.wrap_time)
            .where(ShootingDayModel.organization_id == organization_id)
            .where(ShootingDayModel.project_id == project_id)
        )
        shooting_days_used = 0
        project_hours = 0.0
        for call_time, on_set, wrap_time in sd_result.all():
            hours = compute_shooting_day_usage_hours(
                call_time=call_time,
                on_set=on_set,
                wrap_time=wrap_time,
            )
            if hours > 0:
                shooting_days_used += 1
                project_hours += hours

        if project_hours <= 0:
            return ProjectEquipmentUsageResult(
                recorded=False,
                reason="no_shooting_days_with_wrap_time",
                project_hours=0.0,
                shooting_days_used=0,
                services_count=len(service_ids),
                kits_count=0,
                kit_items_total=0,
                kit_items_updated=0,
            )

        # Find unique kits linked to ANY service in the project.
        kit_result = await db.execute(
            select(ServiceEquipmentModel.kit_id)
            .where(ServiceEquipmentModel.organization_id == organization_id)
            .where(ServiceEquipmentModel.service_id.in_(service_ids))
        )
        kit_ids = {row.kit_id for row in kit_result.all() if row.kit_id}

        if not kit_ids:
            return ProjectEquipmentUsageResult(
                recorded=False,
                reason="no_kits_linked_to_services",
                project_hours=project_hours,
                shooting_days_used=shooting_days_used,
                services_count=len(service_ids),
                kits_count=0,
                kit_items_total=0,
                kit_items_updated=0,
            )

        # Get all kit items inside those kits.
        kit_items_result = await db.execute(
            select(KitItem.id)
            .where(KitItem.organization_id == organization_id)
            .where(KitItem.kit_id.in_(kit_ids))
        )
        kit_item_ids = [row.id for row in kit_items_result.all() if row.id]
        if not kit_item_ids:
            return ProjectEquipmentUsageResult(
                recorded=False,
                reason="no_items_in_linked_kits",
                project_hours=project_hours,
                shooting_days_used=shooting_days_used,
                services_count=len(service_ids),
                kits_count=len(kit_ids),
                kit_items_total=0,
                kit_items_updated=0,
            )

        # Skip items already recorded for this project (idempotent).
        existing_result = await db.execute(
            select(KitItemUsageLog.kit_item_id)
            .where(KitItemUsageLog.organization_id == organization_id)
            .where(KitItemUsageLog.project_id == project_id)
            .where(KitItemUsageLog.kit_item_id.in_(kit_item_ids))
        )
        existing_item_ids = {row.kit_item_id for row in existing_result.all() if row.kit_item_id}
        new_item_ids = [item_id for item_id in kit_item_ids if item_id not in existing_item_ids]

        if not new_item_ids:
            return ProjectEquipmentUsageResult(
                recorded=False,
                reason="already_recorded",
                project_hours=project_hours,
                shooting_days_used=shooting_days_used,
                services_count=len(service_ids),
                kits_count=len(kit_ids),
                kit_items_total=len(kit_item_ids),
                kit_items_updated=0,
            )

        metadata: dict[str, Any] = {
            "version": "v1",
            "shooting_days_used": shooting_days_used,
            "service_ids": [str(sid) for sid in service_ids],
            "kit_ids": [str(kid) for kid in sorted(kit_ids)],
            "calculation": {
                "start": "on_set_or_call_time",
                "end": "wrap_time",
            },
        }

        try:
            async with db.begin_nested():
                db.add_all(
                    [
                        KitItemUsageLog(
                            organization_id=organization_id,
                            project_id=project_id,
                            kit_item_id=item_id,
                            hours=project_hours,
                            source=source,
                            usage_metadata=metadata,
                        )
                        for item_id in new_item_ids
                    ]
                )

                # Apply the computed hours to all newly-recorded items.
                await db.execute(
                    update(KitItem)
                    .where(KitItem.organization_id == organization_id)
                    .where(KitItem.id.in_(new_item_ids))
                    .values(
                        current_usage_hours=func.coalesce(KitItem.current_usage_hours, 0) + project_hours,
                        updated_at=func.now(),
                    )
                )

                # Force DB write inside the nested transaction so errors don't break project updates later.
                await db.flush()
        except IntegrityError:
            return ProjectEquipmentUsageResult(
                recorded=False,
                reason="already_recorded",
                project_hours=project_hours,
                shooting_days_used=shooting_days_used,
                services_count=len(service_ids),
                kits_count=len(kit_ids),
                kit_items_total=len(kit_item_ids),
                kit_items_updated=0,
            )

        return ProjectEquipmentUsageResult(
            recorded=True,
            reason="recorded",
            project_hours=project_hours,
            shooting_days_used=shooting_days_used,
            services_count=len(service_ids),
            kits_count=len(kit_ids),
            kit_items_total=len(kit_item_ids),
            kit_items_updated=len(new_item_ids),
        )


equipment_usage_service = EquipmentUsageService()
