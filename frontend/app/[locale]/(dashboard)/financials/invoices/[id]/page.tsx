'use client'

import { useParams, useRouter } from 'next/navigation'
import { useInvoice, useDeleteInvoice } from '@/lib/api/hooks'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Edit, Trash2, ArrowLeft, Download, Mail, DollarSign, CreditCard } from 'lucide-react'
import Link from 'next/link'
import { formatCurrency } from '@/lib/utils/money'
import { useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { InvoiceStatus } from '@/types'
import { useLocale } from 'next-intl'

const statusColors: Record<InvoiceStatus, string> = {
  draft: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  sent: 'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-200',
  paid: 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-200',
  overdue: 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-200',
  canceled: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
}

export default function InvoiceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const invoiceId = params.id as string
  const locale = useLocale()

  const { organizationId } = useAuth()
  const { data: invoice, isLoading, error } = useInvoice(invoiceId, organizationId || undefined)
  const deleteInvoice = useDeleteInvoice(organizationId || undefined)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this invoice? This action cannot be undone.')) {
      return
    }

    try {
      await deleteInvoice.mutateAsync(invoiceId)
      router.push('/financials?tab=invoices')
    } catch (err: unknown) {
      const error = err as Error
      setDeleteError(error.message || 'Failed to delete invoice')
    }
  }

  if (isLoading) {
    return <div>Loading invoice...</div>
  }

  if (error) {
    return <div>Error loading invoice: {error.message}</div>
  }

  if (!invoice) {
    return <div>Invoice not found</div>
  }

  const dueDate = new Date(invoice.due_date)
  const issueDate = new Date(invoice.issue_date)
  const paidDate = invoice.paid_date ? new Date(invoice.paid_date) : null
  const isOverdue = invoice.status !== 'paid' && dueDate < new Date()

  // Calculate totals
  const subtotal = invoice.subtotal_cents
  const tax = invoice.tax_amount_cents
  const total = invoice.total_amount_cents

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button asChild variant="outline" size="sm">
            <Link href="/financials?tab=invoices">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Invoices
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Invoice #{invoice.invoice_number}
            </h1>
            <p className="text-muted-foreground">
              Issued {issueDate.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} • Due {dueDate.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/financials/invoices/${invoiceId}/edit`}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Link>
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteInvoice.isPending}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {deleteError && (
        <Alert variant="destructive">
          <AlertDescription>{deleteError}</AlertDescription>
        </Alert>
      )}

      {/* Status and Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Badge className={`${statusColors[invoice.status as InvoiceStatus]} text-lg px-4 py-2`}>
            {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
          </Badge>
          {isOverdue && (
            <Badge variant="destructive" className="text-lg px-4 py-2">
              Overdue
            </Badge>
          )}
          {paidDate && (
            <span className="text-sm text-muted-foreground">
              Paid on {paidDate.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          )}
        </div>

        <div className="flex gap-2">
          <Button variant="outline">
            <Mail className="mr-2 h-4 w-4" />
            Send Email
          </Button>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" disabled>
                  <Download className="mr-2 h-4 w-4" />
                  Download PDF
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>PDF generation under construction</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Invoice Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Client & Project Information */}
          <Card>
            <CardHeader>
              <CardTitle>Invoice Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Client</div>
                  <div className="text-lg">{invoice.client?.name || 'No client assigned'}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Project</div>
                  <div className="text-lg">{invoice.project?.title || 'No project assigned'}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Issue Date</div>
                  <div>{issueDate.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Due Date</div>
                  <div className={isOverdue ? 'text-red-600 dark:text-red-400 font-medium' : ''}>
                    {dueDate.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                    {isOverdue && ' (Overdue)'}
                  </div>
                </div>
              </div>

              {invoice.notes && (
                <>
                  <Separator />
                  <div>
                    <div className="text-sm font-medium text-muted-foreground mb-2">Notes</div>
                    <div className="text-sm">{invoice.notes}</div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Line Items */}
          <Card>
            <CardHeader>
              <CardTitle>Line Items</CardTitle>
              <CardDescription>Detailed breakdown of invoice items</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoice.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.description}</TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(item.unit_price_cents)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(item.total_cents)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Invoice Summary */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Invoice Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Tax:</span>
                <span>{formatCurrency(tax)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>Total:</span>
                <span>{formatCurrency(total)}</span>
              </div>

              {invoice.status === 'paid' && paidDate && (
                <>
                  <Separator />
                  <div className="text-center">
                    <Badge className="bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-200">
                      Paid on {paidDate.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                    </Badge>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Payment Status */}
          <Card>
            <CardHeader>
              <CardTitle>Payment Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Status</span>
                  <Badge className={statusColors[invoice.status as InvoiceStatus]}>
                    {invoice.status}
                  </Badge>
                </div>

                {invoice.status === 'paid' && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Payment Date</span>
                    <span className="text-sm">
                      {paidDate?.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-sm">Days Until Due</span>
                  <span className={`text-sm ${isOverdue ? 'text-red-600 dark:text-red-400 font-medium' : ''}`}>
                    {Math.ceil((dueDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full" variant="outline">
                <Mail className="mr-2 h-4 w-4" />
                Send to Client
              </Button>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button className="w-full" variant="outline" disabled>
                      <Download className="mr-2 h-4 w-4" />
                      Download PDF
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>PDF generation under construction</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              {invoice.status !== 'paid' && (
                <PaymentDialog invoiceId={invoiceId} invoiceTotal={total} />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

// Payment Dialog Component
interface PaymentDialogProps {
  invoiceId: string
  invoiceTotal: number
}

function PaymentDialog({ invoiceId, invoiceTotal }: PaymentDialogProps) {
  const [open, setOpen] = useState(false)
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0])
  const [paymentMethod, setPaymentMethod] = useState('')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  // TODO: Implement payment tracking - for now just show dialog
  const handleMarkAsPaid = async () => {
    setIsProcessing(true)
    try {
      // Here you would call an API to mark the invoice as paid
      // For now, we'll just show the dialog functionality
      await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate API call

      // In a real implementation, you'd call something like:
      // await updateInvoice.mutateAsync({
      //   invoiceId,
      //   data: {
      //     status: 'paid',
      //     paid_date: paymentDate,
      //     payment_method: paymentMethod,
      //     payment_reference: reference,
      //     payment_notes: notes
      //   }
      // })

      setOpen(false)
      // Refresh the page to show updated status
      window.location.reload()
    } catch (error) {
      console.error('Error marking invoice as paid:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full" variant="default">
          <CreditCard className="mr-2 h-4 w-4" />
          Mark as Paid
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Mark Invoice as Paid</DialogTitle>
          <DialogDescription>
            Record payment details for invoice #{invoiceId}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="text-center p-4 bg-muted rounded-lg">
            <div className="text-sm text-muted-foreground">Invoice Total</div>
            <div className="text-2xl font-bold">{formatCurrency(invoiceTotal)}</div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment_date">Payment Date *</Label>
            <Input
              id="payment_date"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment_method">Payment Method *</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod} required>
              <SelectTrigger>
                <SelectValue placeholder="Select payment method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                <SelectItem value="credit_card">Credit Card</SelectItem>
                <SelectItem value="debit_card">Debit Card</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="check">Check</SelectItem>
                <SelectItem value="paypal">PayPal</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reference">Reference/Transaction ID</Label>
            <Input
              id="reference"
              placeholder="Transaction ID, check number, etc."
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment_notes">Payment Notes</Label>
            <Input
              id="payment_notes"
              placeholder="Additional payment details..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleMarkAsPaid}
            disabled={isProcessing || !paymentDate || !paymentMethod}
          >
            {isProcessing ? 'Processing...' : 'Mark as Paid'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
