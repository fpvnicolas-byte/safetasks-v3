'use client'

import { useState } from 'react'
import { useStakeholders } from '@/lib/api/hooks/useStakeholders'
import { useProjects } from '@/lib/api/hooks'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Edit, Trash2, Search, DollarSign } from 'lucide-react'
import Link from 'next/link'
import { useDeleteStakeholder } from '@/lib/api/hooks/useStakeholders'
import { toast } from 'sonner'
import { useLocale, useTranslations } from 'next-intl'
import { StakeholderStatusBadge } from '@/components/stakeholders/StakeholderStatusBadge'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'

export default function StakeholdersPage() {
  const { organizationId, isLoading: isLoadingOrg } = useAuth()
  const locale = useLocale()
  const t = useTranslations('stakeholders')
  const tCommon = useTranslations('common')
  const tFeedback = useTranslations('common.feedback')
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')

  const { data: projects, isLoading: isLoadingProjects } = useProjects(organizationId || undefined)
  const { data: stakeholders, isLoading: isLoadingStakeholders } = useStakeholders(
    selectedProjectId || undefined
  )
  const deleteStakeholder = useDeleteStakeholder()

  const filteredStakeholders = stakeholders?.filter((stakeholder) =>
    stakeholder.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    stakeholder.role.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const [deleteTarget, setDeleteTarget] = useState<{ id: string, name: string } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

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

  const getProjectName = (projectId: string) => {
    return projects?.find((p) => p.id === projectId)?.title || t('table.unknownProject')
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
          <p className="text-muted-foreground">
            {t('description')}
          </p>
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

      <Card>
        <CardHeader>
          <CardTitle>{t('table.title')}</CardTitle>
          <CardDescription>
            {t('table.count', { count: filteredStakeholders?.length || 0 })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingStakeholders ? (
            <div className="text-center py-8 text-muted-foreground">{t('table.loading')}</div>
          ) : filteredStakeholders && filteredStakeholders.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('table.headers.name')}</TableHead>
                  <TableHead>{t('table.headers.role')}</TableHead>
                  <TableHead>{t('table.headers.status')}</TableHead>
                  <TableHead>{t('table.headers.project')}</TableHead>
                  <TableHead>{t('table.headers.email')}</TableHead>
                  <TableHead>{t('table.headers.phone')}</TableHead>
                  <TableHead className="text-right">{t('table.headers.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStakeholders.map((stakeholder) => (
                  <TableRow key={stakeholder.id}>
                    <TableCell className="font-medium">{stakeholder.name}</TableCell>
                    <TableCell>{stakeholder.role}</TableCell>
                    <TableCell>
                      <StakeholderStatusBadge status={stakeholder.status || 'requested'} />
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/projects/${stakeholder.project_id}`}
                        className="text-info hover:underline"
                      >
                        {getProjectName(stakeholder.project_id)}
                      </Link>
                    </TableCell>
                    <TableCell>{stakeholder.email || '-'}</TableCell>
                    <TableCell>{stakeholder.phone || '-'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" asChild>
                          <Link href={`/stakeholders/${stakeholder.id}`}>
                            <Edit className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button variant="ghost" size="icon" asChild title={t('table.addPayment')}>
                          <Link href={`/financials/transactions/new?project_id=${stakeholder.project_id}&stakeholder_id=${stakeholder.id}`}>
                            <DollarSign className="h-4 w-4 text-success" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteTarget({ id: stakeholder.id, name: stakeholder.name })}
                          disabled={isDeleting}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">{t('empty.noStakeholders')}</p>
              <Button asChild>
                <Link href="/stakeholders/new">
                  <Plus className="mr-2 h-4 w-4" />
                  {t('empty.addFirst')}
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
