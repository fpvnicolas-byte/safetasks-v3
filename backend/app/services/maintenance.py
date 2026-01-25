from app.services.base import BaseService
from app.models.inventory import KitItem, MaintenanceLog
from app.models.transactions import Transaction
from app.schemas.inventory import (
    KitItemCreate, KitItemUpdate,
    MaintenanceLogCreate,
    KitItemMaintenanceHistory, InventoryHealthReport
)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, text
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime, date, timedelta
import asyncio


class KitItemService(BaseService[KitItem, KitItemCreate, KitItemUpdate]):
    """Service for Kit Item operations."""

    def __init__(self):
        super().__init__(KitItem)

    async def _validate_kit_ownership(self, db: AsyncSession, organization_id: UUID, kit_id: UUID):
        """Validate that kit belongs to the organization."""
        from app.modules.inventory.service import kit_service
        kit = await kit_service.get(db=db, organization_id=organization_id, id=kit_id)
        if not kit:
            raise ValueError("Kit not found or does not belong to your organization")
        return kit

    async def create(self, db, *, organization_id, obj_in):
        """Create kit item with kit validation."""
        await self._validate_kit_ownership(db, organization_id, obj_in.kit_id)
        return await super().create(db=db, organization_id=organization_id, obj_in=obj_in)

    async def update(self, db, *, organization_id, id, obj_in):
        """Update kit item with kit validation."""
        if hasattr(obj_in, 'kit_id') and obj_in.kit_id is not None:
            await self._validate_kit_ownership(db, organization_id, obj_in.kit_id)

        return await super().update(db=db, organization_id=organization_id, id=id, obj_in=obj_in)

    async def get_with_maintenance_info(
        self,
        db: AsyncSession,
        *,
        organization_id: UUID,
        kit_item_id: UUID
    ) -> Optional[Dict[str, Any]]:
        """Get kit item with maintenance summary information."""
        # Get the kit item
        kit_item = await self.get(db=db, organization_id=organization_id, id=kit_item_id)
        if not kit_item:
            return None

        # Get maintenance summary
        maintenance_query = select(
            func.count(MaintenanceLog.id).label('maintenance_count'),
            func.max(MaintenanceLog.date).label('last_maintenance_date'),
            func.max(MaintenanceLog.maintenance_type).label('last_maintenance_type'),
            func.sum(MaintenanceLog.cost_cents).label('total_maintenance_cost')
        ).where(
            and_(
                MaintenanceLog.organization_id == organization_id,
                MaintenanceLog.kit_item_id == kit_item_id
            )
        )

        maintenance_result = await db.execute(maintenance_query)
        maintenance_row = maintenance_result.first()

        # Calculate days since last maintenance
        days_since_maintenance = None
        maintenance_overdue = False

        if maintenance_row.last_maintenance_date:
            days_since_maintenance = (date.today() - maintenance_row.last_maintenance_date).days
            maintenance_overdue = days_since_maintenance > (kit_item.maintenance_interval_hours * 24 / 8)  # Rough estimate

        return {
            "id": kit_item.id,
            "organization_id": kit_item.organization_id,
            "kit_id": kit_item.kit_id,
            "name": kit_item.name,
            "description": kit_item.description,
            "category": kit_item.category,
            "serial_number": kit_item.serial_number,
            "purchase_date": kit_item.purchase_date,
            "purchase_cost_cents": kit_item.purchase_cost_cents,
            "warranty_expiry": kit_item.warranty_expiry,
            "maintenance_interval_hours": kit_item.maintenance_interval_hours,
            "max_usage_hours": kit_item.max_usage_hours,
            "notes": kit_item.notes,
            "health_status": kit_item.health_status,
            "current_usage_hours": kit_item.current_usage_hours,
            "last_maintenance_date": kit_item.last_maintenance_date,
            "created_at": kit_item.created_at,
            "updated_at": kit_item.updated_at,
            "maintenance_count": maintenance_row.maintenance_count or 0,
            "last_maintenance_type": maintenance_row.last_maintenance_type,
            "days_since_last_maintenance": days_since_maintenance,
            "maintenance_overdue": maintenance_overdue,
            "total_maintenance_cost_cents": maintenance_row.total_maintenance_cost or 0
        }


class MaintenanceService(BaseService[MaintenanceLog, MaintenanceLogCreate, None]):
    """Service for Maintenance operations with automatic financial linking."""

    def __init__(self):
        super().__init__(MaintenanceLog)

    async def _validate_kit_item_ownership(self, db: AsyncSession, organization_id: UUID, kit_item_id: UUID):
        """Validate that kit item belongs to the organization."""
        kit_item_service = KitItemService()
        kit_item = await kit_item_service.get(db=db, organization_id=organization_id, id=kit_item_id)
        if not kit_item:
            raise ValueError("Kit item not found or does not belong to your organization")
        return kit_item

    async def create_maintenance_log(
        self,
        db: AsyncSession,
        *,
        organization_id: UUID,
        kit_item_id: UUID,
        maintenance_data: MaintenanceLogCreate
    ) -> MaintenanceLog:
        """
        Create a maintenance log with automatic financial transaction creation.
        """
        # Validate kit item ownership
        kit_item = await self._validate_kit_item_ownership(db, organization_id, kit_item_id)

        transaction_id = None

        # If maintenance has a cost, create a financial transaction
        if maintenance_data.cost_cents > 0:
            # Create maintenance expense transaction
            from app.services.financial import transaction_service
            from app.schemas.transactions import TransactionCreate

            # Find a bank account (use the first available)
            from app.services.financial import bank_account_service
            bank_accounts = await bank_account_service.get_multi(
                db=db, organization_id=organization_id, limit=1
            )

            if not bank_accounts:
                raise ValueError("No bank account available for maintenance expense")

            bank_account_id = bank_accounts[0].id

            transaction_data = TransactionCreate(
                bank_account_id=bank_account_id,
                category="maintenance",
                type="expense",
                amount_cents=maintenance_data.cost_cents,
                description=f"Maintenance: {maintenance_data.description} - {kit_item.name}",
                transaction_date=maintenance_data.date
            )

            transaction = await transaction_service.create(
                db=db, organization_id=organization_id, obj_in=transaction_data
            )
            transaction_id = transaction.id

        # Create maintenance log
        maintenance_log_data = maintenance_data.dict()
        maintenance_log_data["transaction_id"] = transaction_id

        db_maintenance_log = MaintenanceLog(
            organization_id=organization_id,
            kit_item_id=kit_item_id,
            **maintenance_log_data
        )
        db.add(db_maintenance_log)

        # Update kit item status and usage
        kit_item.health_status = maintenance_data.health_after or kit_item.health_status
        kit_item.last_maintenance_date = maintenance_data.date

        # Reset usage hours if specified
        if maintenance_data.usage_hours_reset > 0:
            kit_item.current_usage_hours = maintenance_data.usage_hours_reset

        await db.commit()
        await db.refresh(db_maintenance_log)

        return db_maintenance_log

    async def get_maintenance_history(
        self,
        db: AsyncSession,
        *,
        organization_id: UUID,
        kit_item_id: UUID
    ) -> KitItemMaintenanceHistory:
        """
        Get complete maintenance history for a kit item.
        """
        # Get kit item details
        kit_item_service = KitItemService()
        kit_item_info = await kit_item_service.get_with_maintenance_info(
            db=db, organization_id=organization_id, kit_item_id=kit_item_id
        )

        if not kit_item_info:
            raise ValueError("Kit item not found")

        # Get all maintenance logs
        maintenance_query = select(MaintenanceLog).where(
            and_(
                MaintenanceLog.organization_id == organization_id,
                MaintenanceLog.kit_item_id == kit_item_id
            )
        ).order_by(MaintenanceLog.date.desc())

        maintenance_result = await db.execute(maintenance_query)
        maintenance_logs = maintenance_result.scalars().all()

        # Calculate total maintenance cost
        total_cost = sum(log.cost_cents for log in maintenance_logs)

        return KitItemMaintenanceHistory(
            kit_item_id=kit_item_id,
            kit_item_name=kit_item_info["name"],
            kit_item_category=kit_item_info["category"],
            total_maintenance_cost_cents=total_cost,
            maintenance_count=len(maintenance_logs),
            last_maintenance_date=kit_item_info["last_maintenance_date"],
            health_status=kit_item_info["health_status"],
            maintenance_logs=[log for log in maintenance_logs]  # Convert to list
        )


class InventoryHealthService:
    """Service for monitoring inventory health and generating alerts."""

    def __init__(self):
        self.kit_item_service = KitItemService()

    async def calculate_health_score(self, kit_item: KitItem) -> float:
        """
        Calculate a health score for a kit item (0-100).
        Higher scores indicate better health.
        """
        score = 100.0

        # Health status penalties
        health_penalties = {
            "excellent": 0,
            "good": -10,
            "needs_service": -30,
            "broken": -80,
            "retired": -100
        }
        score += health_penalties.get(kit_item.health_status, 0)

        # Usage-based penalties
        if kit_item.max_usage_hours > 0:
            usage_ratio = kit_item.current_usage_hours / kit_item.max_usage_hours
            if usage_ratio > 0.9:
                score -= 20  # Near end of life
            elif usage_ratio > 0.8:
                score -= 10  # Getting close

        # Maintenance overdue penalties
        if kit_item.last_maintenance_date:
            days_since_maintenance = (date.today() - kit_item.last_maintenance_date).days
            expected_interval_days = (kit_item.maintenance_interval_hours * 24) / 8  # Rough work day estimate

            if days_since_maintenance > expected_interval_days * 1.5:
                score -= 15  # Overdue for maintenance

        # Warranty status
        if kit_item.warranty_expiry and kit_item.warranty_expiry < date.today():
            score -= 10  # Warranty expired

        return max(0, min(100, score))  # Clamp between 0-100

    async def generate_health_report(
        self,
        db: AsyncSession,
        *,
        organization_id: UUID
    ) -> InventoryHealthReport:
        """
        Generate a comprehensive inventory health report.
        """
        # Get all kit items for the organization
        kit_items_query = select(KitItem).where(KitItem.organization_id == organization_id)
        kit_items_result = await db.execute(kit_items_query)
        kit_items = kit_items_result.scalars().all()

        total_items = len(kit_items)

        # Categorize by health status
        items_by_health = {}
        items_needing_maintenance = []
        items_over_usage_limit = []

        for item in kit_items:
            # Count by health status
            health_status = item.health_status
            items_by_health[health_status] = items_by_health.get(health_status, 0) + 1

            # Check maintenance needs
            days_since_maintenance = None
            if item.last_maintenance_date:
                days_since_maintenance = (date.today() - item.last_maintenance_date).days

            maintenance_interval_days = (item.maintenance_interval_hours * 24) / 8  # Rough estimate

            if (not item.last_maintenance_date or
                days_since_maintenance > maintenance_interval_days * 1.2):  # 20% grace period
                items_needing_maintenance.append({
                    "id": str(item.id),
                    "name": item.name,
                    "category": item.category,
                    "days_since_last_maintenance": days_since_maintenance,
                    "health_status": item.health_status
                })

            # Check usage limits
            if item.max_usage_hours > 0 and item.current_usage_hours > item.max_usage_hours * 0.95:
                items_over_usage_limit.append({
                    "id": str(item.id),
                    "name": item.name,
                    "category": item.category,
                    "current_usage_hours": item.current_usage_hours,
                    "max_usage_hours": item.max_usage_hours,
                    "usage_percentage": (item.current_usage_hours / item.max_usage_hours) * 100
                })

        return InventoryHealthReport(
            organization_id=organization_id,
            total_items=total_items,
            items_by_health=items_by_health,
            items_needing_maintenance=items_needing_maintenance,
            items_over_usage_limit=items_over_usage_limit,
            generated_at=datetime.now()
        )

    async def check_and_send_alerts(
        self,
        db: AsyncSession,
        *,
        organization_id: UUID
    ) -> Dict[str, int]:
        """
        Check for maintenance issues and send alerts to admins.
        Returns count of alerts sent.
        """
        from app.services.notifications import notification_service

        # Get health report
        health_report = await self.generate_health_report(
            db=db, organization_id=organization_id
        )

        alerts_sent = 0

        # Send alerts for items needing maintenance
        for item in health_report.items_needing_maintenance[:5]:  # Limit to 5 alerts
            await notification_service.create_for_user(
                db=db,
                organization_id=organization_id,
                profile_id=None,  # Will be sent to all admins
                title="⚠️ Gear Maintenance Alert",
                message=f"{item['name']} ({item['category']}) needs preventive maintenance. Last serviced {item['days_since_last_maintenance']} days ago.",
                type="warning",
                metadata={
                    "kit_item_id": item["id"],
                    "alert_type": "maintenance_overdue",
                    "days_overdue": item["days_since_last_maintenance"]
                }
            )
            alerts_sent += 1

        # Send alerts for items over usage limit
        for item in health_report.items_over_usage_limit[:3]:  # Limit to 3 alerts
            await notification_service.create_for_user(
                db=db,
                organization_id=organization_id,
                profile_id=None,  # Will be sent to all admins
                message=f"{item['name']} has exceeded {item['usage_percentage']:.1f}% of its expected lifespan ({item['current_usage_hours']:.0f}/{item['max_usage_hours']:.0f} hours).",
                type="error",
                metadata={
                    "kit_item_id": item["id"],
                    "alert_type": "usage_limit_exceeded",
                    "usage_percentage": item["usage_percentage"]
                }
            )
            alerts_sent += 1

        return {
            "maintenance_alerts": len(health_report.items_needing_maintenance),
            "usage_alerts": len(health_report.items_over_usage_limit),
            "alerts_sent": alerts_sent
        }


# Service instances
kit_item_service = KitItemService()
maintenance_service = MaintenanceService()
inventory_health_service = InventoryHealthService()
