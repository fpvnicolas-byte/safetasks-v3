'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useProposal, useUpdateProposal } from '@/lib/api/hooks'
import { useAuth } from '@/contexts/AuthContext'
import { useErrorDialog } from '@/lib/hooks/useErrorDialog'
import { ProposalUpdate, ProposalStatus, dollarsToCents, centsToDollars } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorDialog } from '@/components/ui/error-dialog'

export default function EditProposalPage() {
  const router = useRouter()
  const params = useParams()
  const { organizationId } = useAuth()
  const proposalId = params.id as string

  const { errorDialog, showError, closeError } = useErrorDialog()
  const { data: proposal, isLoading } = useProposal(proposalId)
  const updateProposal = useUpdateProposal()

  if (isLoading) {
    return <div>Loading proposal...</div>
  }

  if (!proposal) {
    return <div className="p-8 text-destructive">Proposal not found</div>
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    const formData = new FormData(e.currentTarget)

    try {
      const amountDollars = parseFloat(formData.get('total_amount') as string || '0')

      const data: ProposalUpdate = {
        title: (formData.get('title') as string).trim(),
        description: (formData.get('description') as string || '').trim() || undefined,
        status: formData.get('status') as ProposalStatus,
        valid_until: (formData.get('valid_until') as string) || undefined,
        total_amount_cents: amountDollars ? dollarsToCents(amountDollars) : undefined,
        currency: (formData.get('currency') as string) || 'BRL',
        terms_conditions: (formData.get('terms_conditions') as string || '').trim() || undefined,
      }

      await updateProposal.mutateAsync({ proposalId, data })
      router.push(`/proposals/${proposalId}`)
    } catch (err: any) {
      console.error('Update proposal error:', err)
      showError(err, 'Error Updating Proposal')
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>Edit Proposal</CardTitle>
            <CardDescription>Update proposal details</CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">

            {/* Basic Info */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  name="title"
                  defaultValue={proposal.title}
                  required
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select name="status" defaultValue={proposal.status}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="sent">Sent</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                      <SelectItem value="expired">Expired</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="valid_until">Valid Until</Label>
                  <Input
                    id="valid_until"
                    name="valid_until"
                    type="date"
                    defaultValue={proposal.valid_until || ''}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  defaultValue={proposal.description || ''}
                  rows={3}
                />
              </div>
            </div>

            {/* Financials */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Financial Details</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="total_amount">Total Amount</Label>
                  <Input
                    id="total_amount"
                    name="total_amount"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={proposal.total_amount_cents ? centsToDollars(proposal.total_amount_cents) : ''}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Select name="currency" defaultValue={proposal.currency}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BRL">BRL (R$)</SelectItem>
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="EUR">EUR (€)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Terms */}
            <div className="space-y-2">
              <Label htmlFor="terms_conditions">Terms & Conditions</Label>
              <Textarea
                id="terms_conditions"
                name="terms_conditions"
                defaultValue={proposal.terms_conditions || ''}
                rows={4}
              />
            </div>
          </CardContent>

          <CardFooter className="flex justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={updateProposal.isPending}
            >
              {updateProposal.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </CardFooter>
        </form>
      </Card>

      <ErrorDialog
        open={errorDialog.open}
        onOpenChange={closeError}
        title={errorDialog.title}
        message={errorDialog.message}
        validationErrors={errorDialog.validationErrors}
        statusCode={errorDialog.statusCode}
      />
    </div>
  )
}
