'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  useInvoice,
  useUpdateInvoice,
  useAddInvoiceItem,
  useUpdateInvoiceItem,
  useDeleteInvoiceItem
} from '@/lib/api/hooks'
import { useAuth } from '@/contexts/AuthContext'
import { InvoiceItemCreate, Invoice } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Plus, Trash2 } from 'lucide-react'
import { dollarsToCents, formatCurrency, centsToDollars } from '@/lib/utils/money'
import { useTranslations } from 'next-intl'

interface InvoiceItemForm {
  id?: string
  description: string
  quantity: number
  unit_price: string
  category: string
}

export default function EditInvoicePage() {
  const router = useRouter()
  const params = useParams()
  const invoiceId = params.id as string
  const t = useTranslations('financials.pages.invoicesEdit')
  const tCommon = useTranslations('common')

  const { organizationId } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<InvoiceItemForm[]>([])

  const { data: invoice, isLoading } = useInvoice(invoiceId, organizationId || undefined)
  const updateInvoice = useUpdateInvoice(organizationId || undefined)
  const addItem = useAddInvoiceItem(invoiceId)
  const deleteItem = useDeleteInvoiceItem(invoiceId)

  // Initialize items from invoice data
  useState(() => {
    if (invoice?.items) {
      setItems(invoice.items.map(item => ({
        id: item.id,
        description: item.description,
        quantity: Number(item.quantity),
        unit_price: centsToDollars(item.unit_price_cents).toFixed(2),
        category: ''
      })))
    }
  })

  if (isLoading) {
    return <div>{t('loading')}</div>
  }

  if (!invoice) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{t('errors.notFound')}</AlertDescription>
      </Alert>
    )
  }

  const isDraft = invoice.status === 'draft'
  const canEditItems = isDraft

  const addNewItem = () => {
    setItems([...items, { description: '', quantity: 1, unit_price: '0.00', category: '' }])
  }

  const removeItem = async (index: number) => {
    const item = items[index]

    if (item.id) {
      // Delete from backend
      try {
        await deleteItem.mutateAsync(item.id)
        setItems(items.filter((_, i) => i !== index))
      } catch (err: unknown) {
        const error = err as Error
        setError(t('errors.deleteItem', { message: error.message }))
      }
    } else {
      // Just remove from UI (not saved yet)
      setItems(items.filter((_, i) => i !== index))
    }
  }

  const updateItemField = (index: number, field: keyof InvoiceItemForm, value: string | number) => {
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

  async function handleSaveItems() {
    setError(null)

    try {
      // Add/update items
      for (const item of items) {
        if (!item.description || item.quantity <= 0 || parseFloat(item.unit_price) <= 0) {
          continue // Skip invalid items
        }

        const itemData: InvoiceItemCreate = {
          description: item.description,
          quantity: item.quantity,
          unit_price_cents: dollarsToCents(parseFloat(item.unit_price)),
          total_cents: dollarsToCents(parseFloat(item.unit_price) * item.quantity),
          category: item.category || undefined
        }

        if (!item.id) {
          // Add new item
          await addItem.mutateAsync(itemData)
        }
        // Note: Updates would need useUpdateInvoiceItem implementation
      }

      router.push(`/financials/invoices/${invoiceId}`)
  } catch (err: unknown) {
    const error = err as Error
    setError(error.message || t('errors.saveItems'))
  }
  }

  async function handleUpdateStatus(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const formData = new FormData(e.currentTarget)

    try {
      const data: Partial<Invoice> = {
        status: formData.get('status') as Invoice['status'],
        due_date: formData.get('due_date') as string,
      }

      await updateInvoice.mutateAsync({ invoiceId, data })
      router.push(`/financials/invoices/${invoiceId}`)
  } catch (err: unknown) {
    const error = err as Error
    setError(error.message || t('errors.updateInvoice'))
  }
  }

  const subtotal = calculateSubtotal()
  const tax = invoice.tax_amount_cents / 100
  const total = subtotal + tax

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('title', { number: invoice.invoice_number })}</h1>
        <p className="text-muted-foreground">
          {canEditItems ? t('subtitle.editItems') : t('subtitle.updateStatus')}
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!canEditItems && (
        <Alert>
          <AlertDescription>
            {t('warnings.readOnly', { status: t(`status.${invoice.status}`) })}
          </AlertDescription>
        </Alert>
      )}

      {/* Line Items Section */}
      {canEditItems && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{t('items.title')}</CardTitle>
                <CardDescription>{t('items.description')}</CardDescription>
              </div>
              <Button type="button" onClick={addNewItem} size="sm">
                <Plus className="mr-2 h-4 w-4" />
                {t('items.add')}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {items.map((item, index) => (
              <div key={index} className="grid gap-4 md:grid-cols-4 p-4 border rounded">
                <div className="md:col-span-2">
                  <Label>{t('items.fields.description')}</Label>
                  <Input
                    placeholder={t('items.fields.descriptionPlaceholder')}
                    value={item.description}
                    onChange={(e) => updateItemField(index, 'description', e.target.value)}
                  />
                </div>
                <div>
                  <Label>{t('items.fields.quantity')}</Label>
                  <Input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => updateItemField(index, 'quantity', parseInt(e.target.value) || 1)}
                  />
                </div>
                <div>
                  <Label>{t('items.fields.unitPrice')}</Label>
                  <Input
                    placeholder={t('items.fields.unitPricePlaceholder')}
                    value={item.unit_price}
                    onChange={(e) => updateItemField(index, 'unit_price', e.target.value)}
                  />
                </div>
                <div className="md:col-span-4 flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    {t('items.total', { total: formatCurrency(dollarsToCents(parseFloat(item.unit_price || '0') * item.quantity)) })}
                  </span>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => removeItem(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}

            <div className="pt-4 border-t space-y-2">
              <div className="flex justify-between">
                <span>{t('summary.subtotal')}</span>
                <span>{formatCurrency(dollarsToCents(subtotal))}</span>
              </div>
              <div className="flex justify-between">
                <span>{t('summary.tax')}</span>
                <span>{formatCurrency(invoice.tax_amount_cents)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg">
                <span>{t('summary.total')}</span>
                <span>{formatCurrency(dollarsToCents(total))}</span>
              </div>
            </div>

            <Button onClick={handleSaveItems} disabled={addItem.isPending || deleteItem.isPending}>
              {addItem.isPending || deleteItem.isPending ? t('actions.saving') : t('actions.saveItems')}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Status Update Form */}
      <Card>
        <form onSubmit={handleUpdateStatus}>
          <CardHeader>
            <CardTitle>{t('statusForm.title')}</CardTitle>
            <CardDescription>{t('statusForm.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="status">{t('statusForm.fields.status')}</Label>
                <Select name="status" defaultValue={invoice.status}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">{t('status.draft')}</SelectItem>
                    <SelectItem value="sent">{t('status.sent')}</SelectItem>
                    <SelectItem value="paid">{t('status.paid')}</SelectItem>
                    <SelectItem value="overdue">{t('status.overdue')}</SelectItem>
                    <SelectItem value="cancelled">{t('status.cancelled')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="due_date">{t('statusForm.fields.dueDate')}</Label>
                <Input
                  id="due_date"
                  name="due_date"
                  type="date"
                  defaultValue={invoice.due_date}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => router.back()}>
                {tCommon('cancel')}
              </Button>
              <Button type="submit" disabled={updateInvoice.isPending}>
                {updateInvoice.isPending ? t('actions.updating') : t('actions.updateStatus')}
              </Button>
            </div>
          </CardContent>
        </form>
      </Card>
    </div>
  )
}
