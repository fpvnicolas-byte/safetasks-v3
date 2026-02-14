'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { useDeleteInvoice } from '@/lib/api/hooks'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'
import { DollarSign, Plus, Eye, Edit, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { InvoicesTabSkeleton } from '@/components/LoadingSkeletons'
import { formatCurrency } from '@/lib/utils/money'
import type { InvoiceStatus, InvoiceWithItems } from '@/types'

interface FinancialsInvoicesTabProps {
  statusFilter: InvoiceStatus | 'all'
  onStatusFilterChange: (status: InvoiceStatus | 'all') => void
  invoices: InvoiceWithItems[] | undefined
  isLoading: boolean
  errorMessage?: string
  locale: string
}

const statusVariant: Record<InvoiceStatus, 'secondary' | 'info' | 'success' | 'destructive' | 'outline'> = {
  draft: 'secondary',
  sent: 'info',
  paid: 'success',
  overdue: 'destructive',
  cancelled: 'outline',
}

export function FinancialsInvoicesTab({
  statusFilter,
  onStatusFilterChange,
  invoices,
  isLoading,
  errorMessage,
  locale,
}: FinancialsInvoicesTabProps) {
  const t = useTranslations('financials')

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">{t('invoicesTab.filterByStatus')}</label>
          <Select value={statusFilter} onValueChange={(value) => onStatusFilterChange(value as InvoiceStatus | 'all')}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('invoicesTab.allStatuses')}</SelectItem>
              <SelectItem value="draft">{t('invoicesTab.draft')}</SelectItem>
              <SelectItem value="sent">{t('invoicesTab.sent')}</SelectItem>
              <SelectItem value="paid">{t('paid')}</SelectItem>
              <SelectItem value="overdue">{t('invoicesTab.overdue')}</SelectItem>
              <SelectItem value="cancelled">{t('invoicesTab.cancelled')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <InvoicesTabSkeleton />
      ) : errorMessage ? (
        <div>{t('invoicesTab.error', { message: errorMessage })}</div>
      ) : invoices && invoices.length > 0 ? (
        <div className="grid gap-4">
          {invoices.map((invoice) => (
            <InvoiceCard key={invoice.id} invoice={invoice} locale={locale} />
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{t('invoicesTab.noInvoicesFound')}</CardTitle>
            <CardDescription>
              {statusFilter === 'all'
                ? t('invoicesTab.createFirst')
                : t('invoicesTab.noInvoicesWithStatus', { status: statusFilter })
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <DollarSign className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground mb-4">
                {t('invoicesTab.helpText')}
              </p>
              <Button asChild>
                <Link href="/financials/new-invoice">
                  <Plus className="mr-2 h-4 w-4" />
                  {t('invoicesTab.createFirstInvoice')}
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

interface InvoiceCardProps {
  invoice: InvoiceWithItems
  locale: string
}

function InvoiceCard({ invoice, locale }: InvoiceCardProps) {
  const t = useTranslations('financials')
  const { organizationId } = useAuth()
  const deleteInvoice = useDeleteInvoice(organizationId || undefined)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  const dueDate = new Date(invoice.due_date)
  const issueDate = new Date(invoice.issue_date)
  const isOverdue = invoice.status !== 'paid' && dueDate < new Date()

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await deleteInvoice.mutateAsync(invoice.id)
    } catch (error) {
      console.error('Failed to delete invoice:', error)
      alert(t('invoicesTab.invoice.deleteError'))
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      <ConfirmDeleteDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={handleDelete}
        loading={isDeleting}
        title={t('invoicesTab.invoice.deleteConfirmTitle', { number: invoice.invoice_number })}
        description={t('invoicesTab.invoice.deleteConfirm', { number: invoice.invoice_number })}
      />
      <Card className={`hover:shadow-md transition-shadow ${isOverdue ? 'border-destructive/30' : ''}`}>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-lg">
                {t('invoicesTab.invoice.invoiceNumber', { number: invoice.invoice_number })}
              </CardTitle>
              <CardDescription>
                {t('invoicesTab.invoice.issued')} {issueDate.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} • {t('invoicesTab.invoice.due')} {dueDate.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                {isOverdue && (
                  <span className="text-destructive font-medium ml-2">
                    {t('invoicesTab.invoice.overdue')}
                  </span>
                )}
              </CardDescription>
            </div>
            <Badge variant={statusVariant[invoice.status]}>
              {t(`status.${invoice.status}`)}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="font-medium text-muted-foreground">{t('invoicesTab.invoice.client')}</div>
              <div>{invoice.client?.name || t('invoicesTab.invoice.noClient')}</div>
            </div>
            <div>
              <div className="font-medium text-muted-foreground">{t('invoicesTab.invoice.project')}</div>
              <div>{invoice.project?.title || t('invoicesTab.invoice.noProject')}</div>
            </div>
            <div>
              <div className="font-medium text-muted-foreground">{t('amount')}</div>
              <div className="text-lg font-bold">
                {formatCurrency(invoice.total_amount_cents)}
              </div>
            </div>
          </div>

          {invoice.notes && (
            <div className="text-sm">
              <div className="font-medium text-muted-foreground">{t('invoicesTab.invoice.notes')}</div>
              <div className="mt-1">{invoice.notes}</div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/financials/invoices/${invoice.id}`}>
                <Eye className="mr-2 h-3 w-3" />
                {t('invoicesTab.invoice.view')}
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/financials/invoices/${invoice.id}/edit`}>
                <Edit className="mr-2 h-3 w-3" />
                {t('invoicesTab.invoice.edit')}
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setIsDeleteDialogOpen(true)}
              disabled={isDeleting}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  )
}
