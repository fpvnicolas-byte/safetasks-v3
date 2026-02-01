'use client'

import { useState } from 'react'
import { useTransactions, useDeleteTransaction, useBankAccounts, useProjects } from '@/lib/api/hooks'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, Eye, Trash2, ArrowUpCircle, ArrowDownCircle, Receipt, TrendingUp, TrendingDown } from 'lucide-react'
import Link from 'next/link'
import { formatCurrency, TransactionType, TransactionCategory } from '@/types'
import { useLocale, useTranslations } from 'next-intl'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'

export default function TransactionsPage() {
  const { organizationId } = useAuth()
  const locale = useLocale()
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<TransactionType | 'all'>('all')
  const [filterBankAccount, setFilterBankAccount] = useState<string>('all')
  const [filterProject, setFilterProject] = useState<string>('all')
  const [filterCategory, setFilterCategory] = useState<string>('all')

  // Get data
  const { data: allTransactions, isLoading, error } = useTransactions({ organizationId: organizationId || '' })
  const { data: bankAccounts } = useBankAccounts(organizationId || '')
  const { data: projects } = useProjects(organizationId || '')
  const deleteTransaction = useDeleteTransaction()
  const t = useTranslations('financials.pages.transactions')
  const tCommon = useTranslations('common.feedback')

  // Apply filters
  const filteredTransactions = allTransactions?.filter(transaction => {
    // Search filter
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase()
      if (
        !transaction.description?.toLowerCase().includes(searchLower) &&
        !transaction.bank_account?.name.toLowerCase().includes(searchLower) &&
        !transaction.project?.title?.toLowerCase().includes(searchLower)
      ) {
        return false
      }
    }

    // Type filter
    if (filterType !== 'all' && transaction.type !== filterType) {
      return false
    }

    // Bank account filter
    if (filterBankAccount !== 'all' && transaction.bank_account_id !== filterBankAccount) {
      return false
    }

    // Project filter
    if (filterProject !== 'all') {
      if (filterProject === 'none' && transaction.project_id !== null) {
        return false
      }
      if (filterProject !== 'none' && transaction.project_id !== filterProject) {
        return false
      }
    }

    // Category filter
    if (filterCategory !== 'all' && transaction.category !== filterCategory) {
      return false
    }

    return true
  }) || []

  // Calculate summary stats
  const totalIncome = filteredTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount_cents, 0)

  const totalExpense = filteredTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount_cents, 0)

  const netBalance = totalIncome - totalExpense

  const [deleteTarget, setDeleteTarget] = useState<{ id: string, description: string } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDeleteTransaction = async () => {
    if (!deleteTarget) return

    setIsDeleting(true)
    try {
      await deleteTransaction.mutateAsync({
        organizationId: organizationId || '',
        transactionId: deleteTarget.id
      })
      setDeleteTarget(null)
    } catch (err: unknown) {
      const error = err as Error
      alert(tCommon('actionError', { message: error.message }))
    } finally {
      setIsDeleting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-display">{t('title')}</h1>
          <p className="text-muted-foreground">{t('loading')}</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-display">{t('title')}</h1>
          <p className="text-destructive">{t('error')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={handleDeleteTransaction}
        loading={isDeleting}
        title={tCommon('confirmActionTitle')}
        description={deleteTarget?.description ? `${tCommon('confirmAction')} (${deleteTarget.description})` : tCommon('confirmAction')}
      />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-display">{t('title')}</h1>
          <p className="text-muted-foreground">
            {t('subtitle')}
          </p>
        </div>
        <Button asChild>
          <Link href="/financials/transactions/new">
            <Plus className="mr-2 h-4 w-4" />
            {t('actions.new')}
          </Link>
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('summary.totalIncome')}</CardTitle>
            <TrendingUp className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              {formatCurrency(totalIncome, 'BRL')}
            </div>
            <p className="text-xs text-muted-foreground">
              {t('summary.transactionCount', {
                count: filteredTransactions.filter(t => t.type === 'income').length
              })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('summary.totalExpenses')}</CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {formatCurrency(totalExpense, 'BRL')}
            </div>
            <p className="text-xs text-muted-foreground">
              {t('summary.transactionCount', {
                count: filteredTransactions.filter(t => t.type === 'expense').length
              })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('summary.netBalance')}</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${netBalance >= 0 ? 'text-success' : 'text-destructive'}`}>
              {formatCurrency(netBalance, 'BRL')}
            </div>
            <p className="text-xs text-muted-foreground">
              {t('summary.totalTransactionCount', { count: filteredTransactions.length })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>{t('filters.title')}</CardTitle>
          <CardDescription>
            {t('filters.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('filters.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Filter Dropdowns */}
          <div className="grid gap-4 md:grid-cols-4">
            {/* Type Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('filters.type.label')}</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as TransactionType | 'all')}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="all">{t('filters.type.all')}</option>
                <option value="income">{t('filters.type.income')}</option>
                <option value="expense">{t('filters.type.expense')}</option>
              </select>
            </div>

            {/* Bank Account Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('filters.bankAccount.label')}</label>
              <select
                value={filterBankAccount}
                onChange={(e) => setFilterBankAccount(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="all">{t('filters.bankAccount.all')}</option>
                {bankAccounts?.map(account => (
                  <option key={account.id} value={account.id}>
                    {account.name} ({account.currency})
                  </option>
                ))}
              </select>
            </div>

            {/* Project Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('filters.project.label')}</label>
              <select
                value={filterProject}
                onChange={(e) => setFilterProject(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="all">{t('filters.project.all')}</option>
                <option value="none">{t('filters.project.none')}</option>
                {projects?.map(project => (
                  <option key={project.id} value={project.id}>
                    {project.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Category Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('filters.category.label')}</label>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="all">{t('filters.category.all')}</option>
                <option value="crew_hire">{t('categories.crew_hire')}</option>
                <option value="equipment_rental">{t('categories.equipment_rental')}</option>
                <option value="logistics">{t('categories.logistics')}</option>
                <option value="post_production">{t('categories.post_production')}</option>
                <option value="maintenance">{t('categories.maintenance')}</option>
                <option value="production_revenue">{t('categories.production_revenue')}</option>
                <option value="other">{t('categories.other')}</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transaction List */}
      {filteredTransactions.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Receipt className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-semibold mb-2">
                {allTransactions && allTransactions.length > 0
                  ? t('empty.filteredTitle')
                  : t('empty.noTransactionsTitle')}
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                {allTransactions && allTransactions.length > 0
                  ? t('empty.filteredDescription')
                  : t('empty.noTransactionsDescription')}
              </p>
              {(!allTransactions || allTransactions.length === 0) && (
                <Button asChild>
                  <Link href="/financials/transactions/new">
                    <Plus className="mr-2 h-4 w-4" />
                    {t('empty.addFirst')}
                  </Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{t('list.title')}</CardTitle>
            <CardDescription>
              {t('list.description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {filteredTransactions
                .sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime())
                .map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      {/* Type Icon */}
                      {transaction.type === 'income' ? (
                        <ArrowUpCircle className="h-8 w-8 text-success" />
                      ) : (
                        <ArrowDownCircle className="h-8 w-8 text-destructive" />
                      )}

                      {/* Transaction Details */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">
                            {transaction.description || t('list.untitled')}
                          </p>
                          <Badge variant={transaction.type === 'income' ? 'success' : 'destructive'}>
                            {t(`types.${transaction.type}`)}
                          </Badge>
                          <Badge variant="secondary">
                            {t(`categories.${transaction.category as TransactionCategory}`)}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                          <span>{transaction.bank_account?.name}</span>
                          {transaction.project && (
                            <span>{transaction.project.title}</span>
                          )}
                          <span>{new Date(transaction.transaction_date).toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        </div>
                      </div>

                      {/* Amount */}
                      <div className={`text-xl font-bold ${transaction.type === 'income' ? 'text-success' : 'text-destructive'}`}>
                        {transaction.type === 'income' ? '+' : '-'}
                        {formatCurrency(transaction.amount_cents, transaction.bank_account?.currency || 'BRL')}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 ml-4">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/financials/transactions/${transaction.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDeleteTarget({ id: transaction.id, description: transaction.description || '' })}
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      {allTransactions && allTransactions.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                {t('summary.showing', {
                  filtered: filteredTransactions.length,
                  total: allTransactions.length
                })}
              </span>
              <span>
                {t('summary.netLabel')}{' '}
                <span className={netBalance >= 0 ? 'text-success' : 'text-destructive'}>
                  {formatCurrency(netBalance, 'BRL')}
                </span>
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
