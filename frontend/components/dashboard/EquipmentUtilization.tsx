'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { InventoryMetrics } from '@/types'
import { Package, Wrench, AlertTriangle, ExternalLink } from 'lucide-react'
import Link from 'next/link'

interface EquipmentUtilizationProps {
  data: InventoryMetrics
}

export function EquipmentUtilization({ data }: EquipmentUtilizationProps) {
  const healthStatusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    excellent: {
      label: 'Excellent',
      color: 'bg-green-500',
      icon: <Package className="h-4 w-4" />
    },
    good: {
      label: 'Good',
      color: 'bg-blue-500',
      icon: <Package className="h-4 w-4" />
    },
    needs_service: {
      label: 'Needs Service',
      color: 'bg-yellow-500',
      icon: <Wrench className="h-4 w-4" />
    },
    broken: {
      label: 'Broken',
      color: 'bg-red-500',
      icon: <AlertTriangle className="h-4 w-4" />
    },
    retired: {
      label: 'Retired',
      color: 'bg-gray-500',
      icon: <Package className="h-4 w-4" />
    },
  }

  // Calculate percentages
  const healthPercentages = Object.entries(data.items_by_health).map(([status, count]) => ({
    status,
    count,
    percentage: data.total_items > 0 ? (count / data.total_items) * 100 : 0
  }))

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Equipment Health</CardTitle>
            <CardDescription>Inventory status and utilization</CardDescription>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/inventory/items">
              View All
              <ExternalLink className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overview Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Package className="h-4 w-4" />
              <span>Total Items</span>
            </div>
            <div className="text-2xl font-bold">{data.total_items}</div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertTriangle className="h-4 w-4" />
              <span>Needs Service</span>
            </div>
            <div className="text-2xl font-bold text-yellow-600">{data.items_needing_service}</div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Wrench className="h-4 w-4" />
              <span>Utilization</span>
            </div>
            <div className="text-2xl font-bold">{data.equipment_utilization_rate.toFixed(0)}%</div>
          </div>
        </div>

        {/* Health Status Breakdown */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Health Status Distribution</h4>

          {/* Stacked bar chart */}
          <div className="h-8 flex rounded-lg overflow-hidden">
            {healthPercentages.map(({ status, percentage }) => {
              const config = healthStatusConfig[status]
              if (!config || percentage === 0) return null

              return (
                <div
                  key={status}
                  className={`${config.color} transition-all hover:opacity-80`}
                  style={{ width: `${percentage}%` }}
                  title={`${config.label}: ${percentage.toFixed(1)}%`}
                />
              )
            })}
          </div>

          {/* Legend */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            {Object.entries(healthStatusConfig).map(([key, config]) => {
              const count = data.items_by_health[key] || 0
              const percentage = data.total_items > 0 ? (count / data.total_items) * 100 : 0

              return (
                <div key={key} className="flex items-center gap-2">
                  <div className={`h-3 w-3 rounded ${config.color}`} />
                  <span className="text-muted-foreground">
                    {config.label}: {count} ({percentage.toFixed(0)}%)
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Health Score */}
        <div className="border-t pt-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Overall Health Score</span>
            <span className="text-2xl font-bold">{data.inventory_health_score.toFixed(0)}/100</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                data.inventory_health_score >= 75
                  ? 'bg-green-500'
                  : data.inventory_health_score >= 50
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
              }`}
              style={{ width: `${data.inventory_health_score}%` }}
            />
          </div>
        </div>

        {/* Maintenance Alert */}
        {data.maintenance_overdue > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-medium text-yellow-900">Maintenance Required</h4>
                <p className="text-sm text-yellow-700 mt-1">
                  {data.maintenance_overdue} item{data.maintenance_overdue > 1 ? 's' : ''} overdue for maintenance
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
