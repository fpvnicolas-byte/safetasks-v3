'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ProductionMetrics } from '@/types'
import { FolderOpen, Play, CheckCircle, Archive } from 'lucide-react'

interface ProjectStatusCardsProps {
  data: ProductionMetrics
}

export function ProjectStatusCards({ data }: ProjectStatusCardsProps) {
  const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    planning: {
      label: 'Planning',
      color: 'text-blue-600 bg-blue-100',
      icon: <FolderOpen className="h-4 w-4" />
    },
    pre_production: {
      label: 'Pre-Production',
      color: 'text-purple-600 bg-purple-100',
      icon: <FolderOpen className="h-4 w-4" />
    },
    production: {
      label: 'In Production',
      color: 'text-green-600 bg-green-100',
      icon: <Play className="h-4 w-4" />
    },
    post_production: {
      label: 'Post-Production',
      color: 'text-yellow-600 bg-yellow-100',
      icon: <Play className="h-4 w-4" />
    },
    completed: {
      label: 'Completed',
      color: 'text-slate-600 bg-slate-100',
      icon: <CheckCircle className="h-4 w-4" />
    },
    archived: {
      label: 'Archived',
      color: 'text-gray-600 bg-gray-100',
      icon: <Archive className="h-4 w-4" />
    },
  }

  const activePercentage = data.total_projects > 0
    ? (data.active_projects / data.total_projects) * 100
    : 0

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Overview Cards */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
          <FolderOpen className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data.total_projects}</div>
          <p className="text-xs text-muted-foreground">
            {data.active_projects} active
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
          <Play className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data.active_projects}</div>
          <p className="text-xs text-muted-foreground">
            {activePercentage.toFixed(0)}% of total
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">On-Time Rate</CardTitle>
          <CheckCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {data.production_efficiency.on_time_delivery_rate.toFixed(0)}%
          </div>
          <p className="text-xs text-muted-foreground">
            Delivery performance
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
          <Archive className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {data.production_efficiency.avg_project_duration_days} days
          </div>
          <p className="text-xs text-muted-foreground">
            Per project
          </p>
        </CardContent>
      </Card>

      {/* Status Breakdown */}
      <Card className="md:col-span-2 lg:col-span-4">
        <CardHeader>
          <CardTitle>Projects by Status</CardTitle>
          <CardDescription>Breakdown of all projects</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
            {Object.entries(statusConfig).map(([key, config]) => {
              const count = data.projects_by_status[key] || 0
              return (
                <div key={key} className="space-y-2">
                  <div className={`flex items-center justify-center h-12 w-12 rounded-lg ${config.color}`}>
                    {config.icon}
                  </div>
                  <div className="text-2xl font-bold">{count}</div>
                  <div className="text-xs text-muted-foreground">{config.label}</div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
