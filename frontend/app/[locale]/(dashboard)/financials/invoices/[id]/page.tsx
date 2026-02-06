'use client'

import { useParams, useRouter } from 'next/navigation'
import { useInvoice, useDeleteInvoice, useUpdateInvoice } from '@/lib/api/hooks'
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
// Tooltip imports retained for potential future use
// import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Edit, Trash2, ArrowLeft, Download, Mail, DollarSign, CreditCard, FileText, Loader2, Link2, Copy, ExternalLink, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { formatCurrency } from '@/lib/utils/money'
import { useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { InvoiceStatus } from '@/types'
import { useLocale, useTranslations } from 'next-intl'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'
import { toast } from 'sonner'
import { useGeneratePaymentLink, usePaymentStatus, useStripeConnectStatus } from '@/lib/api/hooks'

const statusVariant: Record<InvoiceStatus, 'secondary' | 'info' | 'success' | 'destructive' | 'outline'> = {
  draft: 'secondary',
  sent: 'info',
  paid: 'success',
  overdue: 'destructive',
  cancelled: 'outline',
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

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  // PDF Generation State
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)
  const [pdfGenerated, setPdfGenerated] = useState(false)

  // PDF Generation Handler
  const handleGeneratePdf = async (regenerate = false) => {
    setIsGeneratingPdf(true)
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data: { session }, error: authError } = await supabase.auth.getSession()

      if (authError || !session) {
        throw new Error('Not authenticated')
      }

      const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
      const pdfLocale = locale === 'pt-br' ? 'pt-BR' : 'en'
      const response = await fetch(
        `${API_BASE_URL}/api/v1/financial/invoices/${invoiceId}/pdf?regenerate=${regenerate}&locale=${pdfLocale}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || t('pdf.generateFailed'))
      }

      const data = await response.json()
      setPdfGenerated(true)

      if (data.status === 'exists' && !regenerate) {
        toast.success(t('pdf.exists'))
      } else {
        toast.success(t('pdf.generated'))
      }
    } catch (error) {
      console.error('PDF generation failed:', error)

      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        toast.error('Cannot connect to server. Please check if backend is running.')
      } else if (error instanceof Error && error.message === 'Not authenticated') {
        toast.error('Please log in again to generate PDF.')
      } else {
        toast.error(error instanceof Error ? error.message : t('pdf.generateFailed'))
      }
    } finally {
      setIsGeneratingPdf(false)
    }
  }

  // PDF Download Handler
  const handleDownloadPdf = async () => {
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data: { session }, error: authError } = await supabase.auth.getSession()

      if (authError || !session) {
        throw new Error('Not authenticated')
      }

      const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
      const response = await fetch(
        `${API_BASE_URL}/api/v1/financial/invoices/${invoiceId}/pdf?download=true`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      )

      if (!response.ok) {
        throw new Error('Failed to get PDF URL')
      }

      const data = await response.json()
      if (data.download_url) {
        window.open(data.download_url, '_blank')
      } else if (data.signed_url) {
        window.open(data.signed_url, '_blank')
      }
    } catch (error) {
      console.error('PDF download failed:', error)
      toast.error(t('pdf.downloadFailed'))
    }
  }

  async function handleDelete() {
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
      <ConfirmDeleteDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={handleDelete}
        loading={deleteInvoice.isPending}
        title={t('actions.delete')}
        description={t('deleteConfirm')}
      />
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
            onClick={() => setIsDeleteDialogOpen(true)}
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
          <Button
            variant="outline"
            onClick={() => handleGeneratePdf(pdfGenerated)}
            disabled={isGeneratingPdf}
          >
            {isGeneratingPdf ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileText className="mr-2 h-4 w-4" />
            )}
            {pdfGenerated ? t('pdf.regenerate') : t('pdf.generate')}
          </Button>
          {pdfGenerated && (
            <Button variant="secondary" onClick={handleDownloadPdf}>
              <Download className="mr-2 h-4 w-4" />
              {t('pdf.download')}
            </Button>
          )}
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
              <Button
                className="w-full"
                variant="outline"
                onClick={() => handleGeneratePdf(pdfGenerated)}
                disabled={isGeneratingPdf}
              >
                {isGeneratingPdf ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="mr-2 h-4 w-4" />
                )}
                {pdfGenerated ? t('pdf.regenerate') : t('pdf.generate')}
              </Button>
              {pdfGenerated && (
                <Button className="w-full" variant="outline" onClick={handleDownloadPdf}>
                  <Download className="mr-2 h-4 w-4" />
                  {t('pdf.download')}
                </Button>
              )}
              {invoice.status !== 'paid' && (
                <PaymentDialog invoiceId={invoiceId} invoiceTotal={total} organizationId={organizationId || undefined} />
              )}
            </CardContent>
          </Card>

          {/* Stripe Payment Link */}
          {invoice.payment_method === 'stripe' && invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
            <StripePaymentLinkCard invoiceId={invoiceId} invoice={invoice} organizationId={organizationId || undefined} />
          )}
        </div>
      </div>
    </div>
  )
}

// Payment Dialog Component
interface PaymentDialogProps {
  invoiceId: string
  invoiceTotal: number
  organizationId?: string
}

function PaymentDialog({ invoiceId, invoiceTotal, organizationId }: PaymentDialogProps) {
  const [open, setOpen] = useState(false)
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0])
  const [paymentMethod, setPaymentMethod] = useState('')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const t = useTranslations('financials.pages.invoiceDetail')
  const tCommon = useTranslations('common')
  const updateInvoice = useUpdateInvoice(organizationId)

  const handleMarkAsPaid = async () => {
    setIsProcessing(true)
    try {
      await updateInvoice.mutateAsync({
        invoiceId,
        data: {
          status: 'paid' as any,
          paid_date: paymentDate, // Input type="date" value is already YYYY-MM-DD
          payment_method: paymentMethod,
          payment_reference: reference,
          payment_notes: notes
        }
      })

      setOpen(false)
      // No need to reload, React Query handles cache invalidation on success
    } catch (error: any) {
      console.error('Error marking invoice as paid:', JSON.stringify(error, null, 2))
      if (error.response?.data) {
        console.error('Server response:', error.response.data)
      }
      alert(`Failed to mark invoice as paid: ${error.message || 'Unknown error'}`)
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

// Stripe Payment Link Card
interface StripePaymentLinkCardProps {
  invoiceId: string
  invoice: any
  organizationId?: string
}

function StripePaymentLinkCard({ invoiceId, invoice, organizationId }: StripePaymentLinkCardProps) {
  const t = useTranslations('financials.pages.invoiceDetail')
  const generateLink = useGeneratePaymentLink()
  const { data: connectStatus } = useStripeConnectStatus()
  const { data: paymentStatus } = usePaymentStatus(invoiceId, !!invoice.stripe_checkout_session_id)
  const [copied, setCopied] = useState(false)

  // Allow link generation if account is connected (even if charges_enabled is false in test mode)
  const isConnected = connectStatus?.connected ?? false

  const handleGenerateLink = async () => {
    try {
      await generateLink.mutateAsync(invoiceId)
      toast.success(t('paymentLink.generated'))
    } catch (err: any) {
      toast.error(err.message || t('paymentLink.generateFailed'))
    }
  }

  const handleCopyLink = () => {
    const url = invoice.payment_link_url || paymentStatus?.payment_link_url
    if (url) {
      navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success(t('paymentLink.copied'))
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const paymentLinkUrl = invoice.payment_link_url || paymentStatus?.payment_link_url
  const hasActiveLink = !!paymentLinkUrl
  const isExpired = invoice.payment_link_expires_at && new Date(invoice.payment_link_expires_at) < new Date()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="h-5 w-5" />
          {t('paymentLink.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!isConnected ? (
          <div className="text-sm text-muted-foreground">
            <p>{t('paymentLink.notConnected')}</p>
            <Button asChild variant="link" className="p-0 h-auto mt-1">
              <Link href="/settings/payment-methods">
                {t('paymentLink.setupStripe')}
              </Link>
            </Button>
          </div>
        ) : hasActiveLink && !isExpired ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <span className="text-sm font-medium text-success">{t('paymentLink.active')}</span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={handleCopyLink}>
                {copied ? <CheckCircle2 className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                {copied ? t('paymentLink.copiedBtn') : t('paymentLink.copyLink')}
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.open(paymentLinkUrl, '_blank')}>
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
            {invoice.payment_link_expires_at && (
              <p className="text-xs text-muted-foreground">
                {t('paymentLink.expiresAt', { date: new Date(invoice.payment_link_expires_at).toLocaleDateString() })}
              </p>
            )}
            {/* Regenerate option */}
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground"
              onClick={handleGenerateLink}
              disabled={generateLink.isPending}
            >
              {generateLink.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('paymentLink.regenerate')}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {isExpired && (
              <p className="text-sm text-destructive">{t('paymentLink.expired')}</p>
            )}
            <Button
              className="w-full"
              onClick={handleGenerateLink}
              disabled={generateLink.isPending}
            >
              {generateLink.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Link2 className="mr-2 h-4 w-4" />
              )}
              {generateLink.isPending ? t('paymentLink.generating') : t('paymentLink.generate')}
            </Button>
          </div>
        )}

        {/* Live payment status */}
        {paymentStatus?.checkout_session_status && (
          <div className="pt-2 border-t">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t('paymentLink.checkoutStatus')}</span>
              <Badge variant={paymentStatus.checkout_session_status === 'complete' ? 'success' : 'secondary'}>
                {paymentStatus.checkout_session_status}
              </Badge>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
