'use client'

import { useProjects } from '@/lib/api/hooks'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, FolderOpen } from 'lucide-react'
import Link from 'next/link'
import { formatCurrency } from '@/lib/utils/money'
import { ProjectStatus, ProjectType } from '@/types'
import { ProjectsListSkeleton } from '@/components/LoadingSkeletons'

const statusColors: Record<ProjectStatus, string> = {
  planning: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  pre_production: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  production: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  post_production: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  completed: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
  archived: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
}

const typeLabels: Record<ProjectType, string> = {
  feature: 'Feature Film',
  short: 'Short Film',
  documentary: 'Documentary',
  commercial: 'Commercial',
  series: 'Series',
  other: 'Other',
}

export default function ProjectsPage() {
  const { organizationId, isLoading: isLoadingOrg } = useAuth()

  const { data: projects, isLoading, error } = useProjects(organizationId || undefined)

  if (isLoadingOrg || isLoading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
            <p className="text-muted-foreground">Manage your film production projects</p>
          </div>
        </div>
        <ProjectsListSkeleton />
      </div>
    )
  }

  if (!organizationId) {
    return <div>Error: No organization found. Please contact support.</div>
  }

  if (error) {
    return <div>Error loading projects: {error.message}</div>
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground">
            Manage your film production projects
          </p>
        </div>
        <Button asChild>
          <Link href="/projects/new">
            <Plus className="mr-2 h-4 w-4" />
            New Project
          </Link>
        </Button>
      </div>

      {projects && projects.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{project.title}</CardTitle>
                    <Badge className={statusColors[project.status]}>
                      {project.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  <CardDescription>{typeLabels[project.project_type]}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    {project.start_date && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Start:</span>
                        <span>{new Date(project.start_date).toLocaleDateString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-medium">
                      <span className="text-muted-foreground">Budget:</span>
                      <span>{formatCurrency(project.budget_total_cents)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Your Projects</CardTitle>
            <CardDescription>Create your first project to get started</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-2">No projects yet</p>
              <p className="text-sm text-muted-foreground mb-4">
                Get started by creating your first project
              </p>
              <Button asChild>
                <Link href="/projects/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Project
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
