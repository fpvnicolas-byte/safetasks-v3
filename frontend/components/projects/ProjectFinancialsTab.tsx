'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Receipt,
  Wallet,
  MoreHorizontal,
  ExternalLink,
  Loader2
} from 'lucide-react'
import { LocaleLink } from '@/components/LocaleLink'
import { useTransactions, useCreateTransaction } from '@/lib/api/hooks/useTransactions'
import { useBankAccounts } from '@/lib/api/hooks/useBankAccounts'
import { useProjectBudget, CategorySummary } from '@/lib/api/hooks/useBudget'
import { useAuth } from '@/contexts/AuthContext'
import { useTranslations, useLocale } from 'next-intl'
import { formatCurrency } from '@/lib/utils/money'
import { TransactionWithRelations, getCategoryDisplayName, TransactionCategory, dollarsToCents } from '@/types'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'

interface ProjectFinancialsTabProps {
  projectId: string
}

function CategoryProgress({ category, currency }: { category: CategorySummary; currency?: string }) {
  const t = useTranslations('budget.categories')
  const percentSpent = category.estimated_cents > 0
    ? (category.actual_cents / category.estimated_cents) * 100
    : 0

  const getProgressColor = () => {
    if (percentSpent >= 100) return 'bg-red-500'
    if (percentSpent >= 80) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className="font-medium">{t(category.category)}</span>
        <span className="text-muted-foreground">
          {formatCurrency(category.actual_cents, currency)} / {formatCurrency(category.estimated_cents, currency)}
        </span>
      </div>
      <Progress
        value={Math.min(percentSpent, 100)}
        className="h-2"
        indicatorClassName={getProgressColor()}
      />
    </div>
  )
}

function TransactionRow({ transaction, locale, viewDetailsLabel }: { transaction: TransactionWithRelations; locale: string; viewDetailsLabel: string }) {
  const isExpense = transaction.type === 'expense'

  return (
    <div className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-full ${isExpense ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'}`}>
          {isExpense ? <ArrowDownRight className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
        </div>
        <div>
          <p className="font-medium text-sm">
            {transaction.description || getCategoryDisplayName(transaction.category)}
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{new Date(transaction.transaction_date).toLocaleDateString(locale, { month: 'short', day: 'numeric' })}</span>
            <span>•</span>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {getCategoryDisplayName(transaction.category)}
            </Badge>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className={`font-semibold ${isExpense ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
          {isExpense ? '-' : '+'}{formatCurrency(transaction.amount_cents, transaction.bank_account?.currency)}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <LocaleLink href={`/financials/transactions/${transaction.id}`} className="flex items-center gap-2">
                <ExternalLink className="h-4 w-4" />
                {viewDetailsLabel}
              </LocaleLink>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

const EXPENSE_CATEGORIES: TransactionCategory[] = [
  'crew_hire',
  'equipment_rental',
  'logistics',
  'post_production',
  'maintenance',
  'other',
]

export function ProjectFinancialsTab({ projectId }: ProjectFinancialsTabProps) {
  const { organizationId } = useAuth()
  const locale = useLocale()
  const t = useTranslations('projects.details.financials')
  const tBudget = useTranslations('budget')
  const tCategories = useTranslations('budget.categories')
  const tCommon = useTranslations('common')
  const [transactionType, setTransactionType] = useState<'all' | 'expense' | 'income'>('all')

  // Quick add expense dialog state
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [quickAddForm, setQuickAddForm] = useState({
    amount: '',
    description: '',
    category: 'other' as TransactionCategory,
  })

  const { data: budget, isLoading: budgetLoading } = useProjectBudget(projectId)
  const { data: transactions, isLoading: transactionsLoading } = useTransactions({
    organizationId: organizationId || undefined,
    project_id: projectId,
  })
  const { data: bankAccounts } = useBankAccounts(organizationId || undefined)
  const createTransaction = useCreateTransaction()

  // Get default bank account
  const defaultBankAccount = bankAccounts?.find(acc => acc.is_default) || bankAccounts?.[0]

  const handleQuickAddExpense = async () => {
    if (!organizationId || !defaultBankAccount) {
      toast.error(t('quickAdd.noBankAccount'))
      return
    }

    const amountCents = dollarsToCents(parseFloat(quickAddForm.amount) || 0)
    if (amountCents <= 0) {
      toast.error(t('quickAdd.invalidAmount'))
      return
    }

    try {
      await createTransaction.mutateAsync({
        organizationId,
        transaction: {
          bank_account_id: defaultBankAccount.id,
          project_id: projectId,
          type: 'expense',
          category: quickAddForm.category,
          amount_cents: amountCents,
          description: quickAddForm.description || undefined,
          transaction_date: new Date().toISOString().split('T')[0],
        },
      })

      toast.success(t('quickAdd.success'))
      setShowQuickAdd(false)
      setQuickAddForm({ amount: '', description: '', category: 'other' })
    } catch (error) {
      console.error('Failed to create expense:', error)
      toast.error(t('quickAdd.error'))
    }
  }

  // Filter transactions based on selected type
  const filteredTransactions = transactions?.filter(t => {
    if (transactionType === 'all') return true
    return t.type === transactionType
  }) || []

  // Calculate totals
  const totalIncome = transactions?.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount_cents, 0) || 0
  const totalExpenses = transactions?.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount_cents, 0) || 0
  const netBalance = totalIncome - totalExpenses

  // Budget progress
  const percentSpent = budget && budget.total_estimated_cents > 0
    ? (budget.total_actual_cents / budget.total_estimated_cents) * 100
    : 0

  const isLoading = budgetLoading || transactionsLoading

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="animate-pulse space-y-3">
                  <div className="h-4 bg-muted rounded w-1/2" />
                  <div className="h-8 bg-muted rounded w-3/4" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('totalIncome')}</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {formatCurrency(totalIncome)}
                </p>
              </div>
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
                <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('totalExpenses')}</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {formatCurrency(totalExpenses)}
                </p>
              </div>
              <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full">
                <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('netBalance')}</p>
                <p className={`text-2xl font-bold ${netBalance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {formatCurrency(netBalance)}
                </p>
              </div>
              <div className="p-3 bg-primary/10 rounded-full">
                <Wallet className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Budget Overview */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              {tBudget('title')}
            </CardTitle>
            <CardDescription>{t('budgetDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {budget ? (
              <>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{tBudget('total')}</span>
                    <span className={percentSpent >= 100 ? 'text-red-600 font-bold' : ''}>
                      {formatCurrency(budget.total_actual_cents)} / {formatCurrency(budget.total_estimated_cents)}
                    </span>
                  </div>
                  <Progress
                    value={Math.min(percentSpent, 100)}
                    className="h-3"
                    indicatorClassName={percentSpent >= 100 ? 'bg-red-500' : percentSpent >= 80 ? 'bg-yellow-500' : 'bg-green-500'}
                  />
                  <p className="text-xs text-muted-foreground">
                    {percentSpent.toFixed(1)}% {tBudget('spent')}
                    {budget.total_variance_cents < 0 && (
                      <span className="text-red-600 ml-2">
                        ({formatCurrency(Math.abs(budget.total_variance_cents))} {tBudget('overBudget')})
                      </span>
                    )}
                  </p>
                </div>

                {budget.by_category.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium">{tBudget('byCategory')}</h4>
                    {budget.by_category.map((cat) => (
                      <CategoryProgress key={cat.category} category={cat} />
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="text-muted-foreground text-sm">{tBudget('noBudgetLines')}</p>
            )}
          </CardContent>
        </Card>

        {/* Transactions List */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5" />
                  {t('transactions')}
                </CardTitle>
                <CardDescription>{t('transactionsDescription')}</CardDescription>
              </div>
              <Button onClick={() => setShowQuickAdd(true)}>
                <Plus className="mr-2 h-4 w-4" />
                {t('quickAdd.button')}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Filter Tabs */}
            <Tabs value={transactionType} onValueChange={(v) => setTransactionType(v as 'all' | 'expense' | 'income')} className="mb-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="all">{t('filterAll')}</TabsTrigger>
                <TabsTrigger value="expense">{t('filterExpenses')}</TabsTrigger>
                <TabsTrigger value="income">{t('filterIncome')}</TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Transactions */}
            {filteredTransactions.length > 0 ? (
              <div className="space-y-0">
                {filteredTransactions
                  .sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime())
                  .slice(0, 10)
                  .map((transaction) => (
                    <TransactionRow key={transaction.id} transaction={transaction} locale={locale} viewDetailsLabel={t('viewDetails')} />
                  ))}

                {filteredTransactions.length > 10 && (
                  <div className="pt-4 text-center">
                    <Button variant="outline" asChild>
                      <LocaleLink href={`/financials/transactions?project_id=${projectId}`}>
                        {t('viewAllTransactions')} ({filteredTransactions.length})
                      </LocaleLink>
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <Receipt className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground mb-4">{t('noTransactions')}</p>
                <Button onClick={() => setShowQuickAdd(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  {t('addFirstTransaction')}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Add Expense Dialog */}
      <Dialog open={showQuickAdd} onOpenChange={setShowQuickAdd}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('quickAdd.title')}</DialogTitle>
            <DialogDescription>{t('quickAdd.description')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="amount">{t('quickAdd.amount')}</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  R$
                </span>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  className="pl-10"
                  value={quickAddForm.amount}
                  onChange={(e) => setQuickAddForm({ ...quickAddForm, amount: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">{t('quickAdd.category')}</Label>
              <Select
                value={quickAddForm.category}
                onValueChange={(value) => setQuickAddForm({ ...quickAddForm, category: value as TransactionCategory })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {tCategories(cat)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t('quickAdd.descriptionLabel')}</Label>
              <Input
                id="description"
                placeholder={t('quickAdd.descriptionPlaceholder')}
                value={quickAddForm.description}
                onChange={(e) => setQuickAddForm({ ...quickAddForm, description: e.target.value })}
              />
            </div>

            {!defaultBankAccount && (
              <p className="text-sm text-destructive">
                {t('quickAdd.noBankAccountWarning')}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowQuickAdd(false)}>
              {tCommon('cancel')}
            </Button>
            <Button
              onClick={handleQuickAddExpense}
              disabled={createTransaction.isPending || !defaultBankAccount || !quickAddForm.amount}
            >
              {createTransaction.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('quickAdd.submit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
