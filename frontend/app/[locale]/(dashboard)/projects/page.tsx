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
import { useTranslations, useLocale } from 'next-intl'

const statusVariant: Record<ProjectStatus, 'info' | 'secondary' | 'success' | 'warning' | 'outline'> = {
  draft: 'info',
  'pre-production': 'secondary',
  production: 'success',
  'post-production': 'warning',
  delivered: 'outline',
  archived: 'outline',
}

export default function ProjectsPage() {
  const t = useTranslations('projects')
  const locale = useLocale()
  const { organizationId, isLoading: isLoadingOrg, profile } = useAuth()
  const effectiveRole = profile?.effective_role || profile?.role_v2 || 'owner'
  const isFreelancer = effectiveRole === 'freelancer'
  const canCreateProject =
    profile?.is_master_owner === true ||
    effectiveRole === 'owner' ||
    effectiveRole === 'admin' ||
    effectiveRole === 'producer'

  const { data: projects, isLoading, error } = useProjects(organizationId || undefined)

  if (isLoadingOrg || isLoading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight font-display">{t('title')}</h1>
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
      <div className="rounded-xl border bg-card/60 px-6 py-5">
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Portfolio / Productions
        </div>
        <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight font-display">{t('title')}</h1>
            <p className="text-muted-foreground">
              {t('description')}
            </p>
          </div>
          {canCreateProject && (
            <Button asChild>
              <LocaleLink href="/projects/new">
                <Plus className="mr-2 h-4 w-4" />
                {t('newProject')}
              </LocaleLink>
            </Button>
          )}
        </div>
      </div>

      {projects && projects.length > 0 ? (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
            // Convert status to camelCase: "pre-production" -> "preProduction"
            const statusKey = project.status
              .split('-')
              .map((part, index) =>
                index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)
              )
              .join('')
            const statusLabel = t(`statusLabels.${statusKey}`, { defaultMessage: project.status.replace(/-/g, ' ') })

            return (
              <LocaleLink key={project.id} href={`/projects/${project.id}`}>
                <Card className="h-full hover:bg-muted/50 transition-colors cursor-pointer">
                  <CardHeader className="min-h-[92px]">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg line-clamp-1">{project.title}</CardTitle>
                      <Badge variant={statusVariant[project.status]}>
                        {statusLabel}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="mt-auto">
                    <div className="space-y-2 text-sm">
                      {project.start_date && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{t('start')}:</span>
                          <span>{new Date(project.start_date).toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        </div>
                      )}
                      {!isFreelancer && (
                        <div className="flex justify-between font-medium">
                          <span className="text-muted-foreground">{t('budget')}:</span>
                          <span>{formatCurrency(project.budget_total_cents)}</span>
                        </div>
                      )}
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
              {canCreateProject && (
                <Button asChild>
                  <LocaleLink href="/projects/new">
                    <Plus className="mr-2 h-4 w-4" />
                    {t('createProject')}
                  </LocaleLink>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
