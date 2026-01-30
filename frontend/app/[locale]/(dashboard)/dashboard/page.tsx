'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useExecutiveDashboard } from '@/lib/api/hooks/useAnalytics'
import { useProjects } from '@/lib/api/hooks'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, DollarSign, TrendingUp, Package, Cloud, FolderOpen } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/money'
import { RevenueChart } from '@/components/dashboard/RevenueChart'
import { ProjectStatusCards } from '@/components/dashboard/ProjectStatusCards'
import { RecentTransactions } from '@/components/dashboard/RecentTransactions'
import { EquipmentUtilization } from '@/components/dashboard/EquipmentUtilization'
import { QuickActions } from '@/components/dashboard/QuickActions'
import { useTranslations } from 'next-intl'

// Helper function to safely format numbers
const safeToFixed = (value: number | string | null | undefined, decimals: number = 1): string => {
  // Convert to number
  const num = typeof value === 'number' ? value : parseFloat(value ?? '0')

  // Check if valid number
  if (isNaN(num) || !isFinite(num)) {
    return '0'
  }

  return num.toFixed(decimals)
}

export default function DashboardPage() {
  const { user, organizationId } = useAuth()
  const { data: dashboard, isLoading, error } = useExecutiveDashboard(12)
  const { data: projects } = useProjects(organizationId || undefined)
  const t = useTranslations('dashboard')

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Fallback to simple dashboard if analytics fail
  if (error || !dashboard) {
    const activeProjects = projects?.filter(p =>
      p.status !== 'archived' && p.status !== 'delivered'
    ).length || 0

    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">{t('welcome', { email: user?.email ?? '' })}</p>
        </div>

        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('activeProjects')}</CardTitle>
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeProjects}</div>
              <p className="text-xs text-muted-foreground">{t('inProgress')}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <QuickActions />
          <RecentTransactions />
        </div>

        {error && (
          <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950">
            <CardHeader>
              <CardTitle className="text-sm">{t('analyticsUnavailable')}</CardTitle>
              <CardDescription>
                {t('analyticsUnavailableDesc')}
              </CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>
    )
  }

  // Full analytics dashboard
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-sm sm:text-base lg:text-lg text-muted-foreground">
          {t('welcome', { email: user?.email ?? '' })}
        </p>
      </div>

      {/* Financial Overview Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('revenueMonth')}</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(dashboard.financial.month_to_date.revenue_cents)}
            </div>
            <p className="text-xs text-muted-foreground">
              {t('margin', { value: safeToFixed(dashboard.financial.month_to_date.profit_margin) })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('netProfit')}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${dashboard.financial.month_to_date.net_profit_cents >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
              {formatCurrency(dashboard.financial.month_to_date.net_profit_cents)}
            </div>
            <p className="text-xs text-muted-foreground">
              {t('expenses', { amount: formatCurrency(dashboard.financial.month_to_date.expenses_cents) })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('revenueYear')}</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(dashboard.financial.year_to_date.revenue_cents)}
            </div>
            <p className="text-xs text-muted-foreground">
              {t('margin', { value: safeToFixed(dashboard.financial.year_to_date.profit_margin) })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('equipmentHealth')}</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {safeToFixed(dashboard.inventory.inventory_health_score, 0)}/100
            </div>
            <p className="text-xs text-muted-foreground">
              {t('items', { count: dashboard.inventory.total_items })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Project Status */}
      <ProjectStatusCards data={dashboard.production} />

      {/* Revenue Chart and Quick Actions Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        <RevenueChart data={dashboard.trends} />
        <QuickActions />
      </div>

      {/* Recent Activity and Equipment Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        <RecentTransactions />
        <EquipmentUtilization data={dashboard.inventory} />
      </div>

      {/* Cloud Sync Status */}
      {dashboard.cloud.total_sync_operations > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{t('cloudSyncStatus')}</CardTitle>
                <CardDescription>{t('cloudSyncDesc')}</CardDescription>
              </div>
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${dashboard.cloud.cloud_health_status === 'healthy'
                ? 'bg-green-100 text-green-700'
                : dashboard.cloud.cloud_health_status === 'warning'
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-red-100 text-red-700'
                }`}>
                <Cloud className="h-4 w-4" />
                {t(dashboard.cloud.cloud_health_status)}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <div className="text-sm text-muted-foreground">{t('successRate')}</div>
                <div className="text-2xl font-bold">{safeToFixed(dashboard.cloud.sync_success_rate)}%</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">{t('totalSyncs')}</div>
                <div className="text-2xl font-bold">{dashboard.cloud.total_sync_operations}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">{t('recentSyncs')}</div>
                <div className="text-2xl font-bold">{dashboard.cloud.recent_sync_activity_30_days}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">{t('storageUsed')}</div>
                <div className="text-2xl font-bold">{safeToFixed(dashboard.cloud.estimated_storage_used_gb)} GB</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
