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
import { formatCurrency, getCategoryDisplayName, TransactionType, TransactionCategory } from '@/types'
import { useLocale, useTranslations } from 'next-intl'

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
  const t = useTranslations('financials.transactions')
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

  const handleDeleteTransaction = async (transactionId: string, description: string) => {
    if (!confirm(tCommon('confirmAction'))) { // Ideally customize this message to include description if needed, or stick to generic
      return
    }

    try {
      await deleteTransaction.mutateAsync({
        organizationId: organizationId || '',
        transactionId: transactionId
      })
    } catch (err: unknown) {
      const error = err as Error
      alert(tCommon('actionError', { message: error.message }))
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
          <p className="text-muted-foreground">Loading transactions...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
          <p className="text-destructive">Failed to load transactions. Please try again.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
          <p className="text-muted-foreground">
            Record income and expenses to track cash flow
          </p>
        </div>
        <Button asChild>
          <Link href="/financials/transactions/new">
            <Plus className="mr-2 h-4 w-4" />
            New Transaction
          </Link>
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Income</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(totalIncome, 'BRL')}
            </div>
            <p className="text-xs text-muted-foreground">
              {filteredTransactions.filter(t => t.type === 'income').length} transaction{filteredTransactions.filter(t => t.type === 'income').length !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(totalExpense, 'BRL')}
            </div>
            <p className="text-xs text-muted-foreground">
              {filteredTransactions.filter(t => t.type === 'expense').length} transaction{filteredTransactions.filter(t => t.type === 'expense').length !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Balance</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${netBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(netBalance, 'BRL')}
            </div>
            <p className="text-xs text-muted-foreground">
              {filteredTransactions.length} total transaction{filteredTransactions.length !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filter Transactions</CardTitle>
          <CardDescription>
            Search and filter transactions by type, account, project, or category
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by description, account, or project..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Filter Dropdowns */}
          <div className="grid gap-4 md:grid-cols-4">
            {/* Type Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Type</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as TransactionType | 'all')}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="all">All Types</option>
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </select>
            </div>

            {/* Bank Account Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Bank Account</label>
              <select
                value={filterBankAccount}
                onChange={(e) => setFilterBankAccount(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="all">All Accounts</option>
                {bankAccounts?.map(account => (
                  <option key={account.id} value={account.id}>
                    {account.name} ({account.currency})
                  </option>
                ))}
              </select>
            </div>

            {/* Project Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Project</label>
              <select
                value={filterProject}
                onChange={(e) => setFilterProject(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="all">All Projects</option>
                <option value="none">No Project</option>
                {projects?.map(project => (
                  <option key={project.id} value={project.id}>
                    {project.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Category Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Category</label>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="all">All Categories</option>
                <option value="crew_hire">Crew Hire</option>
                <option value="equipment_rental">Equipment Rental</option>
                <option value="logistics">Logistics</option>
                <option value="post_production">Post Production</option>
                <option value="maintenance">Maintenance</option>
                <option value="production_revenue">Production Revenue</option>
                <option value="other">Other</option>
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
                {allTransactions && allTransactions.length > 0 ? 'No transactions found' : 'No transactions yet'}
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                {allTransactions && allTransactions.length > 0
                  ? 'Try adjusting your filters'
                  : 'Get started by recording your first transaction'}
              </p>
              {(!allTransactions || allTransactions.length === 0) && (
                <Button asChild>
                  <Link href="/financials/transactions/new">
                    <Plus className="mr-2 h-4 w-4" />
                    Add First Transaction
                  </Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
            <CardDescription>
              All transactions sorted by date (newest first)
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
                        <ArrowUpCircle className="h-8 w-8 text-green-600" />
                      ) : (
                        <ArrowDownCircle className="h-8 w-8 text-red-600" />
                      )}

                      {/* Transaction Details */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">
                            {transaction.description || 'Untitled Transaction'}
                          </p>
                          <Badge variant="outline" className={transaction.type === 'income' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}>
                            {transaction.type}
                          </Badge>
                          <Badge variant="secondary">
                            {getCategoryDisplayName(transaction.category as TransactionCategory)}
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
                      <div className={`text-xl font-bold ${transaction.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
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
                        onClick={() => handleDeleteTransaction(transaction.id, transaction.description || '')}
                        className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
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
                Showing {filteredTransactions.length} of {allTransactions.length} transaction{allTransactions.length !== 1 ? 's' : ''}
              </span>
              <span>
                Net: <span className={netBalance >= 0 ? 'text-green-600' : 'text-red-600'}>
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
