'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCreateInvoice, useClients, useProjects } from '@/lib/api/hooks'
import { useAuth } from '@/contexts/AuthContext'
import { InvoiceCreate, InvoiceItemCreate } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Plus, Trash2 } from 'lucide-react'
import { toCents, formatCurrency } from '@/lib/utils/money'
import { useTranslations } from 'next-intl'

export const dynamic = 'force-dynamic'

interface InvoiceItemForm {
  description: string
  quantity: number
  unit_price: string // Display format
  category: string
}

function NewInvoiceForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectId = searchParams.get('project') || ''
  const clientId = searchParams.get('client') || ''
  const t = useTranslations('financials.pages.invoicesNew')
  const tCommon = useTranslations('common')

  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<InvoiceItemForm[]>([
    { description: '', quantity: 1, unit_price: '0.00', category: '' }
  ])

  const { organizationId, isLoading: isLoadingOrg } = useAuth()

  const { data: clients } = useClients(organizationId || undefined)
  const { data: projects } = useProjects(organizationId || undefined)
  const createInvoice = useCreateInvoice(organizationId || undefined)

  if (isLoadingOrg) {
    return <div>{tCommon('loading')}</div>
  }

  if (!organizationId) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{t('errors.organizationMissing')}</AlertDescription>
      </Alert>
    )
  }

  const addItem = () => {
    setItems([...items, { description: '', quantity: 1, unit_price: '0.00', category: '' }])
  }

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index))
    }
  }

  const updateItem = (index: number, field: keyof InvoiceItemForm, value: string | number) => {
    const updatedItems = [...items]
    updatedItems[index] = { ...updatedItems[index], [field]: value }
    setItems(updatedItems)
  }

  const calculateSubtotal = () => {
    return items.reduce((total, item) => {
      const unitPrice = parseFloat(item.unit_price) || 0
      return total + (unitPrice * item.quantity)
    }, 0)
  }

  const calculateTax = (subtotal: number) => {
    // Simple tax calculation - 10% for demo
    return subtotal * 0.10
  }

  const calculateTotal = () => {
    const subtotal = calculateSubtotal()
    const tax = calculateTax(subtotal)
    return subtotal + tax
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const formData = new FormData(e.currentTarget)
    const selectedClientId = formData.get('client_id') as string
    const selectedProjectId = (formData.get('project_id') as string) || ''

    if (!selectedClientId) {
      setError(t('errors.clientRequired'))
      return
    }

    // Validate items
    const validItems = items.filter(item =>
      item.description.trim() && item.quantity > 0 && parseFloat(item.unit_price) > 0
    )

    if (validItems.length === 0) {
      setError(t('errors.itemsRequired'))
      return
    }

    try {
      const invoiceItems: InvoiceItemCreate[] = validItems.map(item => {
        const unitPriceCents = toCents(parseFloat(item.unit_price))
        const totalCents = Math.round(unitPriceCents * item.quantity)
        const cleanItemProjectId = selectedProjectId && selectedProjectId.trim() !== '' ? selectedProjectId : undefined

        const invoiceItem: InvoiceItemCreate = {
          description: item.description.trim(),
          quantity: item.quantity,
          unit_price_cents: unitPriceCents,
          total_cents: totalCents,
        }

        if (item.category && item.category.trim()) {
          invoiceItem.category = item.category
        }

        if (cleanItemProjectId) {
          invoiceItem.project_id = cleanItemProjectId
        }

        return invoiceItem
      })

      const cleanProjectId = selectedProjectId && selectedProjectId.trim() !== '' ? selectedProjectId : undefined
      const cleanDescription = formData.get('description') as string
      const cleanNotes = formData.get('notes') as string

      const invoiceData: InvoiceCreate = {
        client_id: selectedClientId,
        ...(cleanProjectId && { project_id: cleanProjectId }),
        items: invoiceItems,
        due_date: formData.get('due_date') as string,
        ...(cleanDescription && cleanDescription.trim() && { description: cleanDescription.trim() }),
        ...(cleanNotes && cleanNotes.trim() && { notes: cleanNotes.trim() }),
        currency: 'BRL',
      }

      console.log('Creating invoice with data:', JSON.stringify(invoiceData, null, 2))
      await createInvoice.mutateAsync(invoiceData)
      router.push('/financials?tab=invoices')
    } catch (err: unknown) {
      const error = err as Error
      setError(error.message || t('errors.createFailed'))
    }
  }

  const subtotal = calculateSubtotal()
  const tax = calculateTax(subtotal)
  const total = calculateTotal()

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground">
          {t('subtitle')}
        </p>
      </div>

      <Card>
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>{t('form.title')}</CardTitle>
            <CardDescription>
              {t('form.description')}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Client and Project Selection */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="client_id">{t('fields.client.label')}</Label>
                <Select name="client_id" defaultValue={clientId} required>
                  <SelectTrigger>
                    <SelectValue placeholder={t('fields.client.placeholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {clients?.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="project_id">{t('fields.project.label')}</Label>
                <Select name="project_id" defaultValue={projectId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('fields.project.placeholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {projects?.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Due Date */}
            <div className="space-y-2">
              <Label htmlFor="due_date">{t('fields.dueDate.label')}</Label>
              <Input
                id="due_date"
                name="due_date"
                type="date"
                required
              />
            </div>

            {/* Invoice Items */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">{t('items.title')}</h3>
                <Button type="button" onClick={addItem} variant="outline" size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  {t('items.add')}
                </Button>
              </div>

              <div className="space-y-4">
                {items.map((item, index) => (
                  <Card key={index}>
                    <CardContent className="pt-6">
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <div className="space-y-2">
                          <Label>{t('items.fields.description')}</Label>
                          <Input
                            placeholder={t('items.fields.descriptionPlaceholder')}
                            value={item.description}
                            onChange={(e) => updateItem(index, 'description', e.target.value)}
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>{t('items.fields.quantity')}</Label>
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>{t('items.fields.unitPrice')}</Label>
                          <Input
                            placeholder={t('items.fields.unitPricePlaceholder')}
                            value={item.unit_price}
                            onChange={(e) => updateItem(index, 'unit_price', e.target.value)}
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>{t('items.fields.category')}</Label>
                          <Select
                            value={item.category}
                            onValueChange={(value) => updateItem(index, 'category', value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={t('items.fields.categoryPlaceholder')} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pre_production">{t('categories.pre_production')}</SelectItem>
                              <SelectItem value="production">{t('categories.production')}</SelectItem>
                              <SelectItem value="post_production">{t('categories.post_production')}</SelectItem>
                              <SelectItem value="marketing">{t('categories.marketing')}</SelectItem>
                              <SelectItem value="other">{t('categories.other')}</SelectItem>
                            </SelectContent>
                          </Select>
                          {items.length > 1 && (
                            <Button
                              type="button"
                              onClick={() => removeItem(index)}
                              variant="destructive"
                              size="sm"
                              className="mt-2"
                            >
                              <Trash2 className="mr-2 h-3 w-3" />
                              {t('items.remove')}
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Description and Notes */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="description">{t('fields.description.label')}</Label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder={t('fields.description.placeholder')}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">{t('fields.notes.label')}</Label>
                <Textarea
                  id="notes"
                  name="notes"
                  placeholder={t('fields.notes.placeholder')}
                  rows={3}
                />
              </div>
            </div>

            {/* Invoice Summary */}
            <Card>
              <CardHeader>
                <CardTitle>{t('summary.title')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span>{t('summary.subtotal')}</span>
                  <span>{formatCurrency(toCents(subtotal))}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('summary.tax', { rate: 10 })}</span>
                  <span>{formatCurrency(toCents(tax))}</span>
                </div>
                <div className="border-t pt-4 flex justify-between font-bold text-lg">
                  <span>{t('summary.total')}</span>
                  <span>{formatCurrency(toCents(total))}</span>
                </div>
              </CardContent>
            </Card>
          </CardContent>

          <CardFooter className="flex justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
            >
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={createInvoice.isPending}>
              {createInvoice.isPending ? t('actions.creating') : t('actions.create')}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}

export default function NewInvoicePage() {
  const tCommon = useTranslations('common')
  return (
    <Suspense fallback={<div>{tCommon('loading')}</div>}>
      <NewInvoiceForm />
    </Suspense>
  )
}
