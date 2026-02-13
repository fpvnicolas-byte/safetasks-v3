'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { useGeneratePaymentLink, usePaymentStatus, useSendInvoiceEmail, useStripeConnectStatus, useUpdateInvoice } from '@/lib/api/hooks'
import { formatCurrency } from '@/lib/utils/money'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { CheckCircle2, Copy, CreditCard, ExternalLink, Link2, Loader2, Mail } from 'lucide-react'

interface SendEmailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoiceId: string
  invoiceNumber: string
  organizationId?: string
  clientEmail?: string
}

export function SendEmailDialog({ open, onOpenChange, invoiceId, invoiceNumber, organizationId, clientEmail }: SendEmailDialogProps) {
  const t = useTranslations('financials.pages.invoiceDetail')
  const tCommon = useTranslations('common')
  const sendEmail = useSendInvoiceEmail(organizationId)

  const defaultSubject = t('sendEmailDialog.defaultSubject', { number: invoiceNumber })
  const defaultMessage = t('sendEmailDialog.defaultMessage', { number: invoiceNumber })

  const [recipientEmail, setRecipientEmail] = useState(clientEmail || '')
  const [subject, setSubject] = useState(defaultSubject)
  const [message, setMessage] = useState(defaultMessage)

  const handleOpenChange = (value: boolean) => {
    if (value) {
      setRecipientEmail(clientEmail || '')
      setSubject(defaultSubject)
      setMessage(defaultMessage)
    }
    onOpenChange(value)
  }

  const handleSend = async () => {
    try {
      await sendEmail.mutateAsync({
        invoiceId,
        data: { recipient_email: recipientEmail, subject, message },
      })
      toast.success(t('sendEmailDialog.success'))
      onOpenChange(false)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : ''
      toast.error(message || t('sendEmailDialog.error'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t('sendEmailDialog.title')}</DialogTitle>
          <DialogDescription>{t('sendEmailDialog.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="recipient_email">{t('sendEmailDialog.fields.recipientEmail')}</Label>
            <Input
              id="recipient_email"
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email_subject">{t('sendEmailDialog.fields.subject')}</Label>
            <Input
              id="email_subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email_message">{t('sendEmailDialog.fields.message')}</Label>
            <Textarea
              id="email_message"
              rows={6}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tCommon('cancel')}
          </Button>
          <Button
            onClick={handleSend}
            disabled={sendEmail.isPending || !recipientEmail || !subject || !message}
          >
            {sendEmail.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('sendEmailDialog.sending')}
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                {t('sendEmailDialog.send')}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface PaymentDialogProps {
  invoiceId: string
  invoiceTotal: number
  organizationId?: string
}

export function PaymentDialog({ invoiceId, invoiceTotal, organizationId }: PaymentDialogProps) {
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
          status: 'paid',
          paid_date: paymentDate,
          payment_method: paymentMethod,
          payment_reference: reference,
          payment_notes: notes
        }
      })

      setOpen(false)
    } catch (error: unknown) {
      const errorDetails = error as { response?: { data?: unknown }; message?: string }
      console.error('Error marking invoice as paid:', JSON.stringify(errorDetails, null, 2))
      if (errorDetails.response?.data) {
        console.error('Server response:', errorDetails.response.data)
      }
      alert(`Failed to mark invoice as paid: ${errorDetails.message || 'Unknown error'}`)
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

interface InvoiceForPaymentLink {
  status: string
  stripe_checkout_session_id?: string | null
  payment_link_url?: string | null
  payment_link_expires_at?: string | null
}

interface StripePaymentLinkCardProps {
  invoiceId: string
  invoice: InvoiceForPaymentLink
}

export function StripePaymentLinkCard({ invoiceId, invoice }: StripePaymentLinkCardProps) {
  const t = useTranslations('financials.pages.invoiceDetail')
  const generateLink = useGeneratePaymentLink()
  const { data: connectStatus } = useStripeConnectStatus()
  const shouldCheckStatus = !!invoice.stripe_checkout_session_id && invoice.status !== 'paid'
  const { data: paymentStatus } = usePaymentStatus(invoiceId, shouldCheckStatus)
  const [copied, setCopied] = useState(false)

  const isConnected = connectStatus?.connected ?? false

  const handleGenerateLink = async () => {
    try {
      await generateLink.mutateAsync(invoiceId)
      toast.success(t('paymentLink.generated'))
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : ''
      toast.error(message || t('paymentLink.generateFailed'))
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

  const isPaid = invoice.status === 'paid' || paymentStatus?.invoice_status === 'paid' || paymentStatus?.payment_status === 'paid'
  const paymentLinkUrl = !isPaid ? (invoice.payment_link_url || paymentStatus?.payment_link_url) : null
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
        ) : isPaid ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <span className="text-sm font-medium text-success">{t('paymentLink.paid')}</span>
            </div>
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
