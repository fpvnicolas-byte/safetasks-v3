'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useCreateProposal, useClients } from '@/lib/api/hooks'
import { useAuth } from '@/contexts/AuthContext'
import { useErrorDialog } from '@/lib/hooks/useErrorDialog'
import { ProposalCreate, ProposalStatus } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorDialog } from '@/components/ui/error-dialog'
import { dollarsToCents } from '@/types'

export default function NewProposalPage() {
  const router = useRouter()
  const { organizationId } = useAuth()
  const { errorDialog, showError, closeError } = useErrorDialog()
  const [selectedClientId, setSelectedClientId] = useState<string>('')
  const [status, setStatus] = useState<ProposalStatus>('draft')

  const { data: clients, isLoading: clientsLoading } = useClients(organizationId || undefined)
  const createProposal = useCreateProposal()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!selectedClientId) {
      showError({ message: 'Please select a client' }, 'Validation Error')
      return
    }

    const formData = new FormData(e.currentTarget)

    try {
      const amountDollars = parseFloat(formData.get('total_amount') as string || '0')

      const data: ProposalCreate = {
        client_id: selectedClientId,
        title: (formData.get('title') as string).trim(),
        description: (formData.get('description') as string || '').trim() || undefined,
        status: status,
        valid_until: (formData.get('valid_until') as string) || undefined,
        total_amount_cents: amountDollars ? dollarsToCents(amountDollars) : undefined,
        currency: (formData.get('currency') as string) || 'BRL',
        terms_conditions: (formData.get('terms_conditions') as string || '').trim() || undefined,
      }

      await createProposal.mutateAsync(data)
      router.push('/proposals')
    } catch (err: any) {
      console.error('Create proposal error:', err)
      showError(err, 'Error Creating Proposal')
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>Create New Proposal</CardTitle>
            <CardDescription>Draft a new proposal for a client</CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">

            {/* Client Selection */}
            <div className="space-y-2">
              <Label htmlFor="client">Client *</Label>
              {clientsLoading ? (
                <div className="text-sm text-muted-foreground">Loading clients...</div>
              ) : clients && clients.length > 0 ? (
                <Select value={selectedClientId} onValueChange={setSelectedClientId} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">No clients found.</p>
                  <Button asChild size="sm" variant="outline">
                    <Link href="/clients/new">Create Client</Link>
                  </Button>
                </div>
              )}
            </div>

            {/* Basic Info */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  name="title"
                  placeholder="e.g., Q1 Marketing Campaign, Feature Film Production"
                  required
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={status} onValueChange={(value) => setStatus(value as ProposalStatus)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="sent">Sent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="valid_until">Valid Until</Label>
                  <Input
                    id="valid_until"
                    name="valid_until"
                    type="date"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder="Scope of work summary..."
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
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Select name="currency" defaultValue="BRL">
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
                placeholder="Payment terms, delivery schedule, etc."
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
              disabled={createProposal.isPending || !selectedClientId}
            >
              {createProposal.isPending ? 'Creating...' : 'Create Proposal'}
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
