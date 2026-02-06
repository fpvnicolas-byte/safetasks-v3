'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useCreateProposal, useClients, useServices } from '@/lib/api/hooks'
import { useAuth } from '@/contexts/AuthContext'
import { useErrorDialog } from '@/lib/hooks/useErrorDialog'
import { ProposalCreate, ProposalStatus, ProposalLineItem, formatCurrency, toCents } from '@/types'
import { Button } from '@/components/ui/button'
import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorDialog } from '@/components/ui/error-dialog'
import { FinancialLinesPanel } from '../_components/FinancialLinesPanel'


export default function NewProposalPage() {
  const router = useRouter()
  const { organizationId } = useAuth()
  const t = useTranslations('proposals')
  const tCommon = useTranslations('common')
  const { errorDialog, showError, closeError } = useErrorDialog()
  const [selectedClientId, setSelectedClientId] = useState<string>('')
  const [selectedServices, setSelectedServices] = useState<string[]>([])
  const [lineItems, setLineItems] = useState<ProposalLineItem[]>([])
  const [currency, setCurrency] = useState('BRL')
  const [status, setStatus] = useState<ProposalStatus>('draft')
  const [discountInput, setDiscountInput] = useState('')

  const { data: clients, isLoading: clientsLoading } = useClients(organizationId || undefined)
  const { data: services, isLoading: servicesLoading } = useServices(organizationId || undefined)
  const createProposal = useCreateProposal()
  const discountCents = toCents(parseFloat(discountInput) || 0)
  const servicesTotalCents = (services?.filter(s => selectedServices.includes(s.id))
    .reduce((sum, s) => sum + (s.value_cents || 0), 0) || 0)
  const lineItemsTotalCents = lineItems.reduce((sum, item) => sum + (item.value_cents || 0), 0)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!selectedClientId) {
      showError({ message: t('validation.clientRequired') }, tCommon('error'))
      return
    }

    const formData = new FormData(e.currentTarget)

    try {
      const data: ProposalCreate = {
        client_id: selectedClientId,
        title: (formData.get('title') as string).trim(),
        description: (formData.get('description') as string || '').trim() || undefined,
        status: status,
        valid_until: (formData.get('valid_until') as string) || undefined,
        start_date: (formData.get('start_date') as string) || undefined,
        end_date: (formData.get('end_date') as string) || undefined,
        // Send base amount, backend calculates total
        base_amount_cents: discountCents ? -discountCents : 0,
        currency: currency,
        terms_conditions: (formData.get('terms_conditions') as string || '').trim() || undefined,
        service_ids: selectedServices.length > 0 ? selectedServices : undefined,
        proposal_metadata: {
          line_items: lineItems
        }
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
            <CardTitle>{t('createTitle')}</CardTitle>
            <CardDescription>{t('createDescription')}</CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">

            {/* Client Selection */}
            <div className="space-y-2">
              <Label htmlFor="client">{t('client')} *</Label>
              {clientsLoading ? (
                <div className="text-sm text-muted-foreground">{tCommon('loading')}</div>
              ) : clients && clients.length > 0 ? (
                <Select value={selectedClientId} onValueChange={setSelectedClientId} required>
                  <SelectTrigger>
                    <SelectValue placeholder={t('selectClient')} />
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
                  <p className="text-sm text-muted-foreground">{t('noClients')}</p>
                  <Button asChild size="sm" variant="outline">
                    <Link href="/clients/new">{tCommon('create')} {t('client')}</Link>
                  </Button>
                </div>
              )}
            </div>

            {/* Basic Info */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">{t('proposalTitle')} *</Label>
                <Input
                  id="title"
                  name="title"
                  placeholder={t('placeholders.title')}
                  required
                />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="status">{t('status')}</Label>
                  <Select value={status} onValueChange={(value) => setStatus(value as ProposalStatus)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">{t('draft')}</SelectItem>
                      <SelectItem value="sent">{t('sent')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="start_date">{t('detail.badges.estStart').replace(':', '')}</Label>
                  <Input
                    id="start_date"
                    name="start_date"
                    type="date"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="end_date">{t('detail.badges.estEnd').replace(':', '')}</Label>
                  <Input
                    id="end_date"
                    name="end_date"
                    type="date"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="valid_until">{t('card.validUntil').replace(':', '')}</Label>
                  <Input
                    id="valid_until"
                    name="valid_until"
                    type="date"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">{t('detail.descriptionCard.title')}</Label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder={t('placeholders.description')}
                  rows={3}
                />
              </div>

              {/* Services */}
              <div className="space-y-2">
                <Label>{t('detail.financials.services')}</Label>
                <Card className="p-4">
                  {servicesLoading ? (
                    <div className="text-sm text-muted-foreground p-2">{tCommon('loading')}</div>
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
                      <p>{t('noServices')}</p>
                      <Button variant="link" asChild className="px-0 h-auto">
                        <Link href="/settings/services">{t('manageServices')}</Link>
                      </Button>
                    </div>
                  )}
                </Card>
              </div>

            </div>

            {/* Financials */}
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4 mb-2">
                <h3 className="text-lg font-bold tracking-tight text-foreground">{t('detail.financials.title')}</h3>
                <div className="flex items-center gap-2 min-w-[120px]">
                  <Label htmlFor="currency" className="text-xs font-bold uppercase text-muted-foreground">{t('detail.financials.currencyNote').replace(':', '')}</Label>
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
                    <Label htmlFor="discount_amount" className="text-sm font-bold text-foreground">{t('detail.financials.discount')}</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-bold">{currency === 'USD' ? '$' : currency === 'EUR' ? '€' : 'R$'}</span>
                      <Input
                        id="discount_amount"
                        name="discount_amount"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        className="h-11 pl-10 text-base font-bold bg-muted/20"
                        value={discountInput}
                        onChange={(e) => setDiscountInput(e.target.value)}
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-tight">
                      Subtracts from the total. Set to 0 to remove.
                    </p>
                  </div>
                </div>
              </div>

              {/* Dynamic Calculation Preview */}
              <div className="rounded-xl border border-primary/20 bg-primary/[0.02] overflow-hidden shadow-sm">
                <div className="px-4 py-2.5 bg-primary/5 border-b border-primary/10">
                  <span className="text-[10px] uppercase font-bold text-primary tracking-widest cursor-default">{t('detail.financials.totalInvestment')}</span>
                </div>

                <div className="p-4 space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <div className="flex flex-col">
                      <span className="text-muted-foreground font-medium">{t('detail.financials.services')}</span>
                      <span className="text-[10px] text-muted-foreground/60 leading-none">Predefined rates</span>
                    </div>
                    <span className="font-mono text-foreground font-semibold">
                      {formatCurrency(servicesTotalCents, currency)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-sm">
                    <div className="flex flex-col">
                      <span className="text-muted-foreground font-medium">{t('detail.financials.additionalItems')}</span>
                      <span className="text-[10px] text-muted-foreground/60 leading-none">Custom additions</span>
                    </div>
                    <span className="font-mono text-info font-semibold">
                      {formatCurrency(lineItemsTotalCents, currency)}
                    </span>
                  </div>

                  {discountCents > 0 ? (
                    <div className="flex justify-between items-center text-sm italic">
                      <div className="flex flex-col">
                        <span className="text-muted-foreground font-medium">{t('detail.financials.discount')}</span>
                        <span className="text-[10px] text-muted-foreground/60 leading-none">Adjustment</span>
                      </div>
                      <span className="font-mono text-secondary-foreground font-semibold">
                        {formatCurrency(-discountCents, currency)}
                      </span>
                    </div>
                  ) : null}

                  <div className="flex justify-between items-center border-t border-primary/10 pt-3 mt-1">
                    <span className="text-sm font-bold text-primary">{t('detail.financials.finalTotal')}</span>
                    <div className="flex flex-col items-end">
                      <span className="text-xl font-black text-primary font-mono tracking-tighter">
                        {formatCurrency(
                          (servicesTotalCents + lineItemsTotalCents - discountCents),
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
              <Label htmlFor="terms_conditions">{t('detail.termsConditions.title')}</Label>
              <Textarea
                id="terms_conditions"
                name="terms_conditions"
                placeholder={t('placeholders.terms')}
                rows={4}
              />
            </div>
          </CardContent>

          <CardFooter className="flex justify-between">
            <Button
              type="button"
              variant="outline"
              asChild
            >
              <Link href="/proposals">{tCommon('cancel')}</Link>
            </Button>
            <Button
              type="submit"
              disabled={createProposal.isPending || !selectedClientId}
            >
              {createProposal.isPending ? t('creating') : t('createAction')}
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
