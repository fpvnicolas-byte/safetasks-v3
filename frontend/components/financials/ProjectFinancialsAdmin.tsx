'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  ShieldCheck,
  AlertTriangle,
  Calculator,
  Target,
  Banknote,
} from 'lucide-react'
import { LocaleLink } from '@/components/LocaleLink'
import { useTransactions, useCreateTransaction } from '@/lib/api/hooks/useTransactions'
import { useBankAccounts } from '@/lib/api/hooks/useBankAccounts'
import { useProjectBudget, CategorySummary } from '@/lib/api/hooks/useBudget'
import { useSubmitBudget, useApproveBudget, useRejectBudget, useProjectFinancialSummary } from '@/lib/api/hooks/useProjects'
import { useAuth } from '@/contexts/AuthContext'
import { useTranslations, useLocale } from 'next-intl'
import { formatCurrency } from '@/lib/utils/money'
import { TransactionWithRelations, getCategoryDisplayName, TransactionCategory, dollarsToCents, ProjectWithClient, BudgetStatus, ProjectFinancialSummary } from '@/types'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'

interface ProjectFinancialsAdminProps {
  projectId: string
  project?: ProjectWithClient
  isAdmin?: boolean
}

// Budget status badge component
function BudgetStatusBadge({ status }: { status: BudgetStatus }) {
  const t = useTranslations('projects.details.financials.budgetApproval.status')

  const config = {
    draft: { icon: Clock, className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
    pending_approval: { icon: Clock, className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
    approved: { icon: CheckCircle2, className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
    rejected: { icon: XCircle, className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
    increment_pending: { icon: Clock, className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  }

  const { icon: Icon, className } = config[status] || config.draft

  return (
    <Badge className={`${className} gap-1`}>
      <Icon className="h-3 w-3" />
      {t(status)}
    </Badge>
  )
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

export function ProjectFinancialsAdmin({ projectId, project, isAdmin = false }: ProjectFinancialsAdminProps) {
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

  // Budget approval dialog states
  const [showSubmitBudget, setShowSubmitBudget] = useState(false)
  const [showRejectBudget, setShowRejectBudget] = useState(false)
  const [budgetForm, setBudgetForm] = useState({
    amount: '',
    notes: '',
  })
  const [rejectionReason, setRejectionReason] = useState('')

  const { data: budget, isLoading: budgetLoading, error: budgetError } = useProjectBudget(projectId)
  const { data: transactions, isLoading: transactionsLoading } = useTransactions({
    organizationId: organizationId || undefined,
    project_id: projectId,
  })
  const { data: bankAccounts } = useBankAccounts(organizationId || undefined)
  const createTransaction = useCreateTransaction()

  // Budget approval mutations
  const submitBudget = useSubmitBudget(projectId, organizationId || '')
  const approveBudget = useApproveBudget(projectId, organizationId || '')
  const rejectBudget = useRejectBudget(projectId, organizationId || '')

  // Financial summary for calculator
  const { data: financialSummary, isLoading: financialLoading } = useProjectFinancialSummary(projectId)

  // Get first bank account (default not supported in type)
  const defaultBankAccount = bankAccounts?.[0]

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

  // Budget approval handlers
  const handleSubmitBudget = async () => {
    const amountCents = dollarsToCents(parseFloat(budgetForm.amount) || 0)
    if (amountCents <= 0) {
      toast.error(t('quickAdd.invalidAmount'))
      return
    }

    try {
      await submitBudget.mutateAsync({
        budget_total_cents: amountCents,
        notes: budgetForm.notes || undefined,
      })
      toast.success(t('budgetApproval.submitSuccess'))
      setShowSubmitBudget(false)
      setBudgetForm({ amount: '', notes: '' })
    } catch (error) {
      console.error('Failed to submit budget:', error)
      toast.error(t('budgetApproval.error'))
    }
  }

  const handleApproveBudget = async () => {
    try {
      await approveBudget.mutateAsync({})
      toast.success(t('budgetApproval.approveSuccess'))
    } catch (error) {
      console.error('Failed to approve budget:', error)
      toast.error(t('budgetApproval.error'))
    }
  }

  const handleRejectBudget = async () => {
    if (!rejectionReason.trim()) {
      return
    }

    try {
      await rejectBudget.mutateAsync({ reason: rejectionReason })
      toast.success(t('budgetApproval.rejectSuccess'))
      setShowRejectBudget(false)
      setRejectionReason('')
    } catch (error) {
      console.error('Failed to reject budget:', error)
      toast.error(t('budgetApproval.error'))
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

  const estimatedBudgetCents = budget?.total_estimated_cents && budget.total_estimated_cents > 0
    ? budget.total_estimated_cents
    : (project?.budget_total_cents || 0)
  const actualSpentCents = totalExpenses
  const budgetVarianceCents = estimatedBudgetCents - actualSpentCents
  const percentSpent = estimatedBudgetCents > 0 ? (actualSpentCents / estimatedBudgetCents) * 100 : 0

  // Get budget status from project
  const budgetStatus = project?.budget_status || 'draft'

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
      {/* Budget Approval Card */}
      {project && (
        <Card className={`border-2 ${budgetStatus === 'approved' ? 'border-green-500/30 bg-green-50/50 dark:bg-green-950/20' :
          budgetStatus === 'pending_approval' ? 'border-yellow-500/30 bg-yellow-50/50 dark:bg-yellow-950/20' :
            budgetStatus === 'rejected' ? 'border-red-500/30 bg-red-50/50 dark:bg-red-950/20' :
              'border-border'
          }`}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${budgetStatus === 'approved' ? 'bg-green-100 dark:bg-green-900/30' :
                  budgetStatus === 'pending_approval' ? 'bg-yellow-100 dark:bg-yellow-900/30' :
                    budgetStatus === 'rejected' ? 'bg-red-100 dark:bg-red-900/30' :
                      'bg-gray-100 dark:bg-gray-800'
                  }`}>
                  <ShieldCheck className={`h-5 w-5 ${budgetStatus === 'approved' ? 'text-green-600 dark:text-green-400' :
                    budgetStatus === 'pending_approval' ? 'text-yellow-600 dark:text-yellow-400' :
                      budgetStatus === 'rejected' ? 'text-red-600 dark:text-red-400' :
                        'text-gray-600 dark:text-gray-400'
                    }`} />
                </div>
                <div>
                  <CardTitle className="text-lg">{t('budgetApproval.title')}</CardTitle>
                  <div className="flex items-center gap-2 mt-1">
                    <BudgetStatusBadge status={budgetStatus} />
                    {project.budget_total_cents > 0 && (
                      <span className="text-sm text-muted-foreground">
                        • {formatCurrency(project.budget_total_cents)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Draft or Rejected: Show submit button */}
                {(budgetStatus === 'draft' || budgetStatus === 'rejected') && (
                  <Button onClick={() => setShowSubmitBudget(true)} size="sm">
                    <Send className="h-4 w-4 mr-2" />
                    {t('budgetApproval.submit')}
                  </Button>
                )}
                {/* Pending approval + Admin: Show approve/reject buttons */}
                {(budgetStatus === 'pending_approval' || budgetStatus === 'increment_pending') && isAdmin && (
                  <>
                    <Button onClick={handleApproveBudget} size="sm" variant="default" disabled={approveBudget.isPending}>
                      {approveBudget.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                      )}
                      {budgetStatus === 'increment_pending' ? t('budgetApproval.approveIncrement') : t('budgetApproval.approve')}
                    </Button>
                    <Button onClick={() => setShowRejectBudget(true)} size="sm" variant="destructive">
                      <XCircle className="h-4 w-4 mr-2" />
                      {t('budgetApproval.reject')}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-sm text-muted-foreground">
              {budgetStatus === 'pending_approval' && t('budgetApproval.pendingMessage')}
              {budgetStatus === 'rejected' && t('budgetApproval.rejectedMessage')}
              {budgetStatus === 'draft' && t('budgetApproval.draftMessage')}
              {budgetStatus === 'approved' && project.budget_notes && (
                <span>{project.budget_notes}</span>
              )}
              {budgetStatus === 'increment_pending' && (
                <span className="flex flex-col gap-1">
                  <span>{t('budgetApproval.incrementPendingAdminMessage')}</span>
                  <span className="font-medium">
                    {t('budgetApproval.currentBudget')}: {formatCurrency(project.budget_total_cents)}
                  </span>
                  <span className="font-medium text-orange-600 dark:text-orange-400">
                    {t('budgetApproval.requestedIncrement')}: {formatCurrency(project.budget_increment_requested_cents ?? 0)}
                  </span>
                  <span className="font-medium text-green-600 dark:text-green-400">
                    {t('budgetApproval.newTotal')}: {formatCurrency(project.budget_total_cents + (project.budget_increment_requested_cents ?? 0))}
                  </span>
                  {project.budget_increment_notes && (
                    <span className="text-xs">{t('budgetApproval.notes')}: {project.budget_increment_notes}</span>
                  )}
                </span>
              )}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Financial Calculator Card */}
      {financialSummary && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-primary" />
              <CardTitle>{t('financialCalculator.title')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
              {/* Proposal Value */}
              <div className="space-y-1 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20">
                <div className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400">
                  <Target className="h-3.5 w-3.5" />
                  {t('financialCalculator.proposalValue')}
                </div>
                <p className="text-xl font-bold text-blue-700 dark:text-blue-300">
                  {financialSummary.proposal_value_cents > 0
                    ? formatCurrency(financialSummary.proposal_value_cents)
                    : <span className="text-sm text-muted-foreground">{t('financialCalculator.noProposal')}</span>
                  }
                </p>
              </div>

              {/* Approved Budget */}
              <div className={`space-y-1 p-3 rounded-lg ${financialSummary.budget_status === 'approved'
                ? 'bg-green-50 dark:bg-green-950/20'
                : 'bg-gray-50 dark:bg-gray-800/50'
                }`}>
                <div className={`flex items-center gap-1.5 text-xs ${financialSummary.budget_status === 'approved'
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-muted-foreground'
                  }`}>
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {t('financialCalculator.approvedBudget')}
                </div>
                <p className={`text-xl font-bold ${financialSummary.budget_status === 'approved'
                  ? 'text-green-700 dark:text-green-300'
                  : 'text-muted-foreground'
                  }`}>
                  {financialSummary.budget_status === 'approved'
                    ? formatCurrency(financialSummary.budget_total_cents)
                    : <span className="text-sm">{t('financialCalculator.budgetPending')}</span>
                  }
                </p>
              </div>

              {/* Total Income */}
              <div className="space-y-1 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20">
                <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                  <TrendingUp className="h-3.5 w-3.5" />
                  {t('financialCalculator.totalIncome')}
                </div>
                <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
                  {formatCurrency(financialSummary.total_income_cents)}
                </p>
              </div>

              {/* Total Expenses */}
              <div className="space-y-1 p-3 rounded-lg bg-red-50 dark:bg-red-950/20">
                <div className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
                  <TrendingDown className="h-3.5 w-3.5" />
                  {t('financialCalculator.totalExpenses')}
                </div>
                <p className="text-xl font-bold text-red-700 dark:text-red-300">
                  {formatCurrency(financialSummary.total_expense_cents)}
                </p>
              </div>

              {/* Remaining Budget */}
              <div className={`space-y-1 p-3 rounded-lg ${financialSummary.remaining_budget_cents >= 0
                ? 'bg-purple-50 dark:bg-purple-950/20'
                : 'bg-orange-50 dark:bg-orange-950/20'
                }`}>
                <div className={`flex items-center gap-1.5 text-xs ${financialSummary.remaining_budget_cents >= 0
                  ? 'text-purple-600 dark:text-purple-400'
                  : 'text-orange-600 dark:text-orange-400'
                  }`}>
                  <Wallet className="h-3.5 w-3.5" />
                  {financialSummary.remaining_budget_cents >= 0
                    ? t('financialCalculator.remainingBudget')
                    : t('financialCalculator.overBudget')
                  }
                </div>
                <p className={`text-xl font-bold ${financialSummary.remaining_budget_cents >= 0
                  ? 'text-purple-700 dark:text-purple-300'
                  : 'text-orange-700 dark:text-orange-300'
                  }`}>
                  {formatCurrency(Math.abs(financialSummary.remaining_budget_cents))}
                </p>
              </div>

              {/* Profit */}
              <div className={`space-y-1 p-3 rounded-lg ${financialSummary.profit_cents >= 0
                ? 'bg-cyan-50 dark:bg-cyan-950/20'
                : 'bg-rose-50 dark:bg-rose-950/20'
                }`}>
                <div className={`flex items-center gap-1.5 text-xs ${financialSummary.profit_cents >= 0
                  ? 'text-cyan-600 dark:text-cyan-400'
                  : 'text-rose-600 dark:text-rose-400'
                  }`}>
                  <Banknote className="h-3.5 w-3.5" />
                  {t('financialCalculator.profit')}
                  {financialSummary.profit_margin_percent !== null && (
                    <span className="ml-1">({financialSummary.profit_margin_percent}%)</span>
                  )}
                </div>
                <p className={`text-xl font-bold ${financialSummary.profit_cents >= 0
                  ? 'text-cyan-700 dark:text-cyan-300'
                  : 'text-rose-700 dark:text-rose-300'
                  }`}>
                  {financialSummary.profit_cents >= 0 ? '+' : '-'}
                  {formatCurrency(Math.abs(financialSummary.profit_cents))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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

        {/* Profit Margin Card */}
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm font-medium text-muted-foreground">{t('profitMargin')}</p>
              <p className={`text-2xl font-bold ${netBalance >= 0 ? 'text-primary' : 'text-red-600 dark:text-red-400'}`}>
                {totalIncome > 0 ? ((netBalance / totalIncome) * 100).toFixed(1) : 0}%
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {t('profitOf')} {formatCurrency(Math.abs(netBalance))}
              </p>
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
            {budgetError && (
              <p className="text-sm text-destructive">
                {tCommon('error')}: {budgetError instanceof Error ? budgetError.message : String(budgetError)}
              </p>
            )}

            {estimatedBudgetCents > 0 ? (
              <>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{tBudget('total')}</span>
                    <span className={percentSpent >= 100 ? 'text-red-600 font-bold' : ''}>
                      {formatCurrency(actualSpentCents)} / {formatCurrency(estimatedBudgetCents)}
                    </span>
                  </div>
                  <Progress
                    value={Math.min(percentSpent, 100)}
                    className="h-3"
                    indicatorClassName={percentSpent >= 100 ? 'bg-red-500' : percentSpent >= 80 ? 'bg-yellow-500' : 'bg-green-500'}
                  />
                  <p className="text-xs text-muted-foreground">
                    {percentSpent.toFixed(1)}% {tBudget('spent')}
                    {budgetVarianceCents < 0 && (
                      <span className="text-red-600 ml-2">
                        ({formatCurrency(Math.abs(budgetVarianceCents))} {tBudget('overBudget')})
                      </span>
                    )}
                  </p>
                </div>

                {budget && budget.by_category.length > 0 && (
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

      {/* Submit Budget Dialog */}
      <Dialog open={showSubmitBudget} onOpenChange={setShowSubmitBudget}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('budgetApproval.submitTitle')}</DialogTitle>
            <DialogDescription>{t('budgetApproval.submitDescription')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="budget-amount">{t('budgetApproval.budgetAmount')}</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  R$
                </span>
                <Input
                  id="budget-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder={t('budgetApproval.budgetAmountPlaceholder')}
                  className="pl-10"
                  value={budgetForm.amount}
                  onChange={(e) => setBudgetForm({ ...budgetForm, amount: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="budget-notes">{t('budgetApproval.notes')}</Label>
              <Textarea
                id="budget-notes"
                placeholder={t('budgetApproval.notesPlaceholder')}
                value={budgetForm.notes}
                onChange={(e) => setBudgetForm({ ...budgetForm, notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubmitBudget(false)}>
              {tCommon('cancel')}
            </Button>
            <Button
              onClick={handleSubmitBudget}
              disabled={submitBudget.isPending || !budgetForm.amount}
            >
              {submitBudget.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('budgetApproval.submit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Budget Dialog */}
      <Dialog open={showRejectBudget} onOpenChange={setShowRejectBudget}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('budgetApproval.reject')}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rejection-reason">{t('budgetApproval.rejectionReason')}</Label>
              <Textarea
                id="rejection-reason"
                placeholder={t('budgetApproval.rejectionReasonPlaceholder')}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectBudget(false)}>
              {tCommon('cancel')}
            </Button>
            <Button
              onClick={handleRejectBudget}
              disabled={rejectBudget.isPending || !rejectionReason.trim()}
              variant="destructive"
            >
              {rejectBudget.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('budgetApproval.reject')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
