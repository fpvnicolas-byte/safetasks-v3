'use client'

import { useProjects } from '@/lib/api/hooks'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, FolderOpen } from 'lucide-react'
import { LocaleLink } from '@/components/LocaleLink'
import { formatCurrency } from '@/lib/utils/money'
import { ProjectStatus } from '@/types'
import { ProjectsListSkeleton } from '@/components/LoadingSkeletons'
import { useTranslations } from 'next-intl'

const statusColors: Record<ProjectStatus, string> = {
  draft: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  'pre-production': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  production: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  'post-production': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  delivered: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
  archived: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
}

export default function ProjectsPage() {
  const t = useTranslations('projects')
  const tCommon = useTranslations('common')
  const { organizationId, isLoading: isLoadingOrg } = useAuth()

  const { data: projects, isLoading, error } = useProjects(organizationId || undefined)

  if (isLoadingOrg || isLoading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
            <p className="text-muted-foreground">{t('description')}</p>
          </div>
        </div>
        <ProjectsListSkeleton />
      </div>
    )
  }

  if (!organizationId) {
    return <div>{t('errors.noOrganization')}</div>
  }

  if (error) {
    return <div>{t('errors.loadingProjects')}: {error.message}</div>
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">
            {t('description')}
          </p>
        </div>
        <Button asChild>
          <LocaleLink href="/projects/new">
            <Plus className="mr-2 h-4 w-4" />
            {t('newProject')}
          </LocaleLink>
        </Button>
      </div>

      {projects && projects.length > 0 ? (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
            const statusKey = project.status.replace(/-/g, '')
              .replace(/^(.)/, (match) => match.toLowerCase())
              .replace(/-(.)/g, (match, p1) => p1.toUpperCase())
            const statusLabel = t(`statusLabels.${statusKey}`, { defaultMessage: project.status.replace(/-/g, ' ') })

            return (
              <LocaleLink key={project.id} href={`/projects/${project.id}`}>
                <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg">{project.title}</CardTitle>
                      <Badge className={statusColors[project.status]}>
                        {statusLabel}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      {project.start_date && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{t('start')}:</span>
                          <span>{new Date(project.start_date).toLocaleDateString()}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-medium">
                        <span className="text-muted-foreground">{t('budget')}:</span>
                        <span>{formatCurrency(project.budget_total_cents)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </LocaleLink>
            )
          })}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{t('emptyState.title')}</CardTitle>
            <CardDescription>{t('emptyState.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-2">{t('emptyState.noProjectsYet')}</p>
              <p className="text-sm text-muted-foreground mb-4">
                {t('emptyState.getStarted')}
              </p>
              <Button asChild>
                <LocaleLink href="/projects/new">
                  <Plus className="mr-2 h-4 w-4" />
                  {t('createProject')}
                </LocaleLink>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
