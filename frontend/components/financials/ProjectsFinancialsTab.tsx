'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useProjects } from '@/lib/api/hooks/useProjects'
import { useAuth } from '@/contexts/AuthContext'
import { useTranslations } from 'next-intl'
import { formatCurrency } from '@/lib/utils/money'
import { ProjectWithClient } from '@/types'
import { ChevronRight, Folder, TrendingUp, TrendingDown, Wallet } from 'lucide-react'
import { ProjectFinancialsAdmin } from './ProjectFinancialsAdmin'

export function ProjectsFinancialsTab() {
    const { organizationId } = useAuth()
    const t = useTranslations('financials.projects')
    const { data: projects, isLoading } = useProjects(organizationId || undefined)
    const [selectedProject, setSelectedProject] = useState<ProjectWithClient | null>(null)

    if (isLoading) {
        return (
            <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                    <Card key={i}>
                        <CardContent className="pt-6">
                            <div className="animate-pulse space-y-3">
                                <div className="h-4 bg-muted rounded w-1/2" />
                                <div className="h-8 bg-muted rounded w-3/4" />
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        )
    }

    // If a project is selected, show full financial details
    if (selectedProject) {
        return (
            <div className="space-y-4">
                <Button variant="outline" onClick={() => setSelectedProject(null)}>
                    ← {t('backToList')}
                </Button>
                <ProjectFinancialsAdmin
                    projectId={selectedProject.id}
                    project={selectedProject}
                    isAdmin={true}
                />
            </div>
        )
    }

    // Show project list
    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle>{t('title')}</CardTitle>
                    <CardDescription>{t('description')}</CardDescription>
                </CardHeader>
            </Card>

            {projects && projects.length > 0 ? (
                <div className="grid gap-4">
                    {projects.map((project) => (
                        <ProjectFinancialCard
                            key={project.id}
                            project={project}
                            onClick={() => setSelectedProject(project)}
                        />
                    ))}
                </div>
            ) : (
                <Card>
                    <CardContent className="pt-6 text-center">
                        <Folder className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                        <p className="text-muted-foreground">{t('noProjects')}</p>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}

interface ProjectFinancialCardProps {
    project: ProjectWithClient
    onClick: () => void
}

function ProjectFinancialCard({ project, onClick }: ProjectFinancialCardProps) {
    const t = useTranslations('financials.projects')

    const budgetLimit = project.budget_total_cents || 0
    const budgetStatus = project.budget_status || 'draft'

    const statusColors = {
        draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
        pending_approval: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
        approved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
        rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
        increment_pending: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    }

    return (
        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={onClick}>
            <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 rounded-full bg-primary/10">
                                <Folder className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-lg">{project.title}</h3>
                                {project.client && (
                                    <p className="text-sm text-muted-foreground">{project.client.name}</p>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-4 mt-4">
                            <Badge className={statusColors[budgetStatus]}>
                                {t(`status.${budgetStatus}`)}
                            </Badge>

                            {budgetLimit > 0 && (
                                <div className="flex items-center gap-2 text-sm">
                                    <Wallet className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-muted-foreground">{t('budget')}:</span>
                                    <span className="font-semibold">{formatCurrency(budgetLimit)}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
            </CardContent>
        </Card>
    )
}
