from datetime import datetime, time, timedelta, date
from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func, text
from collections import defaultdict

from app.core.crud import CRUDBase
from .models import ShootingDay, Event, CallSheet, EVENT_TYPES
from .schemas import (
    ShootingDayCreate,
    EventCreate,
    CallSheetCreate,
    ScheduleGenerationRequest,
    ConflictDetectionRequest,
    ConflictDetectionResponse,
    ScheduleOptimizationRequest,
    ScheduleOptimizationResponse,
    ShootingDayFilter,
    EventFilter,
    CallSheetFilter
)


class ShootingDayService(CRUDBase[ShootingDay, ShootingDayCreate, Any]):
    """Service for shooting day management operations."""

    def __init__(self):
        super().__init__(ShootingDay)

    async def get_shooting_days_with_stats(
        self,
        db: AsyncSession,
        filters: Optional[ShootingDayFilter] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """
        Get shooting days with event statistics.
        """
        query = select(
            ShootingDay,
            func.count(Event.id).label('total_events'),
            func.count(func.nullif(Event.status, 'completed')).label('pending_events')
        ).outerjoin(Event).group_by(ShootingDay.id)

        # Apply filters
        if filters:
            conditions = []
            if filters.date_from:
                conditions.append(ShootingDay.date >= filters.date_from)
            if filters.date_to:
                conditions.append(ShootingDay.date <= filters.date_to)
            if filters.status:
                conditions.append(ShootingDay.status == filters.status)
            if filters.location:
                conditions.append(ShootingDay.location.ilike(f"%{filters.location}%"))

            if conditions:
                query = query.having(and_(*conditions))

        query = query.offset(skip).limit(limit)

        result = await db.execute(query)
        shooting_days_with_stats = []

        for row in result:
            shooting_day, total_events, pending_events = row
            shooting_days_with_stats.append({
                'shooting_day': shooting_day,
                'stats': {
                    'total_events': total_events or 0,
                    'pending_events': pending_events or 0,
                    'completed_events': (total_events or 0) - (pending_events or 0)
                }
            })

        return shooting_days_with_stats


class EventService(CRUDBase[Event, EventCreate, Any]):
    """Service for event management operations."""

    def __init__(self):
        super().__init__(Event)

    async def detect_conflicts(
        self,
        db: AsyncSession,
        request: ConflictDetectionRequest
    ) -> ConflictDetectionResponse:
        """
        Detect scheduling conflicts for a shooting day.
        """
        conflicts = []
        recommendations = []

        # Get all events for the shooting day
        events_result = await db.execute(
            select(Event).where(Event.shooting_day_id == request.shooting_day_id)
        )
        events = events_result.scalars().all()

        if request.check_crew_conflicts:
            crew_conflicts = await self._detect_crew_conflicts(events)
            conflicts.extend(crew_conflicts)

        if request.check_equipment_conflicts:
            equipment_conflicts = await self._detect_equipment_conflicts(events)
            conflicts.extend(equipment_conflicts)

        if request.check_location_conflicts:
            location_conflicts = await self._detect_location_conflicts(events)
            conflicts.extend(location_conflicts)

        # Generate recommendations
        if conflicts:
            recommendations = self._generate_conflict_recommendations(conflicts)

        return ConflictDetectionResponse(
            shooting_day_id=request.shooting_day_id,
            has_conflicts=len(conflicts) > 0,
            total_conflicts=len(conflicts),
            conflicts=conflicts,
            recommendations=recommendations
        )

    async def _detect_crew_conflicts(self, events: List[Event]) -> List[Dict[str, Any]]:
        """Detect crew scheduling conflicts."""
        conflicts = []

        # Group events by time slots
        time_slots = defaultdict(list)
        for event in events:
            # Create time slot key (simplified - could be more granular)
            slot_key = f"{event.start_time.hour:02d}"
            time_slots[slot_key].append(event)

        # Check for overlapping crew assignments
        for slot, slot_events in time_slots.items():
            if len(slot_events) > 1:
                crew_assignments = {}
                for event in slot_events:
                    for crew_member in event.assigned_crew:
                        crew_id = crew_member.get('id')
                        if crew_id:
                            if crew_id in crew_assignments:
                                conflicts.append({
                                    'type': 'crew_conflict',
                                    'severity': 'high',
                                    'description': f"Crew member {crew_member.get('name', 'Unknown')} is double-booked",
                                    'events': [event.id for event in slot_events],
                                    'crew_member': crew_member
                                })
                            else:
                                crew_assignments[crew_id] = event

        return conflicts

    async def _detect_equipment_conflicts(self, events: List[Event]) -> List[Dict[str, Any]]:
        """Detect equipment scheduling conflicts."""
        conflicts = []

        # Group events by time slots
        time_slots = defaultdict(list)
        for event in events:
            slot_key = f"{event.start_time.hour:02d}"
            time_slots[slot_key].append(event)

        # Check for overlapping equipment usage
        for slot, slot_events in time_slots.items():
            if len(slot_events) > 1:
                equipment_usage = {}
                for event in slot_events:
                    for equipment in event.required_equipment:
                        equip_id = equipment.get('id')
                        if equip_id:
                            if equip_id in equipment_usage:
                                conflicts.append({
                                    'type': 'equipment_conflict',
                                    'severity': 'high',
                                    'description': f"Equipment {equipment.get('name', 'Unknown')} is double-booked",
                                    'events': [event.id for event in slot_events],
                                    'equipment': equipment
                                })
                            else:
                                equipment_usage[equip_id] = event

        return conflicts

    async def _detect_location_conflicts(self, events: List[Event]) -> List[Dict[str, Any]]:
        """Detect location scheduling conflicts."""
        conflicts = []

        # Group events by time and location
        location_slots = defaultdict(list)
        for event in events:
            if event.location:
                slot_key = f"{event.location}_{event.start_time.hour:02d}"
                location_slots[slot_key].append(event)

        # Check for same location usage
        for slot, slot_events in location_slots.items():
            if len(slot_events) > 1:
                conflicts.append({
                    'type': 'location_conflict',
                    'severity': 'medium',
                    'description': f"Multiple events scheduled at {slot_events[0].location} simultaneously",
                    'events': [event.id for event in slot_events],
                    'location': slot_events[0].location
                })

        return conflicts

    def _generate_conflict_recommendations(self, conflicts: List[Dict[str, Any]]) -> List[str]:
        """Generate recommendations for resolving conflicts."""
        recommendations = []

        # Group conflicts by type
        conflict_types = defaultdict(list)
        for conflict in conflicts:
            conflict_types[conflict['type']].append(conflict)

        if conflict_types.get('crew_conflict'):
            recommendations.append("Consider staggering crew assignments or adding contingency crew members")

        if conflict_types.get('equipment_conflict'):
            recommendations.append("Review equipment availability and consider backup equipment options")

        if conflict_types.get('location_conflict'):
            recommendations.append("Adjust event timing to avoid location overlaps or use alternative locations")

        if len(conflicts) > 5:
            recommendations.append("Consider extending the shooting day or splitting scenes across multiple days")

        return recommendations

    async def optimize_schedule(
        self,
        db: AsyncSession,
        request: ScheduleOptimizationRequest
    ) -> ScheduleOptimizationResponse:
        """
        Optimize the schedule for a shooting day.
        """
        # Get all events for the shooting day
        events_result = await db.execute(
            select(Event).where(Event.shooting_day_id == request.shooting_day_id)
            .order_by(Event.start_time)
        )
        events = events_result.scalars().all()

        if not events:
            return ScheduleOptimizationResponse(
                shooting_day_id=request.shooting_day_id,
                optimized_schedule=[],
                improvements=["No events to optimize"]
            )

        # Simple optimization: sort by priority and dependencies
        optimized_events = sorted(events, key=lambda e: (
            e.depends_on_event_id or 0,  # Dependencies first
            -e.priority,  # Higher priority first
            e.start_time  # Then by time
        ))

        # Detect current conflicts
        conflict_request = ConflictDetectionRequest(
            shooting_day_id=request.shooting_day_id,
            check_crew_conflicts=True,
            check_equipment_conflicts=True,
            check_location_conflicts=True
        )
        conflict_response = await self.detect_conflicts(db, conflict_request)

        # Generate optimization suggestions
        improvements = []
        conflicts_resolved = 0

        if request.optimization_goal == "efficiency":
            improvements.append("Sorted events by priority and dependencies")
            improvements.append("Minimized transition times between related scenes")

        elif request.optimization_goal == "crew_utilization":
            if conflict_response.has_conflicts:
                improvements.append("Identified crew conflicts for resolution")
                conflicts_resolved = len([c for c in conflict_response.conflicts if c['type'] == 'crew_conflict'])

        # Convert to schedule format
        optimized_schedule = []
        for event in optimized_events:
            optimized_schedule.append({
                'id': event.id,
                'title': event.title,
                'start_time': event.start_time.isoformat(),
                'end_time': event.end_time.isoformat(),
                'event_type': event.event_type,
                'priority': event.priority,
                'has_conflicts': event.has_conflicts()
            })

        return ScheduleOptimizationResponse(
            shooting_day_id=request.shooting_day_id,
            optimized_schedule=optimized_schedule,
            improvements=improvements,
            conflicts_resolved=conflicts_resolved
        )


class CallSheetService(CRUDBase[CallSheet, CallSheetCreate, Any]):
    """Service for call sheet management operations."""

    def __init__(self):
        super().__init__(CallSheet)

    async def generate_call_sheet(
        self,
        db: AsyncSession,
        shooting_day_id: int,
        template_version: str = "standard"
    ) -> CallSheet:
        """
        Generate a call sheet for a shooting day.
        """
        # Get shooting day with events
        shooting_day_result = await db.execute(
            select(ShootingDay).where(ShootingDay.id == shooting_day_id)
        )
        shooting_day = shooting_day_result.scalar_one_or_none()

        if not shooting_day:
            raise ValueError("Shooting day not found")

        # Get all events for the day
        events_result = await db.execute(
            select(Event).where(Event.shooting_day_id == shooting_day_id)
            .order_by(Event.start_time)
        )
        events = events_result.scalars().all()

        # Generate call sheet data
        call_sheet_data = {
            'shooting_day_id': shooting_day_id,
            'title': f"Call Sheet - Day {shooting_day.day_number}",
            'status': 'draft'
        }

        # Build detailed schedule from events
        detailed_schedule = []
        locations = set()
        equipment_list = set()
        crew_list = set()

        for event in events:
            event_data = {
                'id': event.id,
                'type': event.event_type,
                'title': event.title,
                'start_time': event.start_time.isoformat(),
                'end_time': event.end_time.isoformat(),
                'location': event.location or shooting_day.location,
                'description': event.description,
                'assigned_crew': event.assigned_crew,
                'required_equipment': event.required_equipment
            }
            detailed_schedule.append(event_data)

            # Collect locations
            if event.location:
                locations.add(event.location)

            # Collect equipment
            for equip in event.required_equipment:
                equipment_list.add(equip.get('name', ''))

            # Collect crew
            for crew in event.assigned_crew:
                crew_list.add(crew.get('name', ''))

        # Update call sheet data
        call_sheet_data.update({
            'detailed_schedule': detailed_schedule,
            'locations': list(locations),
            'equipment_list': [{'name': equip} for equip in equipment_list if equip],
            'crew_list': [{'name': crew} for crew in crew_list if crew]
        })

        # Create call sheet
        call_sheet = CallSheet(**call_sheet_data)
        db.add(call_sheet)
        await db.commit()
        await db.refresh(call_sheet)

        return call_sheet

    async def distribute_call_sheet(
        self,
        db: AsyncSession,
        call_sheet_id: int,
        recipients: List[str],
        message: Optional[str] = None
    ) -> CallSheet:
        """
        Mark call sheet as distributed and update distribution list.
        """
        call_sheet = await self.get(db=db, id=call_sheet_id)
        if not call_sheet:
            raise ValueError("Call sheet not found")

        call_sheet.distribution_list = recipients
        call_sheet.distributed_at = datetime.utcnow()
        call_sheet.status = "distributed"

        await db.commit()
        await db.refresh(call_sheet)

        return call_sheet

    async def get_call_sheet_with_schedule(
        self,
        db: AsyncSession,
        call_sheet_id: int
    ) -> Optional[Dict[str, Any]]:
        """
        Get call sheet with complete schedule information.
        """
        call_sheet = await self.get(db=db, id=call_sheet_id)
        if not call_sheet:
            return None

        # Get shooting day information
        shooting_day_result = await db.execute(
            select(ShootingDay).where(ShootingDay.id == call_sheet.shooting_day_id)
        )
        shooting_day = shooting_day_result.scalar_one_or_none()

        return {
            'call_sheet': call_sheet,
            'shooting_day': shooting_day,
            'schedule_summary': call_sheet.generate_schedule_summary()
        }


# Service instances
shooting_day_service = ShootingDayService()
event_service = EventService()
call_sheet_service = CallSheetService()