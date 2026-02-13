'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Edit, Trash2, FileText, Eye } from 'lucide-react'
import { Proposal, ProposalStatus, formatCurrency } from '@/types'
import { useTranslations } from 'next-intl'

interface ProposalsListSectionProps {
  isLoading: boolean
  errorMessage?: string
  proposals: Proposal[]
  searchQuery: string
  statusFilter: ProposalStatus | 'all'
  locale: string
  onDelete: (proposalId: string, proposalTitle: string) => void
}

export function ProposalsListSection({
  isLoading,
  errorMessage,
  proposals,
  searchQuery,
  statusFilter,
  locale,
  onDelete,
}: ProposalsListSectionProps) {
  const t = useTranslations('proposals')

  if (isLoading) {
    return <div>{t('loading')}</div>
  }

  if (errorMessage) {
    return <div>{t('error', { message: errorMessage })}</div>
  }

  if (proposals.length > 0) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {proposals.map((proposal) => (
          <ProposalCard
            key={proposal.id}
            proposal={proposal}
            locale={locale}
            onDelete={() => onDelete(proposal.id, proposal.title)}
          />
        ))}
      </div>
    )
  }

  return (
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
          <p className="text-sm text-muted-foreground mb-4">{t('empty.helpText')}</p>
          <Button asChild>
            <Link href="/proposals/new">
              <Plus className="mr-2 h-4 w-4" />
              {t('empty.createProposal')}
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

interface ProposalCardProps {
  proposal: Proposal
  onDelete: () => void
  locale: string
}

function ProposalCard({ proposal, onDelete, locale }: ProposalCardProps) {
  const t = useTranslations('proposals')

  const getStatusVariant = (status: ProposalStatus) => {
    switch (status) {
      case 'approved': return 'default'
      case 'rejected': return 'destructive'
      case 'sent': return 'secondary'
      case 'draft': return 'outline'
      case 'expired': return 'destructive'
      default: return 'outline'
    }
  }

  const validUntil = proposal.valid_until
    ? new Date(proposal.valid_until).toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    : 'N/A'

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
