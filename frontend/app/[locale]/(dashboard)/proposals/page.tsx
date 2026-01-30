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

export default function ProposalsPage() {
  const { organizationId } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<ProposalStatus | 'all'>('all')

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

  const handleDeleteProposal = async (proposalId: string, title: string) => {
    if (!confirm(`Are you sure you want to delete proposal "${title}"? This action cannot be undone.`)) {
      return
    }

    try {
      await deleteProposal.mutateAsync(proposalId)
    } catch (err: unknown) {
      const error = err as Error
      alert(`Failed to delete proposal: ${error.message}`)
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Proposals</h1>
          <p className="text-muted-foreground">
            Create and manage client proposals
          </p>
        </div>
        <Button asChild>
          <Link href="/proposals/new">
            <Plus className="mr-2 h-4 w-4" />
            New Proposal
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filter Proposals</CardTitle>
          <CardDescription>
            Find proposals by title or status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Title or description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as ProposalStatus | 'all')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Results</label>
              <div className="flex items-center justify-center h-10 px-3 py-2 bg-muted rounded-md">
                <span className="text-sm font-medium">
                  {filteredProposals.length} proposal{filteredProposals.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Proposals Grid */}
      {isLoading ? (
        <div>Loading proposals...</div>
      ) : error ? (
        <div>Error loading proposals: {error.message}</div>
      ) : filteredProposals.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredProposals.map((proposal) => (
            <ProposalCard
              key={proposal.id}
              proposal={proposal}
              onDelete={() => handleDeleteProposal(proposal.id, proposal.title)}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No Proposals Found</CardTitle>
            <CardDescription>
              {searchQuery || statusFilter !== 'all'
                ? 'No proposals match your current filters'
                : 'Get started by creating your first proposal'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground mb-4">
                Proposals allow you to send estimates to clients and track approvals
              </p>
              <Button asChild>
                <Link href="/proposals/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Proposal
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

interface ProposalCardProps {
  proposal: Proposal
  onDelete: () => void
}

function ProposalCard({ proposal, onDelete }: ProposalCardProps) {
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
  const validUntil = proposal.valid_until ? new Date(proposal.valid_until).toLocaleDateString() : 'N/A'

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1 mr-2">
            <CardTitle className="text-lg line-clamp-1">{proposal.title}</CardTitle>
            <CardDescription className="line-clamp-1">
              {/* If client name was available in list, we'd show it. For now show date */}
              Created {new Date(proposal.created_at).toLocaleDateString()}
            </CardDescription>
          </div>
          <Badge variant={getStatusVariant(proposal.status)}>
            {proposal.status.charAt(0).toUpperCase() + proposal.status.slice(1)}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex justify-between items-center text-sm">
          <span className="text-muted-foreground">Total Amount</span>
          <span className="font-semibold text-lg">
            {proposal.total_amount_cents !== null ? formatCurrency(proposal.total_amount_cents, proposal.currency) : 'N/A'}
          </span>
        </div>

        {proposal.valid_until && (
          <div className="text-sm text-muted-foreground">
            Valid until: {validUntil}
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button asChild variant="outline" size="sm" className="flex-1">
            <Link href={`/proposals/${proposal.id}`}>
              <Eye className="mr-2 h-3 w-3" />
              View
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="flex-1">
            <Link href={`/proposals/${proposal.id}/edit`}>
              <Edit className="mr-2 h-3 w-3" />
              Edit
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
