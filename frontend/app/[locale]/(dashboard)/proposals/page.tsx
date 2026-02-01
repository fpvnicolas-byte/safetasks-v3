'use client'

import { useState } from 'react'
import { useProposals, useDeleteProposal } from '@/lib/api/hooks'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, Edit, Trash2, FileText, Eye } from 'lucide-react'
import Link from 'next/link'
import { Proposal, ProposalStatus, formatCurrency } from '@/types'
import { useLocale, useTranslations } from 'next-intl'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'
import { useConfirmDelete } from '@/lib/hooks/useConfirmDelete'
import { useErrorDialog } from '@/lib/hooks/useErrorDialog'
import { ErrorDialog } from '@/components/ui/error-dialog'

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

  // Apply search filter
  const filteredProposals = allProposals?.filter(proposal => {
    const matchesSearch = !searchQuery ||
      proposal.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      proposal.description?.toLowerCase().includes(searchQuery.toLowerCase())

    return matchesSearch
  }) || []

  const { errorDialog, showError, closeError } = useErrorDialog()
  const {
    open: deleteOpen,
    onOpenChange: setDeleteOpen,
    askConfirmation: confirmDelete,
    closeConfirmation: cancelDelete,
    targetId: idToDelete,
    additionalData: proposalTitle
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
          <p className="text-muted-foreground">
            {t('description')}
          </p>
        </div>
        <Button asChild>
          <Link href="/proposals/new">
            <Plus className="mr-2 h-4 w-4" />
            {t('newProposal')}
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>{t('filter.title')}</CardTitle>
          <CardDescription>
            {t('filter.description')}
          </CardDescription>
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
                  {filteredProposals.length !== 1 ? t('filter.proposalCount_other', { count: filteredProposals.length }) : t('filter.proposalCount', { count: 1 })}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Proposals Grid */}
      {isLoading ? (
        <div>{t('loading')}</div>
      ) : error ? (
        <div>{t('error', { message: error.message })}</div>
      ) : filteredProposals.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredProposals.map((proposal) => (
            <ProposalCard
              key={proposal.id}
              proposal={proposal}
              onDelete={() => confirmDelete(proposal.id, proposal.title)}
              t={t}
              locale={locale}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{t('empty.title')}</CardTitle>
            <CardDescription>
              {searchQuery || statusFilter !== 'all'
                ? t('empty.noMatches')
                : t('empty.getStarted')
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground mb-4">
                {t('empty.helpText')}
              </p>
              <Button asChild>
                <Link href="/proposals/new">
                  <Plus className="mr-2 h-4 w-4" />
                  {t('empty.createProposal')}
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      <ErrorDialog
        open={errorDialog.open}
        onOpenChange={closeError}
        title={errorDialog.title}
        message={errorDialog.message}
        validationErrors={errorDialog.validationErrors}
        statusCode={errorDialog.statusCode}
      />

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={handleDeleteProposal}
        title={t('delete.title')}
        description={t('delete.description')}
        loading={deleteProposal.isPending}
      />
    </div>
  )
}

interface ProposalCardProps {
  proposal: Proposal
  onDelete: () => void
  t: (key: string, values?: Record<string, string | number>) => string
  locale: string
}

function ProposalCard({ proposal, onDelete, t, locale }: ProposalCardProps) {
  const getStatusVariant = (status: ProposalStatus) => {
    switch (status) {
      case 'approved': return 'default' // Greenish (default is black/primary, but usually good for success in shadcn themes if customized, otherwise use outline/secondary)
      case 'rejected': return 'destructive'
      case 'sent': return 'secondary' // Blueish
      case 'draft': return 'outline'
      case 'expired': return 'destructive'
      default: return 'outline'
    }
  }

  // Assuming backend returns valid_until as ISO date string
  const validUntil = proposal.valid_until ? new Date(proposal.valid_until).toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1 mr-2">
            <CardTitle className="text-lg line-clamp-1">{proposal.title}</CardTitle>
            <CardDescription className="line-clamp-1">
              <span className="font-medium text-foreground">{proposal.client?.name}</span>
              <span className="mx-1">•</span>
              {t('card.created')} {new Date(proposal.created_at).toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
            </CardDescription>
          </div>
          <Badge variant={getStatusVariant(proposal.status)}>
            {t(proposal.status)}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex justify-between items-center text-sm">
          <span className="text-muted-foreground">{t('card.totalAmount')}</span>
          <span className="font-semibold text-lg">
            {proposal.total_amount_cents !== null ? formatCurrency(proposal.total_amount_cents, proposal.currency) : 'N/A'}
          </span>
        </div>

        {proposal.valid_until && (
          <div className="text-sm text-muted-foreground">
            {t('card.validUntil')} {validUntil}
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button asChild variant="outline" size="sm" className="flex-1">
            <Link href={`/proposals/${proposal.id}`}>
              <Eye className="mr-2 h-3 w-3" />
              {t('card.view')}
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="flex-1">
            <Link href={`/proposals/${proposal.id}/edit`}>
              <Edit className="mr-2 h-3 w-3" />
              {t('card.edit')}
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onDelete}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
