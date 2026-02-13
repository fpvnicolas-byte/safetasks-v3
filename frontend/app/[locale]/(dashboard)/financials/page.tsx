'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { useInvoices, useOverviewStats, useBankAccounts, useTransactions } from '@/lib/api/hooks'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Plus, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { formatCurrency } from '@/lib/utils/money'
import { InvoiceStatus } from '@/types'
import { useLocale, useTranslations } from 'next-intl'

const ExpenseApprovalDashboard = dynamic(
  () => import('@/components/financials/ExpenseApprovalDashboard').then((mod) => mod.ExpenseApprovalDashboard),
  { loading: () => <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> }
)

const BudgetApprovalDashboard = dynamic(
  () => import('@/components/financials/BudgetApprovalDashboard').then((mod) => mod.BudgetApprovalDashboard),
  { loading: () => <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> }
)

const ProjectsFinancialsTab = dynamic(
  () => import('@/components/financials/ProjectsFinancialsTab').then((mod) => mod.ProjectsFinancialsTab),
  { loading: () => <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> }
)

const FinancialsInvoicesTab = dynamic(
  () => import('./_components/FinancialsInvoicesTab').then((mod) => mod.FinancialsInvoicesTab),
  { loading: () => <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>, ssr: false }
)

const FinancialsBankAccountsTab = dynamic(
  () => import('./_components/FinancialsBankAccountsTab').then((mod) => mod.FinancialsBankAccountsTab),
  { loading: () => <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>, ssr: false }
)

const FinancialsTransactionsTab = dynamic(
  () => import('./_components/FinancialsTransactionsTab').then((mod) => mod.FinancialsTransactionsTab),
  { loading: () => <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>, ssr: false }
)

const FinancialsExpensesTab = dynamic(
  () => import('./_components/FinancialsExpensesTab').then((mod) => mod.FinancialsExpensesTab),
  { loading: () => <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>, ssr: false }
)

export default function FinancialsPage() {
  const { organizationId } = useAuth()
  const locale = useLocale()
  const t = useTranslations('financials')
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all'>('all')
  const [activeTab, setActiveTab] = useState('overview')

  const filters = statusFilter === 'all' ? {} : { status: statusFilter }

  // Fetch only the currently active tab data to avoid unnecessary network work.
  const { data: stats, isLoading: isLoadingStats } = useOverviewStats(activeTab === 'overview' ? (organizationId || undefined) : undefined)
  const { data: invoices, isLoading: isLoadingInvoices, error: invoicesError } = useInvoices(activeTab === 'invoices' ? (organizationId || undefined) : undefined, filters)
  const { data: bankAccounts, isLoading: isLoadingBankAccounts } = useBankAccounts(activeTab === 'bank-accounts' ? (organizationId || undefined) : undefined)
  const { data: recentTransactions, isLoading: isLoadingTransactions } = useTransactions(activeTab === 'transactions' && organizationId ? { organizationId, limit: 5 } : {})
  const { data: recentExpenses, isLoading: isLoadingExpenses } = useTransactions(activeTab === 'expenses' && organizationId ? { organizationId, type: 'expense', limit: 5 } : {})

  return (
    <div className="space-y-8">
      <div className="rounded-xl border bg-card/60 px-6 py-5">
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          {t('overview.breadcrumb')}
        </div>
        <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight font-display">{t('title')}</h1>
            <p className="text-muted-foreground">{t('description')}</p>
          </div>
          <Button asChild>
            <Link href="/financials/new-invoice">
              <Plus className="mr-2 h-4 w-4" />
              {t('newInvoice')}
            </Link>
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap sm:inline-flex w-full sm:w-auto !h-auto gap-1 p-1.5 mb-3">
          <TabsTrigger value="overview" className="flex-1 sm:flex-auto text-[11px] sm:text-sm px-2 sm:px-3 py-1.5 min-w-[22%] sm:min-w-0">{t('overview.tab')}</TabsTrigger>
          <TabsTrigger value="approvals" className="flex-1 sm:flex-auto text-[11px] sm:text-sm px-2 sm:px-3 py-1.5 min-w-[22%] sm:min-w-0">{t('approvals.title')}</TabsTrigger>
          <TabsTrigger value="projects" className="flex-1 sm:flex-auto text-[11px] sm:text-sm px-2 sm:px-3 py-1.5 min-w-[22%] sm:min-w-0">{t('projects.tab')}</TabsTrigger>
          <TabsTrigger value="invoices" className="flex-1 sm:flex-auto text-[11px] sm:text-sm px-2 sm:px-3 py-1.5 min-w-[22%] sm:min-w-0">{t('invoicesTab.tab')}</TabsTrigger>
          <TabsTrigger value="bank-accounts" className="flex-1 sm:flex-auto text-[11px] sm:text-sm px-2 sm:px-3 py-1.5 min-w-[22%] sm:min-w-0">{t('bankAccountsTab.tab')}</TabsTrigger>
          <TabsTrigger value="transactions" className="flex-1 sm:flex-auto text-[11px] sm:text-sm px-2 sm:px-3 py-1.5 min-w-[22%] sm:min-w-0">{t('transactionsTab.tab')}</TabsTrigger>
          <TabsTrigger value="expenses" className="flex-1 sm:flex-auto text-[11px] sm:text-sm px-2 sm:px-3 py-1.5 min-w-[22%] sm:min-w-0">{t('expensesTab.tab')}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {isLoadingStats ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
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
          )}
        </TabsContent>

        <TabsContent value="approvals" className="space-y-8">
          <BudgetApprovalDashboard />
          <ExpenseApprovalDashboard />
        </TabsContent>

        <TabsContent value="projects" className="space-y-4">
          <ProjectsFinancialsTab />
        </TabsContent>

        <TabsContent value="invoices">
          <FinancialsInvoicesTab
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            invoices={invoices}
            isLoading={isLoadingInvoices}
            errorMessage={invoicesError?.message}
            locale={locale}
          />
        </TabsContent>

        <TabsContent value="bank-accounts">
          <FinancialsBankAccountsTab
            bankAccounts={bankAccounts}
            isLoading={isLoadingBankAccounts}
          />
        </TabsContent>

        <TabsContent value="transactions">
          <FinancialsTransactionsTab
            recentTransactions={recentTransactions}
            isLoading={isLoadingTransactions}
            locale={locale}
          />
        </TabsContent>

        <TabsContent value="expenses">
          <FinancialsExpensesTab
            recentExpenses={recentExpenses}
            isLoading={isLoadingExpenses}
            locale={locale}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
