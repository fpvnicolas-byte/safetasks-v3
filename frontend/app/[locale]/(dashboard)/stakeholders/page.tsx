'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import { useStakeholders, useDeleteStakeholder } from '@/lib/api/hooks/useStakeholders'
import { useProjects } from '@/lib/api/hooks/useProjects'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Search } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'
import { Skeleton } from '@/components/ui/skeleton'

const StakeholdersTableCard = dynamic(
  () => import('./_components/StakeholdersTableCard').then((mod) => mod.StakeholdersTableCard),
  {
    ssr: false,
    loading: () => (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-52 mt-1" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    ),
  }
)

export default function StakeholdersPage() {
  const { organizationId, isLoading: isLoadingOrg } = useAuth()
  const t = useTranslations('stakeholders')
  const tFeedback = useTranslations('common.feedback')

  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const { data: projects, isLoading: isLoadingProjects } = useProjects(organizationId || undefined)
  const { data: stakeholders, isLoading: isLoadingStakeholders } = useStakeholders(
    selectedProjectId || undefined
  )
  const deleteStakeholder = useDeleteStakeholder()

  const filteredStakeholders = stakeholders?.filter((stakeholder) =>
    stakeholder.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    stakeholder.role.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleDelete = async () => {
    if (!deleteTarget) return

    setIsDeleting(true)
    try {
      await deleteStakeholder.mutateAsync(deleteTarget.id)
      toast.success(tFeedback('actionSuccess'))
      setDeleteTarget(null)
    } catch (error: unknown) {
      toast.error(tFeedback('actionError', { message: 'Failed to delete stakeholder' }))
      console.error('Delete error:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  if (isLoadingOrg || isLoadingProjects) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight font-display">{t('title')}</h1>
            <p className="text-muted-foreground">{t('loading')}</p>
          </div>
        </div>
      </div>
    )
  }

  if (!organizationId) {
    return <div>{t('error')}</div>
  }

  return (
    <div className="space-y-8">
      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={isDeleting}
        title={tFeedback('confirmDeleteTitle')}
        description={deleteTarget?.name ? `${tFeedback('confirmDelete')} (${deleteTarget.name})` : tFeedback('confirmDelete')}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-display">{t('title')}</h1>
          <p className="text-muted-foreground">{t('description')}</p>
        </div>
        <Button asChild>
          <Link href="/stakeholders/new">
            <Plus className="mr-2 h-4 w-4" />
            {t('addStakeholder')}
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('filters.title')}</CardTitle>
          <CardDescription>{t('filters.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 flex-col sm:flex-row">
            <div className="flex-1">
              <Select
                value={selectedProjectId || '__all__'}
                onValueChange={(value) => setSelectedProjectId(value === '__all__' ? '' : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('filters.allProjects')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{t('filters.allProjects')}</SelectItem>
                  {projects?.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('filters.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <StakeholdersTableCard
        stakeholders={filteredStakeholders}
        isLoading={isLoadingStakeholders}
        isDeleting={isDeleting}
        projects={projects}
        onDelete={setDeleteTarget}
      />
    </div>
  )
}
