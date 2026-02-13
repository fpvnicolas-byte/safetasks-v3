'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import { useProposals, useDeleteProposal } from '@/lib/api/hooks'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Search } from 'lucide-react'
import Link from 'next/link'
import { ProposalStatus } from '@/types'
import { useLocale, useTranslations } from 'next-intl'
import { useConfirmDelete } from '@/lib/hooks/useConfirmDelete'
import { useErrorDialog } from '@/lib/hooks/useErrorDialog'
import { Skeleton } from '@/components/ui/skeleton'

const ProposalsListSection = dynamic(
  () => import('./_components/ProposalsListSection').then((mod) => mod.ProposalsListSection),
  {
    ssr: false,
    loading: () => (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-56 mt-1" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    ),
  }
)

const ErrorDialog = dynamic(
  () => import('@/components/ui/error-dialog').then((mod) => mod.ErrorDialog),
  { ssr: false }
)

const ConfirmDeleteDialog = dynamic(
  () => import('@/components/ui/confirm-delete-dialog').then((mod) => mod.ConfirmDeleteDialog),
  { ssr: false }
)

export default function ProposalsPage() {
  const { organizationId } = useAuth()
  const locale = useLocale()
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<ProposalStatus | 'all'>('all')
  const t = useTranslations('proposals')
  const tCommon = useTranslations('common.feedback')

  const { data: allProposals, isLoading, error } = useProposals(
    organizationId || '',
    statusFilter === 'all' ? undefined : statusFilter
  )
  const deleteProposal = useDeleteProposal()

  const filteredProposals = allProposals?.filter((proposal) => {
    const matchesSearch = !searchQuery
      || proposal.title.toLowerCase().includes(searchQuery.toLowerCase())
      || proposal.description?.toLowerCase().includes(searchQuery.toLowerCase())

    return matchesSearch
  }) || []

  const { errorDialog, showError, closeError } = useErrorDialog()
  const {
    open: deleteOpen,
    onOpenChange: setDeleteOpen,
    askConfirmation: confirmDelete,
    closeConfirmation: cancelDelete,
    targetId: idToDelete,
  } = useConfirmDelete()

  const handleDeleteProposal = async () => {
    if (!idToDelete) return

    try {
      await deleteProposal.mutateAsync(idToDelete)
      cancelDelete()
    } catch (err: unknown) {
      cancelDelete()
      showError(err, tCommon('actionError', { message: 'Failed to delete' }))
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">{t('description')}</p>
        </div>
        <Button asChild>
          <Link href="/proposals/new">
            <Plus className="mr-2 h-4 w-4" />
            {t('newProposal')}
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('filter.title')}</CardTitle>
          <CardDescription>{t('filter.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium">{t('filter.search')}</label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('filter.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('filter.status')}</label>
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as ProposalStatus | 'all')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('filter.allStatuses')}</SelectItem>
                  <SelectItem value="draft">{t('draft')}</SelectItem>
                  <SelectItem value="sent">{t('sent')}</SelectItem>
                  <SelectItem value="approved">{t('approved')}</SelectItem>
                  <SelectItem value="rejected">{t('rejected')}</SelectItem>
                  <SelectItem value="expired">{t('expired')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('filter.results')}</label>
              <div className="flex items-center justify-center h-10 px-3 py-2 bg-muted rounded-md">
                <span className="text-sm font-medium">
                  {filteredProposals.length !== 1
                    ? t('filter.proposalCount_other', { count: filteredProposals.length })
                    : t('filter.proposalCount', { count: 1 })}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <ProposalsListSection
        isLoading={isLoading}
        errorMessage={error?.message}
        proposals={filteredProposals}
        searchQuery={searchQuery}
        statusFilter={statusFilter}
        locale={locale}
        onDelete={confirmDelete}
      />

      {errorDialog.open ? (
        <ErrorDialog
          open={errorDialog.open}
          onOpenChange={closeError}
          title={errorDialog.title}
          message={errorDialog.message}
          validationErrors={errorDialog.validationErrors}
          statusCode={errorDialog.statusCode}
        />
      ) : null}

      {deleteOpen ? (
        <ConfirmDeleteDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          onConfirm={handleDeleteProposal}
          title={t('delete.title')}
          description={t('delete.description')}
          loading={deleteProposal.isPending}
        />
      ) : null}
    </div>
  )
}
