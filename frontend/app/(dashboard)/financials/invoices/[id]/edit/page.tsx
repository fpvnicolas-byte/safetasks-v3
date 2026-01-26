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
    return <div>Loading invoice...</div>
  }

  if (!invoice) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Invoice not found</AlertDescription>
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
        setError(`Failed to delete item: ${error.message}`)
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
      setError(error.message || 'Failed to save items')
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
      setError(error.message || 'Failed to update invoice')
    }
  }

  const subtotal = calculateSubtotal()
  const tax = invoice.tax_amount_cents / 100
  const total = subtotal + tax

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Edit Invoice #{invoice.invoice_number}</h1>
        <p className="text-muted-foreground">
          {canEditItems ? 'Modify line items and invoice details' : 'Update invoice status and dates only'}
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
            This invoice is {invoice.status}. Only draft invoices can have line items edited.
            You can still update the status and dates below.
          </AlertDescription>
        </Alert>
      )}

      {/* Line Items Section */}
      {canEditItems && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Invoice Items</CardTitle>
                <CardDescription>Add, edit, or remove line items</CardDescription>
              </div>
              <Button type="button" onClick={addNewItem} size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Add Item
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {items.map((item, index) => (
              <div key={index} className="grid gap-4 md:grid-cols-4 p-4 border rounded">
                <div className="md:col-span-2">
                  <Label>Description</Label>
                  <Input
                    placeholder="Service description"
                    value={item.description}
                    onChange={(e) => updateItemField(index, 'description', e.target.value)}
                  />
                </div>
                <div>
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => updateItemField(index, 'quantity', parseInt(e.target.value) || 1)}
                  />
                </div>
                <div>
                  <Label>Unit Price (R$)</Label>
                  <Input
                    placeholder="0.00"
                    value={item.unit_price}
                    onChange={(e) => updateItemField(index, 'unit_price', e.target.value)}
                  />
                </div>
                <div className="md:col-span-4 flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    Total: {formatCurrency(dollarsToCents(parseFloat(item.unit_price || '0') * item.quantity))}
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
                <span>Subtotal:</span>
                <span>{formatCurrency(dollarsToCents(subtotal))}</span>
              </div>
              <div className="flex justify-between">
                <span>Tax:</span>
                <span>{formatCurrency(invoice.tax_amount_cents)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg">
                <span>Total:</span>
                <span>{formatCurrency(dollarsToCents(total))}</span>
              </div>
            </div>

            <Button onClick={handleSaveItems} disabled={addItem.isPending || deleteItem.isPending}>
              {addItem.isPending || deleteItem.isPending ? 'Saving...' : 'Save Items'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Status Update Form */}
      <Card>
        <form onSubmit={handleUpdateStatus}>
          <CardHeader>
            <CardTitle>Invoice Status</CardTitle>
            <CardDescription>Update invoice status and dates</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="status">Status</Label>
                <Select name="status" defaultValue={invoice.status}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="due_date">Due Date</Label>
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
                Cancel
              </Button>
              <Button type="submit" disabled={updateInvoice.isPending}>
                {updateInvoice.isPending ? 'Updating...' : 'Update Status'}
              </Button>
            </div>
          </CardContent>
        </form>
      </Card>
    </div>
  )
}
