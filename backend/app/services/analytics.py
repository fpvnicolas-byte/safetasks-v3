import logging
from datetime import datetime, timedelta, date
from decimal import Decimal
from typing import Dict, Any, Optional
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, text, case
from sqlalchemy.sql import extract

from app.models.organizations import Organization
from app.models.projects import Project
from app.models.transactions import Transaction
from app.models.inventory import KitItem
from app.models.cloud import CloudSyncStatus

logger = logging.getLogger(__name__)

# Default timezone - can be made configurable per organization
DEFAULT_TIMEZONE = ZoneInfo("America/Sao_Paulo")


class AnalyticsService:
    """
    Executive dashboard analytics service.
    Provides high-level business metrics for CEO/Producer decision making.
    """

    def __init__(self):
        pass

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

        # Get current date in the organization's timezone
        now = datetime.now(DEFAULT_TIMEZONE)
        today = now.date()

        # Get current month transactions (from 1st to today, inclusive)
        current_month_start = today.replace(day=1)
        current_month_end = today  # Include today's transactions

        # Revenue and expenses for current month (entire month)
        monthly_query = select(
            func.sum(
                case(
                    (Transaction.type == "income", Transaction.amount_cents),
                    else_=0
                )
            ).label("revenue_cents"),
            func.sum(
                case(
                    (Transaction.type == "expense", Transaction.amount_cents),
                    else_=0
                )
            ).label("expenses_cents")
        ).where(
            and_(
                Transaction.organization_id == organization_id,
                extract('year', Transaction.transaction_date) == today.year,
                extract('month', Transaction.transaction_date) == today.month
            )
        )

        monthly_result = await db.execute(monthly_query)
        monthly_row = monthly_result.first()

        revenue_mtd = monthly_row.revenue_cents or 0
        expenses_mtd = monthly_row.expenses_cents or 0
        net_profit_mtd = revenue_mtd - expenses_mtd

        logger.info(
            f"MTD Financial Metrics for org {organization_id}: "
            f"Revenue: {revenue_mtd}, Expenses: {expenses_mtd}, "
            f"Month: {today.month}/{today.year}"
        )

        # Year-to-date calculations (entire current year)
        ytd_query = select(
            func.sum(
                case(
                    (Transaction.type == "income", Transaction.amount_cents),
                    else_=0
                )
            ).label("revenue_ytd_cents"),
            func.sum(
                case(
                    (Transaction.type == "expense", Transaction.amount_cents),
                    else_=0
                )
            ).label("expenses_ytd_cents")
        ).where(
            and_(
                Transaction.organization_id == organization_id,
                extract('year', Transaction.transaction_date) == today.year
            )
        )

        ytd_result = await db.execute(ytd_query)
        ytd_row = ytd_result.first()

        revenue_ytd = ytd_row.revenue_ytd_cents or 0
        expenses_ytd = ytd_row.expenses_ytd_cents or 0
        net_profit_ytd = revenue_ytd - expenses_ytd

        logger.info(
            f"YTD Financial Metrics for org {organization_id}: "
            f"Revenue: {revenue_ytd}, Expenses: {expenses_ytd}, "
            f"Year: {today.year}"
        )

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

        # Active projects (not completed or cancelled)
        active_projects_query = select(func.count(Project.id)).where(
            and_(
                Project.organization_id == organization_id,
                Project.status.in_(["planning", "pre_production", "production", "post_production"])
            )
        )

        active_projects_result = await db.execute(active_projects_query)
        active_projects_count = active_projects_result.scalar() or 0

        # Total projects
        total_projects_query = select(func.count(Project.id)).where(
            Project.organization_id == organization_id
        )

        total_projects_result = await db.execute(total_projects_query)
        total_projects_count = total_projects_result.scalar() or 0

        # Projects by status
        status_query = select(
            Project.status,
            func.count(Project.id).label("count")
        ).where(
            Project.organization_id == organization_id
        ).group_by(Project.status)

        status_result = await db.execute(status_query)
        projects_by_status = {row.status: row.count for row in status_result}

        # Pending call sheets for the week (next 7 days)
        # This would need to be implemented based on your call sheet scheduling
        # For now, return a placeholder
        pending_call_sheets = 0

        # Production efficiency metrics
        avg_project_duration_days = 45  # Placeholder - could be calculated from actual data

        return {
            "active_projects": active_projects_count,
            "total_projects": total_projects_count,
            "projects_by_status": projects_by_status,
            "pending_call_sheets_this_week": pending_call_sheets,
            "production_efficiency": {
                "avg_project_duration_days": avg_project_duration_days,
                "on_time_delivery_rate": 85.0  # Placeholder percentage
            }
        }

    async def _get_inventory_metrics(self, organization_id: UUID, db: AsyncSession) -> Dict[str, Any]:
        """Calculate inventory health metrics for the dashboard."""

        # Total items
        total_items_query = select(func.count(KitItem.id)).where(
            KitItem.organization_id == organization_id
        )

        total_items_result = await db.execute(total_items_query)
        total_items = total_items_result.scalar() or 0

        # Items by health status
        health_query = select(
            KitItem.health_status,
            func.count(KitItem.id).label("count")
        ).where(
            KitItem.organization_id == organization_id
        ).group_by(KitItem.health_status)

        health_result = await db.execute(health_query)
        items_by_health = {row.health_status: row.count for row in health_result}

        # Items needing service (health status indicates problems)
        critical_items = items_by_health.get("broken", 0) + items_by_health.get("needs_service", 0)

        # Maintenance overdue (items not maintained in last 50 hours of usage)
        # This is a simplified calculation - in practice, you'd compare against maintenance intervals
        maintenance_overdue_query = select(func.count(KitItem.id)).where(
            and_(
                KitItem.organization_id == organization_id,
                KitItem.health_status.in_(["needs_service", "broken"])
            )
        )

        maintenance_overdue_result = await db.execute(maintenance_overdue_query)
        maintenance_overdue = maintenance_overdue_result.scalar() or 0

        # Equipment utilization rate
        total_usage_hours_query = select(func.sum(KitItem.current_usage_hours)).where(
            KitItem.organization_id == organization_id
        )

        total_usage_result = await db.execute(total_usage_hours_query)
        total_usage_hours = total_usage_result.scalar() or 0

        # Calculate utilization rate (simplified - could be time-based)
        utilization_rate = min(100.0, (total_usage_hours / max(total_items * 100, 1)) * 100)

        # Maintenance costs (from transactions with maintenance category)
        maintenance_cost_query = select(func.sum(Transaction.amount_cents)).where(
            and_(
                Transaction.organization_id == organization_id,
                Transaction.category == "maintenance",
                Transaction.type == "expense"
            )
        )

        maintenance_cost_result = await db.execute(maintenance_cost_query)
        maintenance_cost_cents = maintenance_cost_result.scalar() or 0

        return {
            "total_items": total_items,
            "items_by_health": items_by_health,
            "items_needing_service": critical_items,
            "maintenance_overdue": maintenance_overdue,
            "equipment_utilization_rate": utilization_rate,
            "maintenance_cost_cents": maintenance_cost_cents,
            "maintenance_cost_brl": maintenance_cost_cents / 100,
            "inventory_health_score": self._calculate_inventory_health_score(items_by_health, total_items)
        }

    async def _get_cloud_metrics(self, organization_id: UUID, db: AsyncSession) -> Dict[str, Any]:
        """Calculate cloud sync metrics for the dashboard."""

        # Total sync operations
        total_syncs_query = select(func.count(CloudSyncStatus.id)).where(
            CloudSyncStatus.organization_id == organization_id
        )

        total_syncs_result = await db.execute(total_syncs_query)
        total_syncs = total_syncs_result.scalar() or 0

        # Successful syncs
        successful_syncs_query = select(func.count(CloudSyncStatus.id)).where(
            and_(
                CloudSyncStatus.organization_id == organization_id,
                CloudSyncStatus.sync_status == "completed"
            )
        )

        successful_syncs_result = await db.execute(successful_syncs_query)
        successful_syncs = successful_syncs_result.scalar() or 0

        # Failed syncs
        failed_syncs_query = select(func.count(CloudSyncStatus.id)).where(
            and_(
                CloudSyncStatus.organization_id == organization_id,
                CloudSyncStatus.sync_status == "failed"
            )
        )

        failed_syncs_result = await db.execute(failed_syncs_query)
        failed_syncs = failed_syncs_result.scalar() or 0

        # Success rate
        success_rate = (successful_syncs / max(total_syncs, 1)) * 100

        # Storage used (simplified - would need actual file size tracking)
        storage_used_gb = total_syncs * 0.1  # Rough estimate: 100MB per sync

        # Recent sync activity (last 30 days)
        thirty_days_ago = datetime.now(DEFAULT_TIMEZONE) - timedelta(days=30)
        recent_syncs_query = select(func.count(CloudSyncStatus.id)).where(
            and_(
                CloudSyncStatus.organization_id == organization_id,
                CloudSyncStatus.sync_started_at >= thirty_days_ago
            )
        )

        recent_syncs_result = await db.execute(recent_syncs_query)
        recent_syncs = recent_syncs_result.scalar() or 0

        return {
            "total_sync_operations": total_syncs,
            "successful_syncs": successful_syncs,
            "failed_syncs": failed_syncs,
            "sync_success_rate": success_rate,
            "estimated_storage_used_gb": storage_used_gb,
            "recent_sync_activity_30_days": recent_syncs,
            "cloud_health_status": "healthy" if success_rate >= 95 else "warning" if success_rate >= 80 else "critical"
        }

    async def _get_trends_data(
        self,
        organization_id: UUID,
        start_date: datetime,
        end_date: datetime,
        db: AsyncSession
    ) -> Dict[str, Any]:
        """Calculate trends data for charts and visualizations."""

        # Monthly revenue/expense trends
        monthly_trends = []

        # Calculate the start month based on months_back parameter
        today = datetime.now(DEFAULT_TIMEZONE).date()

        for i in range(12):
            # Calculate month boundaries properly
            if i == 0:
                month_start = start_date.date() if hasattr(start_date, 'date') else start_date
                if not isinstance(month_start, type(today)):
                    month_start = today.replace(day=1) - timedelta(days=365)
            else:
                # Move to next month
                month_start = (month_start.replace(day=1) + timedelta(days=32)).replace(day=1)

            # Calculate last day of the month
            next_month = (month_start.replace(day=1) + timedelta(days=32)).replace(day=1)
            month_end = next_month - timedelta(days=1)

            # Don't query future months
            if month_start > today:
                break

            month_query = select(
                extract('month', Transaction.transaction_date).label('month'),
                extract('year', Transaction.transaction_date).label('year'),
                func.sum(
                    case(
                        (Transaction.type == "income", Transaction.amount_cents),
                        else_=0
                    )
                ).label("revenue_cents"),
                func.sum(
                    case(
                        (Transaction.type == "expense", Transaction.amount_cents),
                        else_=0
                    )
                ).label("expenses_cents")
            ).where(
                and_(
                    Transaction.organization_id == organization_id,
                    Transaction.transaction_date >= month_start,
                    Transaction.transaction_date <= month_end
                )
            ).group_by(
                extract('month', Transaction.transaction_date),
                extract('year', Transaction.transaction_date)
            )

            month_result = await db.execute(month_query)
            month_data = month_result.first()

            if month_data:
                monthly_trends.append({
                    "month": f"{int(month_data.year)}-{int(month_data.month):02d}",
                    "revenue_cents": month_data.revenue_cents or 0,
                    "expenses_cents": month_data.expenses_cents or 0,
                    "net_profit_cents": (month_data.revenue_cents or 0) - (month_data.expenses_cents or 0)
                })

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
