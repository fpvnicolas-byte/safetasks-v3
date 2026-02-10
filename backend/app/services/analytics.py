import asyncio
import contextvars
import logging
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Dict, Any, Optional
from uuid import UUID
from zoneinfo import ZoneInfo

from cachetools import TTLCache
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, case

from app.core.config import settings
from app.models.projects import Project
from app.models.transactions import Transaction
from app.models.inventory import KitItem
logger = logging.getLogger(__name__)

# Default timezone - can be made configurable per organization
DEFAULT_TIMEZONE = ZoneInfo("America/Sao_Paulo")

# Dashboard cache (in-process). Used only by AnalyticsService.get_executive_dashboard.
_dashboard_cache_hit: contextvars.ContextVar = contextvars.ContextVar("dashboard_cache_hit", default=None)


def get_dashboard_cache_status() -> Optional[str]:
    """Return 'HIT'/'MISS' for the current request context when caching is used."""
    hit = _dashboard_cache_hit.get()
    if hit is None:
        return None
    return "HIT" if hit else "MISS"


ACTIVE_PROJECT_STATUSES = {"draft", "pre-production", "production", "post-production"}


class AnalyticsService:
    """
    Executive dashboard analytics service.
    Provides high-level business metrics for CEO/Producer decision making.
    """

    def __init__(self):
        ttl = int(getattr(settings, "DASHBOARD_CACHE_TTL_SECONDS", 0) or 0)
        maxsize = int(getattr(settings, "DASHBOARD_CACHE_MAXSIZE", 0) or 0)
        if ttl > 0 and maxsize > 0:
            self._dashboard_cache = TTLCache(maxsize=maxsize, ttl=ttl)
        else:
            self._dashboard_cache = None

        # Per-key lock to avoid thundering herds on cache misses.
        self._dashboard_locks: dict[tuple[UUID, int], asyncio.Lock] = {}

    async def get_executive_dashboard(
        self,
        organization_id: UUID,
        db: AsyncSession,
        months_back: int = 12
    ) -> Dict[str, Any]:
        """
        Generate comprehensive executive dashboard data.

        Args:
            organization_id: Organization ID
            db: Database session
            months_back: Number of months to analyze (default: 12)

        Returns:
            Executive dashboard data
        """
        cache = self._dashboard_cache
        ttl = int(getattr(settings, "DASHBOARD_CACHE_TTL_SECONDS", 0) or 0)
        months_back = int(months_back)

        if cache is None or ttl <= 0:
            _dashboard_cache_hit.set(None)
            return await self._compute_executive_dashboard(organization_id, db, months_back=months_back)

        cache_key = (organization_id, months_back)
        cached = cache.get(cache_key)
        if cached is not None:
            _dashboard_cache_hit.set(True)
            return cached

        lock = self._dashboard_locks.get(cache_key)
        if lock is None:
            lock = asyncio.Lock()
            self._dashboard_locks[cache_key] = lock

        async with lock:
            cached = cache.get(cache_key)
            if cached is not None:
                _dashboard_cache_hit.set(True)
                return cached

            data = await self._compute_executive_dashboard(organization_id, db, months_back=months_back)
            cache[cache_key] = data
            _dashboard_cache_hit.set(False)
            return data

    async def _compute_executive_dashboard(
        self,
        organization_id: UUID,
        db: AsyncSession,
        months_back: int = 12,
    ) -> Dict[str, Any]:
        # Calculate date range using timezone-aware datetime
        end_date = datetime.now(DEFAULT_TIMEZONE)
        start_date = end_date - timedelta(days=30 * months_back)

        dashboard_data = {
            "organization_id": str(organization_id),
            "generated_at": end_date.isoformat(),
            "period": {
                "start_date": start_date.date().isoformat(),
                "end_date": end_date.date().isoformat(),
                "months_analyzed": months_back
            },
            "financial": await self._get_financial_metrics(organization_id, start_date, end_date, db),
            "production": await self._get_production_metrics(organization_id, db),
            "inventory": await self._get_inventory_metrics(organization_id, db),
            "cloud": await self._get_cloud_metrics(organization_id, db),
            "trends": await self._get_trends_data(organization_id, start_date, end_date, db)
        }

        return dashboard_data

    async def _get_financial_metrics(
        self,
        organization_id: UUID,
        start_date: datetime,
        end_date: datetime,
        db: AsyncSession
    ) -> Dict[str, Any]:
        """Calculate financial metrics for the dashboard."""

        now = datetime.now(DEFAULT_TIMEZONE)
        today = now.date()
        month_start = today.replace(day=1)
        year_start = today.replace(month=1, day=1)
        tomorrow = today + timedelta(days=1)

        # One index-friendly query: filter on date range and compute MTD/YTD via CASE.
        query = select(
            func.sum(
                case(
                    (and_(Transaction.type == "income", Transaction.transaction_date >= month_start), Transaction.amount_cents),
                    else_=0,
                )
            ).label("revenue_mtd_cents"),
            func.sum(
                case(
                    (and_(Transaction.type == "expense", Transaction.transaction_date >= month_start), Transaction.amount_cents),
                    else_=0,
                )
            ).label("expenses_mtd_cents"),
            func.sum(
                case(
                    (Transaction.type == "income", Transaction.amount_cents),
                    else_=0,
                )
            ).label("revenue_ytd_cents"),
            func.sum(
                case(
                    (Transaction.type == "expense", Transaction.amount_cents),
                    else_=0,
                )
            ).label("expenses_ytd_cents"),
        ).where(
            and_(
                Transaction.organization_id == organization_id,
                Transaction.payment_status.in_(("approved", "paid")),
                Transaction.category != "internal_transfer",
                Transaction.transaction_date >= year_start,
                Transaction.transaction_date < tomorrow,
            )
        )

        result = await db.execute(query)
        row = result.first()

        revenue_mtd = (row.revenue_mtd_cents or 0) if row else 0
        expenses_mtd = (row.expenses_mtd_cents or 0) if row else 0
        net_profit_mtd = revenue_mtd - expenses_mtd

        revenue_ytd = (row.revenue_ytd_cents or 0) if row else 0
        expenses_ytd = (row.expenses_ytd_cents or 0) if row else 0
        net_profit_ytd = revenue_ytd - expenses_ytd

        # Cash flow projection (simple - can be enhanced with more complex logic)
        cash_flow_projection = revenue_ytd - expenses_ytd

        return {
            "month_to_date": {
                "revenue_cents": revenue_mtd,
                "revenue_brl": revenue_mtd / 100,
                "expenses_cents": expenses_mtd,
                "expenses_brl": expenses_mtd / 100,
                "net_profit_cents": net_profit_mtd,
                "net_profit_brl": net_profit_mtd / 100,
                "profit_margin": (net_profit_mtd / revenue_mtd * 100) if revenue_mtd > 0 else 0
            },
            "year_to_date": {
                "revenue_cents": revenue_ytd,
                "revenue_brl": revenue_ytd / 100,
                "expenses_cents": expenses_ytd,
                "expenses_brl": expenses_ytd / 100,
                "net_profit_cents": net_profit_ytd,
                "net_profit_brl": net_profit_ytd / 100,
                "profit_margin": (net_profit_ytd / revenue_ytd * 100) if revenue_ytd > 0 else 0
            },
            "cash_flow_projection_cents": cash_flow_projection,
            "cash_flow_projection_brl": cash_flow_projection / 100
        }

    async def _get_production_metrics(self, organization_id: UUID, db: AsyncSession) -> Dict[str, Any]:
        """Calculate production metrics for the dashboard."""

        # Single grouped query for status breakdown.
        status_query = (
            select(Project.status, func.count(Project.id).label("count"))
            .where(Project.organization_id == organization_id)
            .group_by(Project.status)
        )

        status_result = await db.execute(status_query)
        projects_by_status = {row.status: row.count for row in status_result}

        total_projects_count = sum(projects_by_status.values()) if projects_by_status else 0
        active_projects_count = sum(
            count for status, count in projects_by_status.items() if status in ACTIVE_PROJECT_STATUSES
        )

        # Pending shooting days for the week (next 7 days)
        # This would need to be implemented based on your shooting day scheduling
        # For now, return a placeholder
        pending_shooting_days = 0

        # Production efficiency metrics
        avg_project_duration_days = 45  # Placeholder - could be calculated from actual data

        return {
            "active_projects": active_projects_count,
            "total_projects": total_projects_count,
            "projects_by_status": projects_by_status,
            "pending_shooting_days_this_week": pending_shooting_days,
            "production_efficiency": {
                "avg_project_duration_days": avg_project_duration_days,
                "on_time_delivery_rate": 85.0  # Placeholder percentage
            }
        }

    async def _get_inventory_metrics(self, organization_id: UUID, db: AsyncSession) -> Dict[str, Any]:
        """Calculate inventory health metrics for the dashboard."""

        health_query = (
            select(
                KitItem.health_status,
                func.count(KitItem.id).label("count"),
                func.sum(KitItem.current_usage_hours).label("usage_hours"),
            )
            .where(KitItem.organization_id == organization_id)
            .group_by(KitItem.health_status)
        )

        health_result = await db.execute(health_query)
        rows = health_result.all()

        total_items = sum((row.count or 0) for row in rows) if rows else 0
        items_by_health = {row.health_status: row.count for row in rows}

        # Items needing service (health status indicates problems)
        critical_items = items_by_health.get("broken", 0) + items_by_health.get("needs_service", 0)

        # Equipment utilization rate
        total_usage_hours = sum((row.usage_hours or 0) for row in rows) if rows else 0

        # Calculate utilization rate (simplified - could be time-based)
        utilization_rate = min(100.0, (total_usage_hours / max(total_items * 100, 1)) * 100)

        # Maintenance costs (from transactions with maintenance category)
        maintenance_cost_query = select(func.sum(Transaction.amount_cents)).where(
            and_(
                Transaction.organization_id == organization_id,
                Transaction.category == "maintenance",
                Transaction.type == "expense",
                Transaction.payment_status.in_(("approved", "paid")),
            )
        )

        maintenance_cost_result = await db.execute(maintenance_cost_query)
        maintenance_cost_cents = maintenance_cost_result.scalar() or 0

        return {
            "total_items": total_items,
            "items_by_health": items_by_health,
            "items_needing_service": critical_items,
            "maintenance_overdue": critical_items,
            "equipment_utilization_rate": utilization_rate,
            "maintenance_cost_cents": maintenance_cost_cents,
            "maintenance_cost_brl": maintenance_cost_cents / 100,
            "inventory_health_score": self._calculate_inventory_health_score(items_by_health, total_items)
        }

    async def _get_cloud_metrics(self, organization_id: UUID, db: AsyncSession) -> Dict[str, Any]:
        """Calculate cloud sync metrics for the dashboard."""

        # TODO: Re-implement with CloudFileReference after Task 3 migration
        total_syncs = 0
        successful_syncs = 0
        failed_syncs = 0
        recent_syncs = 0
        sync_success_rate = 0.0

        # Storage used (simplified - would need actual file size tracking)
        storage_used_gb = 0.0

        return {
            "total_sync_operations": total_syncs,
            "successful_syncs": successful_syncs,
            "failed_syncs": failed_syncs,
            "sync_success_rate": sync_success_rate,
            "estimated_storage_used_gb": storage_used_gb,
            "recent_sync_activity_30_days": recent_syncs,
            "cloud_health_status": "healthy" if sync_success_rate >= 95 else "warning" if sync_success_rate >= 80 else "critical"
        }

    async def _get_trends_data(
        self,
        organization_id: UUID,
        start_date: datetime,
        end_date: datetime,
        db: AsyncSession
    ) -> Dict[str, Any]:
        """Calculate trends data for charts and visualizations."""

        monthly_trends: list[dict[str, Any]] = []

        start_d = start_date.date() if isinstance(start_date, datetime) else start_date
        end_d = end_date.date() if isinstance(end_date, datetime) else end_date

        month_bucket = func.date_trunc("month", Transaction.transaction_date).label("month")
        query = (
            select(
                month_bucket,
                func.sum(case((Transaction.type == "income", Transaction.amount_cents), else_=0)).label("revenue_cents"),
                func.sum(case((Transaction.type == "expense", Transaction.amount_cents), else_=0)).label("expenses_cents"),
            )
            .where(
                and_(
                    Transaction.organization_id == organization_id,
                    Transaction.payment_status.in_(("approved", "paid")),
                    Transaction.category != "internal_transfer",
                    Transaction.transaction_date >= start_d,
                    Transaction.transaction_date <= end_d,
                )
            )
            .group_by(month_bucket)
            .order_by(month_bucket)
        )

        result = await db.execute(query)
        for row in result.all():
            month_dt = row.month
            month_str = month_dt.strftime("%Y-%m") if hasattr(month_dt, "strftime") else str(month_dt)
            revenue_cents = row.revenue_cents or 0
            expenses_cents = row.expenses_cents or 0
            monthly_trends.append(
                {
                    "month": month_str,
                    "revenue_cents": revenue_cents,
                    "expenses_cents": expenses_cents,
                    "net_profit_cents": revenue_cents - expenses_cents,
                }
            )

        return {
            "monthly_financial_trends": monthly_trends,
            "key_insights": self._generate_key_insights(monthly_trends)
        }

    def _calculate_inventory_health_score(self, items_by_health: Dict[str, int], total_items: int) -> float:
        """Calculate overall inventory health score (0-100)."""
        if total_items == 0:
            return 100.0

        # Weight health statuses
        health_weights = {
            "excellent": 100,
            "good": 75,
            "needs_service": 50,
            "broken": 25,
            "retired": 0
        }

        total_score = 0
        for status, count in items_by_health.items():
            weight = health_weights.get(status, 50)
            total_score += weight * count

        return total_score / total_items

    def _generate_key_insights(self, monthly_trends: list) -> list:
        """Generate key business insights from trends data."""
        insights = []

        if len(monthly_trends) >= 2:
            # Revenue growth
            latest_revenue = monthly_trends[-1]["revenue_cents"]
            previous_revenue = monthly_trends[-2]["revenue_cents"]

            if previous_revenue > 0:
                revenue_growth = ((latest_revenue - previous_revenue) / previous_revenue) * 100
                if revenue_growth > 10:
                    insights.append("Revenue growth accelerating - consider scaling production")
                elif revenue_growth < -10:
                    insights.append("Revenue decline detected - review pricing and marketing strategies")

            # Profitability trend
            latest_profit = monthly_trends[-1]["net_profit_cents"]
            if latest_profit < 0:
                insights.append("Negative profit margin this month - review cost controls")
            elif latest_profit > latest_revenue * Decimal("0.3"):  # 30% profit margin
                insights.append("Strong profitability - excellent financial health")

        if not insights:
            insights.append("Business metrics stable - maintain current strategies")

        return insights


# Global analytics service instance
analytics_service = AnalyticsService()
