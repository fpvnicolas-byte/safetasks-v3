'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useProposal, useUpdateProposal, useServices } from '@/lib/api/hooks'
import { useAuth } from '@/contexts/AuthContext'
import { useErrorDialog } from '@/lib/hooks/useErrorDialog'
import { ProposalUpdate, ProposalStatus, dollarsToCents, centsToDollars, ProposalLineItem, formatCurrency } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { ErrorDialog } from '@/components/ui/error-dialog'
import { FinancialLinesPanel } from '../../_components/FinancialLinesPanel'

export default function EditProposalPage() {
  const router = useRouter()
  const params = useParams()
  const { organizationId } = useAuth()
  const proposalId = params.id as string

  const { errorDialog, showError, closeError } = useErrorDialog()
  const { data: proposal, isLoading } = useProposal(proposalId)
  const { data: services, isLoading: servicesLoading } = useServices(organizationId || undefined)
  const updateProposal = useUpdateProposal()

  const [selectedServices, setSelectedServices] = useState<string[]>([])
  const [lineItems, setLineItems] = useState<ProposalLineItem[]>([])
  const [currency, setCurrency] = useState('BRL')

  // Initialize selected services when proposal data loads
  useEffect(() => {
    if (proposal?.services) {
      setSelectedServices(proposal.services.map(s => s.id))
    }
    if (proposal?.proposal_metadata?.line_items) {
      setLineItems(proposal.proposal_metadata.line_items)
    }
    if (proposal?.currency) {
      setCurrency(proposal.currency)
    }
  }, [proposal])

  const totalLineItemsCents = lineItems.reduce((sum, item) => sum + (item.value_cents || 0), 0)

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
      const baseAmountDollars = parseFloat(formData.get('base_amount') as string || '0')

      const data: ProposalUpdate = {
        title: (formData.get('title') as string).trim(),
        description: (formData.get('description') as string || '').trim() || undefined,
        status: formData.get('status') as ProposalStatus,
        valid_until: (formData.get('valid_until') as string) || undefined,
        start_date: (formData.get('start_date') as string) || undefined,
        end_date: (formData.get('end_date') as string) || undefined,
        // Send base amount, backend calculates total
        base_amount_cents: baseAmountDollars ? dollarsToCents(baseAmountDollars) : 0,
        currency: currency,
        terms_conditions: (formData.get('terms_conditions') as string || '').trim() || undefined,
        service_ids: selectedServices.length > 0 ? selectedServices : undefined,
        proposal_metadata: {
          ...(proposal?.proposal_metadata || {}),
          line_items: lineItems
        }
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

            {/* Client Selection (Read-only for now to avoid complexity with project transfer) */}
            <div className="space-y-2">
              <Label>Client (linked)</Label>
              <div className="text-base font-medium px-3 py-2 border rounded-md bg-muted">
                {proposal.client ? proposal.client.name : 'Loading client...'}
              </div>
              <p className="text-xs text-muted-foreground">Client cannot be changed after proposal creation.</p>
            </div>

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

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select name="status" defaultValue={proposal.status}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="sent">Sent</SelectItem>
                      {/* Removed 'approved'/'rejected' to enforce workflow actions */}
                      <SelectItem value="expired">Expired</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Use the "Approve" button on the detail page to finalize.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="start_date">Est. Start Date</Label>
                  <Input
                    id="start_date"
                    name="start_date"
                    type="date"
                    defaultValue={proposal.start_date || ''}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="end_date">Est. End Date</Label>
                  <Input
                    id="end_date"
                    name="end_date"
                    type="date"
                    defaultValue={proposal.end_date || ''}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="valid_until">Proposal Valid Until</Label>
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

            {/* Services */}
            <div className="space-y-2">
              <Label>Services</Label>
              <Card className="p-4 border-dashed shadow-none">
                {servicesLoading ? (
                  <div className="text-sm text-muted-foreground p-2">Loading services...</div>
                ) : services && services.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {services.map((service) => (
                      <div key={service.id} className="flex items-start space-x-2">
                        <Checkbox
                          id={`service-${service.id}`}
                          checked={selectedServices.includes(service.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedServices([...selectedServices, service.id])
                            } else {
                              setSelectedServices(selectedServices.filter(id => id !== service.id))
                            }
                          }}
                        />
                        <div className="grid gap-1.5 leading-none">
                          <Label
                            htmlFor={`service-${service.id}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            {service.name}
                          </Label>
                          {service.description && (
                            <p className="text-xs text-muted-foreground">
                              {service.description}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground p-2 text-center">
                    <p>No services defined.</p>
                    <Button variant="link" asChild className="px-0 h-auto">
                      <Link href="/settings/services">Manage Services</Link>
                    </Button>
                  </div>
                )}
              </Card>
            </div>

            {/* Financials */}
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4 mb-2">
                <h3 className="text-lg font-bold tracking-tight text-foreground">Financial Details</h3>
                <div className="flex items-center gap-2 min-w-[120px]">
                  <Label htmlFor="currency" className="text-xs font-bold uppercase text-muted-foreground">Currency</Label>
                  <Select
                    name="currency"
                    value={currency}
                    onValueChange={setCurrency}
                  >
                    <SelectTrigger className="h-8 text-xs font-bold">
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

              <div className="grid gap-6 md:grid-cols-1">
                <div className="space-y-6">
                  <FinancialLinesPanel
                    items={lineItems}
                    onChange={setLineItems}
                    currency={currency}
                  />

                  <div className="space-y-3 pt-4 border-t border-muted/50">
                    <Label htmlFor="base_amount" className="text-sm font-bold text-foreground">Additional Raw Amount (Manual Offset)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-bold">{currency === 'USD' ? '$' : currency === 'EUR' ? '€' : 'R$'}</span>
                      <Input
                        id="base_amount"
                        name="base_amount"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        className="h-11 pl-10 text-base font-bold bg-muted/20"
                        defaultValue={proposal.base_amount_cents ? centsToDollars(proposal.base_amount_cents) : ''}
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-tight">
                      Additional manual adjustment to the total beyond services and line items.
                    </p>
                  </div>
                </div>
              </div>

              {/* Dynamic Calculation Preview */}
              <div className="rounded-xl border border-primary/20 bg-primary/[0.02] overflow-hidden shadow-sm">
                <div className="px-4 py-2.5 bg-primary/5 border-b border-primary/10">
                  <span className="text-[10px] uppercase font-bold text-primary tracking-widest cursor-default">Investment Summary</span>
                </div>

                <div className="p-4 space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <div className="flex flex-col">
                      <span className="text-muted-foreground font-medium">Services</span>
                      <span className="text-[10px] text-muted-foreground/60 leading-none">Predefined rates</span>
                    </div>
                    <span className="font-mono text-foreground font-semibold">
                      {formatCurrency(
                        (services?.filter(s => selectedServices.includes(s.id))
                          .reduce((sum, s) => sum + (s.value_cents || 0), 0) || 0),
                        currency
                      )}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-sm">
                    <div className="flex flex-col">
                      <span className="text-muted-foreground font-medium">Line Items</span>
                      <span className="text-[10px] text-muted-foreground/60 leading-none">Custom additions</span>
                    </div>
                    <span className="font-mono text-info font-semibold">
                      {formatCurrency(totalLineItemsCents, currency)}
                    </span>
                  </div>

                  {proposal.base_amount_cents ? (
                    <div className="flex justify-between items-center text-sm italic">
                      <div className="flex flex-col">
                        <span className="text-muted-foreground font-medium">Manual Offset</span>
                        <span className="text-[10px] text-muted-foreground/60 leading-none">Adjustment</span>
                      </div>
                      <span className="font-mono text-secondary-foreground font-semibold">
                        {formatCurrency(proposal.base_amount_cents, currency)}
                      </span>
                    </div>
                  ) : null}

                  <div className="flex justify-between items-center border-t border-primary/10 pt-3 mt-1">
                    <span className="text-sm font-bold text-primary">Expected Total</span>
                    <div className="flex flex-col items-end">
                      <span className="text-xl font-black text-primary font-mono tracking-tighter">
                        {formatCurrency(
                          ((services?.filter(s => selectedServices.includes(s.id))
                            .reduce((sum, s) => sum + (s.value_cents || 0), 0) || 0) +
                            totalLineItemsCents +
                            (proposal.base_amount_cents || 0)),
                          currency
                        )}
                      </span>
                      <span className="text-[9px] uppercase font-bold text-muted-foreground/40 leading-none">{currency}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Terms */}
            <div className="space-y-2 mt-6">
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
