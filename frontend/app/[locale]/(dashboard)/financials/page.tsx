'use client'

import { useState } from 'react'
import { useInvoices, useDeleteInvoice, useOverviewStats, useBankAccounts, useTransactions } from '@/lib/api/hooks'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { DollarSign, Plus, Eye, Edit, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { formatCurrency } from '@/lib/utils/money'
import { InvoiceWithItems, InvoiceStatus } from '@/types'
import { useLocale, useTranslations } from 'next-intl'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'
import { ExpenseApprovalDashboard } from '@/components/financials/ExpenseApprovalDashboard'

const statusVariant: Record<InvoiceStatus, 'secondary' | 'info' | 'success' | 'destructive' | 'outline'> = {
  draft: 'secondary',
  sent: 'info',
  paid: 'success',
  overdue: 'destructive',
  cancelled: 'outline',
}

export default function FinancialsPage() {
  const { organizationId } = useAuth()
  const locale = useLocale()
  const t = useTranslations('financials')
  const tCommon = useTranslations('common')
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all'>('all')

  const filters = statusFilter === 'all' ? {} : { status: statusFilter }
  const { data: invoices, isLoading, error } = useInvoices(organizationId || undefined, filters)
  const { data: stats } = useOverviewStats(organizationId || undefined)
  const { data: bankAccounts } = useBankAccounts(organizationId || undefined)
  const { data: recentTransactions } = useTransactions(organizationId ? { organizationId, limit: 5 } : {})
  const { data: recentExpenses } = useTransactions(organizationId ? { organizationId, type: 'expense', limit: 5 } : {})

  return (
    <div className="space-y-8">
      <div className="rounded-xl border bg-card/60 px-6 py-5">
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          {t('overview.breadcrumb')}
        </div>
        <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight font-display">{t('title')}</h1>
            <p className="text-muted-foreground">
              {t('description')}
            </p>
          </div>
          <Button asChild>
            <Link href="/financials/new-invoice">
              <Plus className="mr-2 h-4 w-4" />
              {t('newInvoice')}
            </Link>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">{t('overview.tab')}</TabsTrigger>
          <TabsTrigger value="approvals">{t('approvals.title')}</TabsTrigger>
          <TabsTrigger value="invoices">{t('invoicesTab.tab')}</TabsTrigger>
          <TabsTrigger value="bank-accounts">{t('bankAccountsTab.tab')}</TabsTrigger>
          <TabsTrigger value="transactions">{t('transactionsTab.tab')}</TabsTrigger>
          <TabsTrigger value="expenses">{t('expensesTab.tab')}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>{t('overview.totalBudget')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(stats?.total_budget_cents || 0)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('overview.totalSpent')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(stats?.total_expense_cents || 0)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('overview.remaining')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(stats?.remaining_budget_cents || 0)}</div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="approvals" className="space-y-4">
          <ExpenseApprovalDashboard />
        </TabsContent>

        <TabsContent value="invoices" className="space-y-6">
          {/* Filters */}
          <div className="flex items-center gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('invoicesTab.filterByStatus')}</label>
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as InvoiceStatus | 'all')}>
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

          {/* Invoice List */}
          {isLoading ? (
            <div>{t('invoicesTab.loading')}</div>
          ) : error ? (
            <div>{t('invoicesTab.error', { message: error.message })}</div>
          ) : invoices && invoices.length > 0 ? (
            <div className="grid gap-4">
              {invoices.map((invoice) => (
                <InvoiceCard key={invoice.id} invoice={invoice} t={t} tCommon={tCommon} locale={locale} />
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
        </TabsContent>

        <TabsContent value="bank-accounts">
          <Card>
            <CardHeader>
              <CardTitle>{t('bankAccountsTab.title')}</CardTitle>
              <CardDescription>{t('bankAccountsTab.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              {bankAccounts && bankAccounts.length > 0 ? (
                <div className="space-y-4">
                  {bankAccounts.map((account) => (
                    <div key={account.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                      <div>
                        <div className="font-medium">{account.name}</div>
                        <div className="text-sm text-muted-foreground">{account.currency}</div>
                      </div>
                      <div className="font-bold">{formatCurrency(account.balance_cents, account.currency)}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <p className="text-sm text-muted-foreground mb-4">{t('bankAccountsTab.noBankAccounts')}</p>
                </div>
              )}
              <div className="mt-6 flex justify-center">
                <Button asChild variant="outline">
                  <Link href="/financials/bank-accounts">
                    <Plus className="mr-2 h-4 w-4" />
                    {t('bankAccountsTab.viewBankAccounts')}
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions">
          <Card>
            <CardHeader>
              <CardTitle>{t('transactionsTab.title')}</CardTitle>
              <CardDescription>{t('transactionsTab.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              {recentTransactions && recentTransactions.length > 0 ? (
                <div className="space-y-4">
                  {recentTransactions.map((transaction) => (
                    <div key={transaction.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                      <div>
                        <div className="font-medium">{transaction.description || t('transactionsTab.noDescription')}</div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(transaction.transaction_date).toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} • {transaction.category}
                        </div>
                      </div>
                      <div className={`font-bold ${transaction.type === 'income' ? 'text-success' : 'text-destructive'}`}>
                        {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount_cents)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <p className="text-sm text-muted-foreground mb-4">{t('transactionsTab.noRecentTransactions')}</p>
                </div>
              )}
              <div className="mt-6 flex justify-center">
                <Button asChild variant="outline">
                  <Link href="/financials/transactions">
                    <Plus className="mr-2 h-4 w-4" />
                    {t('transactionsTab.viewTransactions')}
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expenses">
          <Card>
            <CardHeader>
              <CardTitle>{t('expensesTab.title')}</CardTitle>
              <CardDescription>{t('expensesTab.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              {recentExpenses && recentExpenses.length > 0 ? (
                <div className="space-y-4">
                  {recentExpenses.map((expense) => (
                    <div key={expense.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                      <div>
                        <div className="font-medium">{expense.description || t('transactionsTab.noDescription')}</div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(expense.transaction_date).toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} • {expense.category}
                        </div>
                      </div>
                      <div className="font-bold text-destructive">
                        -{formatCurrency(expense.amount_cents)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <p className="text-sm text-muted-foreground mb-4">{t('expensesTab.noRecentExpenses')}</p>
                </div>
              )}
              <div className="mt-6 flex justify-center">
                <Button asChild variant="outline">
                  <Link href="/financials/transactions?type=expense">
                    <Plus className="mr-2 h-4 w-4" />
                    {t('expensesTab.viewExpenses')}
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

interface InvoiceCardProps {
  invoice: InvoiceWithItems
  t: (key: string, values?: Record<string, string | number>) => string
  tCommon: (key: string) => string
  locale: string
}

function InvoiceCard({ invoice, t, tCommon, locale }: InvoiceCardProps) {
  const { organizationId } = useAuth()
  const deleteInvoice = useDeleteInvoice(organizationId || undefined)
  const [isDeleting, setIsDeleting] = useState(false)
  const dueDate = new Date(invoice.due_date)
  const issueDate = new Date(invoice.issue_date)
  const isOverdue = invoice.status !== 'paid' && dueDate < new Date()

  async function handleDelete() {
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

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

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
