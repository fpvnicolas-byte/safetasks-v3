from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, desc, update
from collections import defaultdict

from app.core.crud import CRUDBase
from .models import Equipment, Kit, KitItem, MaintenanceLog, EQUIPMENT_CATEGORIES
from .schemas import (
    EquipmentCreate,
    EquipmentUpdate,
    KitCreate,
    KitUpdate,
    KitItemCreate,
    MaintenanceLogCreate,
    EquipmentFilter,
    KitFilter,
    MaintenanceLogFilter,
    EquipmentAssignmentRequest,
    KitAssemblyRequest,
    MaintenanceScheduleRequest,
    EquipmentBulkUpdateRequest
)


class EquipmentService(CRUDBase[Equipment, EquipmentCreate, EquipmentUpdate]):
    """Service for equipment management operations."""

    def __init__(self):
        super().__init__(Equipment)

    async def assign_equipment(
        self,
        db: AsyncSession,
        request: EquipmentAssignmentRequest,
        assigned_by: str
    ) -> Equipment:
        """
        Assign equipment to a user/project with usage tracking.
        """
        equipment = await self.get(db=db, id=request.equipment_id)
        if not equipment:
            raise ValueError("Equipment not found")

        if equipment.status != "available":
            raise ValueError(f"Equipment is not available (status: {equipment.status})")

        # Update assignment
        equipment.assigned_to_user = request.assigned_to_user
        equipment.assigned_to_project = request.assigned_to_project
        equipment.current_location = request.location or equipment.current_location
        equipment.status = "in_use"
        equipment.updated_by = assigned_by

        # Track usage
        if request.usage_hours > 0:
            equipment.update_usage(request.usage_hours)

        await db.commit()
        await db.refresh(equipment)

        return equipment

    async def return_equipment(
        self,
        db: AsyncSession,
        equipment_id: int,
        returned_by: str,
        location: Optional[str] = None,
        usage_hours: float = 0
    ) -> Equipment:
        """
        Return equipment to available status.
        """
        equipment = await self.get(db=db, id=equipment_id)
        if not equipment:
            raise ValueError("Equipment not found")

        # Clear assignments
        equipment.assigned_to_user = None
        equipment.assigned_to_project = None
        equipment.current_location = location or equipment.current_location
        equipment.status = "available"
        equipment.updated_by = returned_by

        # Track usage
        if usage_hours > 0:
            equipment.update_usage(usage_hours)

        await db.commit()
        await db.refresh(equipment)

        return equipment

    async def check_availability(
        self,
        db: AsyncSession,
        equipment_ids: List[int],
        date_from: Optional[date] = None,
        date_to: Optional[date] = None
    ) -> Dict[int, bool]:
        """
        Check availability of multiple equipment items for a date range.
        """
        availability = {}

        for equipment_id in equipment_ids:
            equipment = await self.get(db=db, id=equipment_id)
            if not equipment:
                availability[equipment_id] = False
                continue

            # For now, simple check - equipment is available if status is "available"
            # In a more complex system, this would check against bookings/schedules
            availability[equipment_id] = equipment.status == "available"

        return availability

    async def bulk_update_equipment(
        self,
        db: AsyncSession,
        request: EquipmentBulkUpdateRequest,
        updated_by: str
    ) -> Dict[str, int]:
        """
        Bulk update multiple equipment items.
        """
        updated_count = 0

        for equipment_id in request.equipment_ids:
            equipment = await self.get(db=db, id=equipment_id)
            if equipment:
                # Apply updates
                for field, value in request.updates.items():
                    if hasattr(equipment, field):
                        setattr(equipment, field, value)

                equipment.updated_by = updated_by
                updated_count += 1

        if updated_count > 0:
            await db.commit()

        return {
            'requested': len(request.equipment_ids),
            'updated': updated_count,
            'failed': len(request.equipment_ids) - updated_count
        }

    async def get_due_maintenance(
        self,
        db: AsyncSession,
        include_overdue: bool = True
    ) -> List[Equipment]:
        """
        Get equipment due or overdue for maintenance.
        """
        today = date.today()

        # Get equipment with maintenance schedules
        result = await db.execute(
            select(Equipment).where(
                and_(
                    Equipment.next_maintenance_date.isnot(None),
                    Equipment.status.in_(["available", "in_use"])
                )
            )
        )

        equipment_list = result.scalars().all()

        if include_overdue:
            # Return all equipment with maintenance dates
            return [eq for eq in equipment_list if eq.is_due_for_maintenance() or eq.is_overdue_for_maintenance()]
        else:
            # Return only equipment due (not overdue)
            return [eq for eq in equipment_list if eq.is_due_for_maintenance() and not eq.is_overdue_for_maintenance()]

    async def calculate_depreciation(
        self,
        db: AsyncSession,
        equipment_ids: Optional[List[int]] = None
    ) -> Dict[str, int]:
        """
        Recalculate depreciation for equipment.
        """
        query = select(Equipment)
        if equipment_ids:
            query = query.where(Equipment.id.in_(equipment_ids))

        result = await db.execute(query)
        equipment_list = result.scalars().all()

        updated_count = 0
        for equipment in equipment_list:
            old_value = equipment.current_value_cents
            equipment.calculate_current_value()

            if equipment.current_value_cents != old_value:
                updated_count += 1

        if updated_count > 0:
            await db.commit()

        return {'processed': len(equipment_list), 'updated': updated_count}

    async def generate_inventory_report(
        self,
        db: AsyncSession
    ) -> Dict[str, Any]:
        """
        Generate comprehensive inventory report.
        """
        # Get all equipment
        result = await db.execute(select(Equipment))
        all_equipment = result.scalars().all()

        # Calculate statistics
        total_equipment = len(all_equipment)

        # Category breakdown
        categories = defaultdict(int)
        statuses = defaultdict(int)
        conditions = defaultdict(int)
        total_value = 0
        depreciated_value = 0
        maintenance_due = 0
        maintenance_overdue = 0

        for equipment in all_equipment:
            categories[equipment.category] += 1
            statuses[equipment.status] += 1
            conditions[equipment.condition] += 1

            if equipment.purchase_price_cents:
                total_value += equipment.purchase_price_cents
            if equipment.current_value_cents:
                depreciated_value += equipment.current_value_cents

            if equipment.is_due_for_maintenance():
                maintenance_due += 1
            if equipment.is_overdue_for_maintenance():
                maintenance_overdue += 1

        return {
            'total_equipment': total_equipment,
            'by_category': dict(categories),
            'by_status': dict(statuses),
            'by_condition': dict(conditions),
            'total_value': Decimal(total_value) / 100,
            'depreciated_value': Decimal(depreciated_value) / 100,
            'maintenance_due': maintenance_due,
            'maintenance_overdue': maintenance_overdue,
            'generated_at': datetime.utcnow()
        }


class KitService(CRUDBase[Kit, KitCreate, KitUpdate]):
    """Service for kit management operations."""

    def __init__(self):
        super().__init__(Kit)

    async def create_kit_with_items(
        self,
        db: AsyncSession,
        kit_data: KitCreate,
        created_by: str
    ) -> Kit:
        """
        Create a kit with equipment items.
        """
        # Create kit first
        kit_dict = kit_data.model_dump()
        equipment_ids = kit_dict.pop('equipment_ids', [])

        kit = Kit(**kit_dict)
        kit.created_by = created_by
        kit.updated_by = created_by

        db.add(kit)
        await db.flush()  # Get kit ID

        # Add equipment items
        for equipment_id in equipment_ids:
            kit_item = KitItem(
                kit_id=kit.id,
                equipment_id=equipment_id,
                quantity=1,
                is_required=True
            )
            db.add(kit_item)

        # Calculate replacement value
        await self._calculate_kit_value(db, kit)

        await db.commit()
        await db.refresh(kit)

        return kit

    async def assemble_kit(
        self,
        db: AsyncSession,
        request: KitAssemblyRequest,
        assembled_by: str
    ) -> Dict[str, Any]:
        """
        Assemble a kit by adding/removing equipment items.
        """
        kit = await self.get(db=db, id=request.kit_id)
        if not kit:
            raise ValueError("Kit not found")

        # Get current kit items
        result = await db.execute(
            select(KitItem).where(KitItem.kit_id == request.kit_id)
        )
        current_items = {item.equipment_id: item for item in result.scalars().all()}

        # Add new items
        added_count = 0
        for equipment_id in request.equipment_ids:
            if equipment_id not in current_items:
                role = request.roles.get(equipment_id) if request.roles else None
                kit_item = KitItem(
                    kit_id=request.kit_id,
                    equipment_id=equipment_id,
                    quantity=1,
                    role_in_kit=role,
                    is_required=True
                )
                db.add(kit_item)
                added_count += 1

        # Update kit metadata
        kit.updated_by = assembled_by
        await self._calculate_kit_value(db, kit)
        kit.update_availability_status()

        await db.commit()
        await db.refresh(kit)

        return {
            'kit_id': request.kit_id,
            'items_added': added_count,
            'total_items': len(request.equipment_ids),
            'availability_status': kit.availability_status
        }

    async def check_kit_availability(
        self,
        db: AsyncSession,
        kit_id: int
    ) -> Dict[str, Any]:
        """
        Check if a kit is available for use.
        """
        kit = await self.get(db=db, id=kit_id)
        if not kit:
            raise ValueError("Kit not found")

        # Get kit items
        result = await db.execute(
            select(KitItem).where(KitItem.kit_id == kit_id)
        )
        kit_items = result.scalars().all()

        if not kit_items:
            return {
                'kit_id': kit_id,
                'available': False,
                'reason': 'Kit has no items',
                'available_items': 0,
                'total_items': 0,
                'required_available': 0
            }

        # Check availability of each item
        available_items = 0
        required_available = 0
        total_items = len(kit_items)

        for item in kit_items:
            if item.equipment.status == "available":
                available_items += 1
                if item.is_required:
                    required_available += 1

        # Kit is available if all required items are available
        required_items = sum(1 for item in kit_items if item.is_required)
        available = required_available >= required_items

        return {
            'kit_id': kit_id,
            'available': available,
            'available_items': available_items,
            'total_items': total_items,
            'required_items': required_items,
            'required_available': required_available
        }

    async def optimize_kit(
        self,
        db: AsyncSession,
        kit_id: int,
        optimization_criteria: str = "cost"
    ) -> Dict[str, Any]:
        """
        Optimize kit composition based on criteria.
        """
        kit = await self.get(db=db, id=kit_id)
        if not kit:
            raise ValueError("Kit not found")

        # Get kit items with equipment details
        result = await db.execute(
            select(KitItem, Equipment)
            .join(Equipment)
            .where(KitItem.kit_id == kit_id)
        )

        items_with_equipment = result.all()

        if optimization_criteria == "cost":
            # Sort by equipment value (prefer lower cost items)
            optimized_items = sorted(
                items_with_equipment,
                key=lambda x: x[1].current_value_cents or 0
            )
        elif optimization_criteria == "usage":
            # Sort by equipment usage (prefer frequently used items)
            optimized_items = sorted(
                items_with_equipment,
                key=lambda x: x[1].usage_count or 0,
                reverse=True
            )
        else:
            # Default: sort by condition
            condition_priority = {"excellent": 0, "good": 1, "fair": 2, "poor": 3, "damaged": 4}
            optimized_items = sorted(
                items_with_equipment,
                key=lambda x: condition_priority.get(x[1].condition, 99)
            )

        # This is a basic optimization - in production, this would be more sophisticated
        return {
            'kit_id': kit_id,
            'optimization_criteria': optimization_criteria,
            'recommended_order': [item[0].equipment_id for item in optimized_items],
            'total_value': sum(item[1].current_value_cents or 0 for item in optimized_items),
            'average_condition': None  # Would calculate this
        }

    async def _calculate_kit_value(self, db: AsyncSession, kit: Kit):
        """
        Calculate the total replacement value of all kit items.
        """
        result = await db.execute(
            select(func.sum(Equipment.current_value_cents))
            .select_from(KitItem)
            .join(Equipment)
            .where(KitItem.kit_id == kit.id)
        )

        total_value = result.scalar() or 0
        kit.replacement_value_cents = total_value


class KitItemService(CRUDBase[KitItem, KitItemCreate, Any]):
    """Service for kit item management operations."""

    def __init__(self):
        super().__init__(KitItem)

    async def get_kit_with_items(
        self,
        db: AsyncSession,
        kit_id: int
    ) -> Optional[Dict[str, Any]]:
        """
        Get kit with all its items and equipment details.
        """
        # Get kit
        kit_result = await db.execute(select(Kit).where(Kit.id == kit_id))
        kit = kit_result.scalar_one_or_none()

        if not kit:
            return None

        # Get kit items with equipment
        result = await db.execute(
            select(KitItem, Equipment)
            .join(Equipment, KitItem.equipment_id == Equipment.id)
            .where(KitItem.kit_id == kit_id)
        )

        items = []
        for kit_item, equipment in result:
            items.append({
                'kit_item': kit_item,
                'equipment': equipment,
                'is_available': equipment.status == "available"
            })

        return {
            'kit': kit,
            'items': items,
            'total_items': len(items),
            'available_items': sum(1 for item in items if item['is_available']),
            'required_items_available': sum(
                1 for item in items
                if item['is_available'] and item['kit_item'].is_required
            )
        }


class MaintenanceService(CRUDBase[MaintenanceLog, MaintenanceLogCreate, Any]):
    """Service for maintenance management operations."""

    def __init__(self):
        super().__init__(MaintenanceLog)

    async def schedule_maintenance(
        self,
        db: AsyncSession,
        request: MaintenanceScheduleRequest,
        scheduled_by: str
    ) -> List[MaintenanceLog]:
        """
        Schedule maintenance for multiple equipment items.
        """
        maintenance_logs = []

        for equipment_id in request.equipment_ids:
            # Check if equipment exists
            result = await db.execute(select(Equipment).where(Equipment.id == equipment_id))
            equipment = result.scalar_one_or_none()

            if not equipment:
                continue

            # Create maintenance log
            maintenance_data = {
                'equipment_id': equipment_id,
                'maintenance_type': request.maintenance_type,
                'title': f"{request.maintenance_type.title()} - {equipment.name}",
                'description': f"Scheduled {request.maintenance_type} maintenance",
                'scheduled_date': request.scheduled_date,
                'priority': request.priority,
                'estimated_duration_hours': request.estimated_duration_hours,
                'created_by': scheduled_by
            }

            maintenance_log = MaintenanceLog(**maintenance_data)
            db.add(maintenance_log)
            maintenance_logs.append(maintenance_log)

            # Update equipment next maintenance date
            equipment.next_maintenance_date = request.scheduled_date
            equipment.updated_by = scheduled_by

        if maintenance_logs:
            await db.commit()

            # Refresh all maintenance logs
            for log in maintenance_logs:
                await db.refresh(log)

        return maintenance_logs

    async def complete_maintenance(
        self,
        db: AsyncSession,
        maintenance_id: int,
        completion_data: Dict[str, Any],
        completed_by: str
    ) -> MaintenanceLog:
        """
        Mark maintenance as completed with results.
        """
        maintenance = await self.get(db=db, id=maintenance_id)
        if not maintenance:
            raise ValueError("Maintenance log not found")

        if maintenance.status == "completed":
            raise ValueError("Maintenance is already completed")

        # Update maintenance log
        maintenance.status = "completed"
        maintenance.completed_date = completion_data.get('completed_date', date.today())
        maintenance.actual_duration_hours = completion_data.get('actual_hours')
        maintenance.findings = completion_data.get('findings')
        maintenance.recommendations = completion_data.get('recommendations')
        maintenance.quality_rating = completion_data.get('quality_rating')
        maintenance.equipment_condition_after = completion_data.get('condition_after')
        maintenance.performed_by_internal = completed_by

        # Update costs
        if 'labor_cost' in completion_data:
            maintenance.labor_cost_cents = int(float(completion_data['labor_cost']) * 100)
        if 'parts_cost' in completion_data:
            maintenance.parts_cost_cents = int(float(completion_data['parts_cost']) * 100)

        maintenance.calculate_total_cost()

        # Update equipment
        equipment = await db.get(Equipment, maintenance.equipment_id)
        if equipment:
            equipment.last_maintenance_date = maintenance.completed_date
            equipment.condition = maintenance.equipment_condition_after or equipment.condition
            equipment.status = "available"  # Return to available after maintenance
            equipment.updated_by = completed_by

            # Schedule next maintenance if recommended
            if maintenance.next_maintenance_date:
                equipment.next_maintenance_date = maintenance.next_maintenance_date

        await db.commit()
        await db.refresh(maintenance)

        return maintenance

    async def get_overdue_maintenance(
        self,
        db: AsyncSession
    ) -> List[MaintenanceLog]:
        """
        Get all overdue maintenance logs.
        """
        result = await db.execute(
            select(MaintenanceLog).where(
                and_(
                    MaintenanceLog.status != "completed",
                    MaintenanceLog.scheduled_date < date.today()
                )
            ).order_by(MaintenanceLog.scheduled_date)
        )

        return result.scalars().all()

    async def get_upcoming_maintenance(
        self,
        db: AsyncSession,
        days_ahead: int = 30
    ) -> List[MaintenanceLog]:
        """
        Get maintenance scheduled within the next N days.
        """
        future_date = date.today() + timedelta(days=days_ahead)

        result = await db.execute(
            select(MaintenanceLog).where(
                and_(
                    MaintenanceLog.status != "completed",
                    MaintenanceLog.scheduled_date <= future_date,
                    MaintenanceLog.scheduled_date >= date.today()
                )
            ).order_by(MaintenanceLog.scheduled_date)
        )

        return result.scalars().all()

    async def generate_maintenance_report(
        self,
        db: AsyncSession,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """
        Generate maintenance activity report.
        """
        query = select(MaintenanceLog)

        if start_date:
            query = query.where(MaintenanceLog.created_at >= start_date)
        if end_date:
            query = query.where(MaintenanceLog.created_at <= end_date)

        result = await db.execute(query)
        maintenance_logs = result.scalars().all()

        # Calculate statistics
        total_logs = len(maintenance_logs)

        by_type = defaultdict(int)
        by_status = defaultdict(int)
        total_cost = 0
        completed_count = 0

        for log in maintenance_logs:
            by_type[log.maintenance_type] += 1
            by_status[log.status] += 1
            total_cost += log.total_cost_cents or 0

            if log.status == "completed":
                completed_count += 1

        overdue = await self.get_overdue_maintenance(db)
        upcoming = await self.get_upcoming_maintenance(db)

        return {
            'total_maintenance_logs': total_logs,
            'completed_maintenance': completed_count,
            'by_type': dict(by_type),
            'by_status': dict(by_status),
            'total_cost': Decimal(total_cost) / 100,
            'average_cost_per_equipment': Decimal(total_cost) / 100 / max(total_logs, 1),
            'overdue_maintenance': len(overdue),
            'upcoming_maintenance': len(upcoming),
            'generated_at': datetime.utcnow()
        }


# Service instances
equipment_service = EquipmentService()
kit_service = KitService()
kit_item_service = KitItemService()
maintenance_service = MaintenanceService()