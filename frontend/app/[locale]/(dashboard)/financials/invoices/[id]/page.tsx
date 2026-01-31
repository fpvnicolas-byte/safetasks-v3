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
import { useLocale, useTranslations } from 'next-intl'

const statusVariant: Record<InvoiceStatus, 'secondary' | 'info' | 'success' | 'destructive' | 'outline'> = {
  draft: 'secondary',
  sent: 'info',
  paid: 'success',
  overdue: 'destructive',
  canceled: 'outline',
}

export default function InvoiceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const invoiceId = params.id as string
  const locale = useLocale()
  const t = useTranslations('financials.pages.invoiceDetail')
  const tCommon = useTranslations('common')

  const { organizationId } = useAuth()
  const { data: invoice, isLoading, error } = useInvoice(invoiceId, organizationId || undefined)
  const deleteInvoice = useDeleteInvoice(organizationId || undefined)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function handleDelete() {
    if (!confirm(t('deleteConfirm'))) {
      return
    }

    try {
      await deleteInvoice.mutateAsync(invoiceId)
      router.push('/financials?tab=invoices')
    } catch (err: unknown) {
      const error = err as Error
      setDeleteError(error.message || t('errors.deleteFailed'))
    }
  }

  if (isLoading) {
    return <div>{t('loading')}</div>
  }

  if (error) {
    return <div>{t('errors.load', { message: error.message })}</div>
  }

  if (!invoice) {
    return <div>{t('errors.notFound')}</div>
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
              {t('actions.back')}
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight font-display">
              {t('title', { number: invoice.invoice_number })}
            </h1>
            <p className="text-muted-foreground">
              {t('dates.issuedDue', {
                issued: issueDate.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
                due: dueDate.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
              })}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/financials/invoices/${invoiceId}/edit`}>
              <Edit className="mr-2 h-4 w-4" />
              {tCommon('edit')}
            </Link>
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteInvoice.isPending}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {t('actions.delete')}
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
          <Badge variant={statusVariant[invoice.status as InvoiceStatus]} className="text-lg px-4 py-2">
            {t(`status.${invoice.status}`)}
          </Badge>
          {isOverdue && (
            <Badge variant="destructive" className="text-lg px-4 py-2">
              {t('status.overdue')}
            </Badge>
          )}
          {paidDate && (
            <span className="text-sm text-muted-foreground">
              {t('paidOn', { date: paidDate.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) })}
            </span>
          )}
        </div>

        <div className="flex gap-2">
          <Button variant="outline">
            <Mail className="mr-2 h-4 w-4" />
            {t('actions.sendEmail')}
          </Button>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" disabled>
                  <Download className="mr-2 h-4 w-4" />
                  {t('actions.downloadPdf')}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t('pdfUnavailable')}</p>
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
              <CardTitle>{t('info.title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">{t('info.client')}</div>
                  <div className="text-lg">{invoice.client?.name || t('info.noClient')}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">{t('info.project')}</div>
                  <div className="text-lg">{invoice.project?.title || t('info.noProject')}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">{t('info.issueDate')}</div>
                  <div>{issueDate.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">{t('info.dueDate')}</div>
                  <div className={isOverdue ? 'text-destructive font-medium' : ''}>
                    {dueDate.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                    {isOverdue && ` (${t('status.overdue')})`}
                  </div>
                </div>
              </div>

              {invoice.notes && (
                <>
                  <Separator />
                  <div>
                    <div className="text-sm font-medium text-muted-foreground mb-2">{t('info.notes')}</div>
                    <div className="text-sm">{invoice.notes}</div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Line Items */}
          <Card>
            <CardHeader>
              <CardTitle>{t('items.title')}</CardTitle>
              <CardDescription>{t('items.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('items.headers.description')}</TableHead>
                    <TableHead className="text-right">{t('items.headers.quantity')}</TableHead>
                    <TableHead className="text-right">{t('items.headers.unitPrice')}</TableHead>
                    <TableHead className="text-right">{t('items.headers.total')}</TableHead>
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
                {t('summary.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span>{t('summary.subtotal')}</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>{t('summary.tax')}</span>
                <span>{formatCurrency(tax)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>{t('summary.total')}</span>
                <span>{formatCurrency(total)}</span>
              </div>

              {invoice.status === 'paid' && paidDate && (
                <>
                  <Separator />
                  <div className="text-center">
                    <Badge variant="success">
                      {t('paidOn', { date: paidDate.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) })}
                    </Badge>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Payment Status */}
          <Card>
            <CardHeader>
              <CardTitle>{t('payment.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">{t('payment.status')}</span>
                  <Badge variant={statusVariant[invoice.status as InvoiceStatus]}>
                    {t(`status.${invoice.status}`)}
                  </Badge>
                </div>

                {invoice.status === 'paid' && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm">{t('payment.date')}</span>
                    <span className="text-sm">
                      {paidDate?.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-sm">{t('payment.daysUntilDue')}</span>
                  <span className={`text-sm ${isOverdue ? 'text-destructive font-medium' : ''}`}>
                    {t('payment.daysCount', {
                      count: Math.ceil((dueDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
                    })}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>{t('actions.title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full" variant="outline">
                <Mail className="mr-2 h-4 w-4" />
                {t('actions.sendToClient')}
              </Button>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button className="w-full" variant="outline" disabled>
                      <Download className="mr-2 h-4 w-4" />
                      {t('actions.downloadPdf')}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{t('pdfUnavailable')}</p>
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
  const t = useTranslations('financials.pages.invoiceDetail')
  const tCommon = useTranslations('common')

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
          {t('actions.markAsPaid')}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t('paymentDialog.title')}</DialogTitle>
          <DialogDescription>
            {t('paymentDialog.description', { id: invoiceId })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="text-center p-4 bg-muted rounded-lg">
            <div className="text-sm text-muted-foreground">{t('paymentDialog.totalLabel')}</div>
            <div className="text-2xl font-bold">{formatCurrency(invoiceTotal)}</div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment_date">{t('paymentDialog.fields.date')}</Label>
            <Input
              id="payment_date"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment_method">{t('paymentDialog.fields.method')}</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod} required>
              <SelectTrigger>
                <SelectValue placeholder={t('paymentDialog.fields.methodPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bank_transfer">{t('paymentMethods.bank_transfer')}</SelectItem>
                <SelectItem value="credit_card">{t('paymentMethods.credit_card')}</SelectItem>
                <SelectItem value="debit_card">{t('paymentMethods.debit_card')}</SelectItem>
                <SelectItem value="cash">{t('paymentMethods.cash')}</SelectItem>
                <SelectItem value="check">{t('paymentMethods.check')}</SelectItem>
                <SelectItem value="paypal">{t('paymentMethods.paypal')}</SelectItem>
                <SelectItem value="other">{t('paymentMethods.other')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reference">{t('paymentDialog.fields.reference')}</Label>
            <Input
              id="reference"
              placeholder={t('paymentDialog.fields.referencePlaceholder')}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment_notes">{t('paymentDialog.fields.notes')}</Label>
            <Input
              id="payment_notes"
              placeholder={t('paymentDialog.fields.notesPlaceholder')}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {tCommon('cancel')}
          </Button>
          <Button
            onClick={handleMarkAsPaid}
            disabled={isProcessing || !paymentDate || !paymentMethod}
          >
            {isProcessing ? t('actions.processing') : t('actions.markAsPaid')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
