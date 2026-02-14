'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
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
    ArrowDownRight,
    Wallet,
    Loader2,
    CheckCircle2,
    XCircle,
    Clock,
    Send,
    AlertTriangle,
} from 'lucide-react'
import { useTransactions, useCreateTransaction } from '@/lib/api/hooks/useTransactions'
import { useBankAccounts } from '@/lib/api/hooks/useBankAccounts'
import { useOrganization } from '@/lib/api/hooks/useOrganization'
import { useProjectBudget } from '@/lib/api/hooks/useBudget'
import { useSubmitBudget, useRequestBudgetIncrement } from '@/lib/api/hooks/useProjects'
import { useAuth } from '@/contexts/AuthContext'
import { useTranslations, useLocale } from 'next-intl'
import { formatCurrency } from '@/lib/utils/money'
import { getCategoryDisplayName, TransactionCategory, toCents, fromCents, ProjectWithClient, BudgetStatus } from '@/types'
import { toast } from 'sonner'

interface ProjectExpensesTabProps {
    projectId: string
    project?: ProjectWithClient
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

const EXPENSE_CATEGORIES: TransactionCategory[] = [
    'crew_hire',
    'equipment_rental',
    'logistics',
    'post_production',
    'maintenance',
    'other',
]

export function ProjectExpensesTab({ projectId, project }: ProjectExpensesTabProps) {
    const { organizationId } = useAuth()
    const locale = useLocale()
    const t = useTranslations('projects.details.financials')
    const tCategories = useTranslations('budget.categories')
    const tCommon = useTranslations('common')
    const tApprovals = useTranslations('financials.approvals')

    // Quick add expense dialog state
    const [showQuickAdd, setShowQuickAdd] = useState(false)
    const [quickAddForm, setQuickAddForm] = useState({
        amount: '',
        description: '',
        category: 'other' as TransactionCategory,
    })

    // Budget submission dialog
    const [showSubmitBudget, setShowSubmitBudget] = useState(false)
    const [budgetForm, setBudgetForm] = useState({
        amount: '',
        notes: '',
    })

    // Budget increment request dialog
    const [showRequestIncrement, setShowRequestIncrement] = useState(false)
    const [incrementForm, setIncrementForm] = useState({
        amount: '',
        notes: '',
    })
    const [expenseScope, setExpenseScope] = useState<'all' | 'crew' | 'general'>('all')

    const { isLoading: budgetLoading } = useProjectBudget(projectId)
    const { data: transactions, isLoading: transactionsLoading } = useTransactions({
        organizationId: organizationId || undefined,
        project_id: projectId,
        type: 'expense', // Only fetch expenses for producer view
    })
    const { data: organization } = useOrganization(organizationId || undefined)
    const { data: bankAccounts } = useBankAccounts(organizationId || undefined)
    const createTransaction = useCreateTransaction()
    const submitBudget = useSubmitBudget(projectId, organizationId || '')
    const requestIncrement = useRequestBudgetIncrement(projectId, organizationId || '')

    const defaultBankAccount =
        bankAccounts?.find((account) => account.id === organization?.default_bank_account_id) ??
        bankAccounts?.[0]

    // Calculate budget values - only count approved/paid expenses toward budget
    const budgetLimit = project?.budget_total_cents || 0

    // Separate team expenses (crew_hire with stakeholder_id) from other expenses
    const teamExpenses = transactions?.filter(t => t.stakeholder_id) || []
    const otherExpenses = transactions?.filter(t => !t.stakeholder_id) || []

    // Only count approved or paid expenses toward budget used
    const approvedExpenses = transactions?.filter(t =>
        t.payment_status === 'approved' || t.payment_status === 'paid'
    ) || []
    const pendingExpenses = transactions?.filter(t => t.payment_status === 'pending') || []

    const totalApprovedExpenses = approvedExpenses.reduce((sum, t) => sum + t.amount_cents, 0)
    const totalPendingExpenses = pendingExpenses.reduce((sum, t) => sum + t.amount_cents, 0)
    const totalTeamApproved = teamExpenses.filter(t =>
        t.payment_status === 'approved' || t.payment_status === 'paid'
    ).reduce((sum, t) => sum + t.amount_cents, 0)
    const totalOtherApproved = otherExpenses.filter(t =>
        t.payment_status === 'approved' || t.payment_status === 'paid'
    ).reduce((sum, t) => sum + t.amount_cents, 0)

    const filteredExpenses = (transactions || []).filter((transaction) => {
        if (expenseScope === 'crew') return Boolean(transaction.stakeholder_id)
        if (expenseScope === 'general') return !transaction.stakeholder_id
        return true
    })
    const visibleExpenses = filteredExpenses
        .slice()
        .sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime())
        .slice(0, 10)

    // Budget used = only approved expenses
    const totalExpenses = totalApprovedExpenses
    const remaining = budgetLimit - totalExpenses
    const percentSpent = budgetLimit > 0 ? (totalExpenses / budgetLimit) * 100 : 0
    const isOverBudget = remaining < 0
    const budgetStatus = project?.budget_status || 'draft'
    const isBudgetApproved = budgetStatus === 'approved'
    const isIncrementPending = budgetStatus === 'increment_pending'

    // Initialize budget form with existing budget value when dialog opens
    useEffect(() => {
        if (showSubmitBudget && project?.budget_total_cents) {
            setBudgetForm(prev => ({
                ...prev,
                amount: fromCents(project.budget_total_cents).toString()
            }))
        }
    }, [showSubmitBudget, project?.budget_total_cents])

    const handleQuickAddExpense = async () => {
        if (!organizationId || !defaultBankAccount) {
            toast.error(t('quickAdd.noBankAccount'))
            return
        }

        const amountCents = toCents(parseFloat(quickAddForm.amount) || 0)
        if (amountCents <= 0) {
            toast.error(t('quickAdd.invalidAmount'))
            return
        }

        // Check if expense would exceed budget - BLOCK
        if (isBudgetApproved && (totalExpenses + amountCents) > budgetLimit) {
            toast.error(t('producer.exceedsBudgetBlocked'))
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

    const handleSubmitBudget = async () => {
        const amountCents = toCents(parseFloat(budgetForm.amount) || 0)
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

    const handleRequestIncrement = async () => {
        const incrementCents = toCents(parseFloat(incrementForm.amount) || 0)
        if (incrementCents <= 0) {
            toast.error(t('quickAdd.invalidAmount'))
            return
        }

        try {
            await requestIncrement.mutateAsync({
                increment_cents: incrementCents,
                notes: incrementForm.notes || undefined,
            })
            toast.success(t('budgetApproval.incrementSuccess'))
            setShowRequestIncrement(false)
            setIncrementForm({ amount: '', notes: '' })
        } catch (error) {
            console.error('Failed to request budget increment:', error)
            toast.error(t('budgetApproval.error'))
        }
    }

    // Calculate how much user can still spend
    const maxExpenseAllowed = isBudgetApproved ? Math.max(0, remaining) : 0

    const isLoading = budgetLoading || transactionsLoading

    if (isLoading) {
        return (
            <div className="space-y-4">
                <Card>
                    <CardContent className="pt-6">
                        <div className="animate-pulse space-y-3">
                            <div className="h-4 bg-muted rounded w-1/2" />
                            <div className="h-8 bg-muted rounded w-3/4" />
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* Budget Overview Card */}
            <Card className={`border-2 ${isOverBudget ? 'border-red-500/30 bg-red-50/50 dark:bg-red-950/20' :
                isBudgetApproved ? 'border-green-500/30 bg-green-50/50 dark:bg-green-950/20' :
                    'border-border'
                }`}>
                <CardHeader className="pb-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-full shrink-0 ${isOverBudget ? 'bg-red-100 dark:bg-red-900/30' :
                                isBudgetApproved ? 'bg-green-100 dark:bg-green-900/30' :
                                    'bg-gray-100 dark:bg-gray-800'
                                }`}>
                                <Wallet className={`h-5 w-5 ${isOverBudget ? 'text-red-600 dark:text-red-400' :
                                    isBudgetApproved ? 'text-green-600 dark:text-green-400' :
                                        'text-gray-600 dark:text-gray-400'
                                    }`} />
                            </div>
                            <div>
                                <CardTitle className="text-base sm:text-lg">{t('producer.budgetOverview')}</CardTitle>
                                <div className="flex items-center gap-2 mt-1">
                                    <BudgetStatusBadge status={budgetStatus} />
                                </div>
                            </div>
                        </div>
                        {/* Submit budget button for draft/rejected */}
                        {(budgetStatus === 'draft' || budgetStatus === 'rejected') && (
                            <Button onClick={() => setShowSubmitBudget(true)} size="sm" className="w-full sm:w-auto">
                                <Send className="h-4 w-4 mr-2" />
                                {t('budgetApproval.submit')}
                            </Button>
                        )}
                        {/* Request Budget Increase button for approved budgets */}
                        {isBudgetApproved && (
                            <Button onClick={() => setShowRequestIncrement(true)} size="sm" variant="outline" className="w-full sm:w-auto">
                                <Plus className="h-4 w-4 mr-2" />
                                {t('budgetApproval.requestIncrement')}
                            </Button>
                        )}
                        {/* Pending increment indicator */}
                        {isIncrementPending && (
                            <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400 text-sm">
                                <Clock className="h-4 w-4" />
                                <span>{t('budgetApproval.incrementPending')}</span>
                            </div>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Budget Stats */}
                    <div className="grid grid-cols-3 gap-2 sm:gap-4 text-center">
                        <div>
                            <p className="text-[10px] sm:text-xs text-muted-foreground mb-1">{t('producer.budgetLimit')}</p>
                            <p className="text-sm sm:text-xl font-bold truncate">{formatCurrency(budgetLimit)}</p>
                        </div>
                        <div>
                            <p className="text-[10px] sm:text-xs text-muted-foreground mb-1">{t('producer.spent')}</p>
                            <p className="text-sm sm:text-xl font-bold text-red-600 dark:text-red-400 truncate">
                                {formatCurrency(totalExpenses)}
                            </p>
                            {totalPendingExpenses > 0 && (
                                <p className="text-[10px] sm:text-xs text-yellow-600 dark:text-yellow-400">
                                    + {formatCurrency(totalPendingExpenses)} {tApprovals('waitingApproval').toLocaleLowerCase(locale)}
                                </p>
                            )}
                        </div>
                        <div>
                            <p className="text-[10px] sm:text-xs text-muted-foreground mb-1">{t('producer.remaining')}</p>
                            <p className={`text-sm sm:text-xl font-bold truncate ${isOverBudget ? 'text-red-600' : 'text-green-600'}`}>
                                {isOverBudget ? '-' : ''}{formatCurrency(Math.abs(remaining))}
                            </p>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    {budgetLimit > 0 && (
                        <div className="space-y-2">
                            <Progress
                                value={Math.min(percentSpent, 100)}
                                className="h-3"
                                indicatorClassName={
                                    percentSpent >= 100 ? 'bg-red-500' :
                                        percentSpent >= 80 ? 'bg-yellow-500' :
                                            'bg-green-500'
                                }
                            />
                            <p className="text-xs text-muted-foreground text-center">
                                {percentSpent.toFixed(1)}% {t('producer.ofBudgetUsed')}
                            </p>
                        </div>
                    )}

                    {/* Over Budget Warning */}
                    {isOverBudget && (
                        <div className="flex flex-col gap-2 p-3 rounded-lg bg-red-100 dark:bg-red-900/30">
                            <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                                <AlertTriangle className="h-4 w-4" />
                                <span className="text-sm font-medium">{t('producer.overBudgetWarning')}</span>
                            </div>
                            {isBudgetApproved && (
                                <Button
                                    onClick={() => setShowRequestIncrement(true)}
                                    size="sm"
                                    variant="outline"
                                    className="w-fit text-red-700 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/50"
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    {t('budgetApproval.requestIncrement')}
                                </Button>
                            )}
                        </div>
                    )}

                    {/* Pending Increment Info */}
                    {isIncrementPending && (project?.budget_increment_requested_cents ?? 0) > 0 && (
                        <div className="flex flex-col gap-2 p-3 rounded-lg bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400">
                            <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4" />
                                <span className="text-sm font-medium">{t('budgetApproval.incrementPendingMessage')}</span>
                            </div>
                            <div className="text-sm">
                                <span className="font-medium">{t('budgetApproval.requestedIncrement')}: </span>
                                {formatCurrency(project?.budget_increment_requested_cents ?? 0)}
                            </div>
                            {project?.budget_increment_notes && (
                                <div className="text-sm">
                                    <span className="font-medium">{t('budgetApproval.notes')}: </span>
                                    {project.budget_increment_notes}
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Unified Expenses Card */}
            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                            <CardTitle className="text-base sm:text-lg">{t('producer.expenses')}</CardTitle>
                            <CardDescription className="text-xs sm:text-sm">{t('producer.expensesDescription')}</CardDescription>
                        </div>
                        <Button
                            onClick={() => setShowQuickAdd(true)}
                            disabled={!isBudgetApproved || (isBudgetApproved && maxExpenseAllowed <= 0)}
                            className="w-full sm:w-auto"
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            {t('quickAdd.button')}
                        </Button>
                    </div>
                    {!isBudgetApproved && (
                        <p className="text-sm text-amber-600 dark:text-amber-400 mt-2">
                            {t('producer.budgetNotApproved')}
                        </p>
                    )}
                    {isBudgetApproved && maxExpenseAllowed <= 0 && (
                        <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                            {t('producer.noBudgetRemaining')}
                        </p>
                    )}
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div className="rounded-lg border p-3 bg-muted/20">
                            <p className="text-xs text-muted-foreground">{t('producer.approved')}</p>
                            <p className="text-lg font-semibold text-red-600 dark:text-red-400">
                                {formatCurrency(totalApprovedExpenses)}
                            </p>
                        </div>
                        <div className="rounded-lg border p-3 bg-muted/20">
                            <p className="text-xs text-muted-foreground">{tApprovals('waitingApproval')}</p>
                            <p className="text-lg font-semibold text-yellow-600 dark:text-yellow-400">
                                {formatCurrency(totalPendingExpenses)}
                            </p>
                        </div>
                        <div className="rounded-lg border p-3 bg-muted/20">
                            <p className="text-xs text-muted-foreground">
                                {t('producer.expenseScope.crew')} / {t('producer.expenseScope.general')}
                            </p>
                            <div className="space-y-1 text-sm">
                                <div className="flex items-center justify-between">
                                    <span>{t('producer.expenseScope.crew')}</span>
                                    <span className="font-semibold">{formatCurrency(totalTeamApproved)}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span>{t('producer.expenseScope.general')}</span>
                                    <span className="font-semibold">{formatCurrency(totalOtherApproved)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <Button
                            type="button"
                            size="sm"
                            variant={expenseScope === 'all' ? 'default' : 'outline'}
                            onClick={() => setExpenseScope('all')}
                        >
                            {t('producer.expenseScope.all')} ({transactions?.length || 0})
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant={expenseScope === 'crew' ? 'default' : 'outline'}
                            onClick={() => setExpenseScope('crew')}
                        >
                            {t('producer.expenseScope.crew')} ({teamExpenses.length})
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant={expenseScope === 'general' ? 'default' : 'outline'}
                            onClick={() => setExpenseScope('general')}
                        >
                            {t('producer.expenseScope.general')} ({otherExpenses.length})
                        </Button>
                    </div>

                    {visibleExpenses.length > 0 ? (
                        <div className="space-y-0">
                            {visibleExpenses.map((transaction) => (
                                <div key={transaction.id} className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-full ${transaction.stakeholder_id
                                            ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                                            : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                                            }`}>
                                            <ArrowDownRight className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-sm">
                                                {transaction.description || getCategoryDisplayName(transaction.category)}
                                            </p>
                                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                                <span>
                                                    {new Date(transaction.transaction_date).toLocaleDateString(locale, { month: 'short', day: 'numeric' })}
                                                </span>
                                                <span>•</span>
                                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                                    {getCategoryDisplayName(transaction.category)}
                                                </Badge>
                                                <Badge
                                                    variant="outline"
                                                    className={`text-[10px] px-1.5 py-0 ${transaction.stakeholder_id
                                                        ? 'border-blue-500 text-blue-600'
                                                        : ''
                                                        }`}
                                                >
                                                    {transaction.stakeholder_id
                                                        ? t('producer.expenseScope.crew')
                                                        : t('producer.expenseScope.general')}
                                                </Badge>
                                                <Badge
                                                    variant="outline"
                                                    className={`text-[10px] px-1.5 py-0 ${transaction.payment_status === 'pending'
                                                        ? 'border-yellow-500 text-yellow-600'
                                                        : transaction.payment_status === 'approved'
                                                            ? 'border-green-500 text-green-600'
                                                            : transaction.payment_status === 'paid'
                                                                ? 'border-blue-500 text-blue-600'
                                                                : transaction.payment_status === 'rejected'
                                                                    ? 'border-red-500 text-red-600'
                                                                    : ''
                                                        }`}
                                                >
                                                    {transaction.payment_status === 'pending' ? tApprovals('waitingApproval') :
                                                        transaction.payment_status === 'approved' ? tApprovals('approved') :
                                                            transaction.payment_status === 'paid' ? tApprovals('paid') :
                                                                transaction.payment_status === 'rejected' ? tApprovals('rejected') :
                                                                    transaction.payment_status}
                                                </Badge>
                                            </div>
                                        </div>
                                    </div>
                                    <span className={`font-semibold ${transaction.payment_status === 'pending'
                                        ? 'text-yellow-600 dark:text-yellow-400'
                                        : 'text-red-600 dark:text-red-400'
                                        }`}>
                                        -{formatCurrency(transaction.amount_cents, transaction.bank_account?.currency)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8">
                            <ArrowDownRight className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                            <p className="text-muted-foreground">{t('producer.noExpenses')}</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Quick Add Expense Dialog */}
            <Dialog open={showQuickAdd} onOpenChange={setShowQuickAdd}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{t('quickAdd.title')}</DialogTitle>
                        <DialogDescription>{t('quickAdd.description')}</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {/* Show max allowed */}
                        {isBudgetApproved && (
                            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20">
                                <p className="text-sm text-blue-700 dark:text-blue-400">
                                    {t('producer.maxExpenseAllowed')}: <strong>{formatCurrency(maxExpenseAllowed)}</strong>
                                </p>
                            </div>
                        )}

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
                            <Label htmlFor="budget-amount">{t('budgetApproval.amount')}</Label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                    R$
                                </span>
                                <Input
                                    id="budget-amount"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="0.00"
                                    className="pl-10"
                                    value={budgetForm.amount}
                                    onChange={(e) => setBudgetForm({ ...budgetForm, amount: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="budget-notes">{t('budgetApproval.notes')}</Label>
                            <Input
                                id="budget-notes"
                                placeholder={t('budgetApproval.notesPlaceholder')}
                                value={budgetForm.notes}
                                onChange={(e) => setBudgetForm({ ...budgetForm, notes: e.target.value })}
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

            {/* Request Budget Increment Dialog */}
            <Dialog open={showRequestIncrement} onOpenChange={setShowRequestIncrement}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t('budgetApproval.incrementTitle')}</DialogTitle>
                        <DialogDescription>{t('budgetApproval.incrementDescription')}</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {/* Current Budget Info */}
                        <div className="p-3 rounded-lg bg-muted">
                            <p className="text-sm text-muted-foreground">{t('budgetApproval.currentBudget')}</p>
                            <p className="text-lg font-bold">{formatCurrency(project?.budget_total_cents ?? 0)}</p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="increment-amount">{t('budgetApproval.incrementAmount')}</Label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                    R$
                                </span>
                                <Input
                                    id="increment-amount"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="0.00"
                                    className="pl-10"
                                    value={incrementForm.amount}
                                    onChange={(e) => setIncrementForm({ ...incrementForm, amount: e.target.value })}
                                />
                            </div>
                            {incrementForm.amount && parseFloat(incrementForm.amount) > 0 && (
                                <p className="text-sm text-muted-foreground">
                                    {t('budgetApproval.newTotal')}: {formatCurrency((project?.budget_total_cents ?? 0) + toCents(parseFloat(incrementForm.amount)))}
                                </p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="increment-notes">{t('budgetApproval.notes')}</Label>
                            <Input
                                id="increment-notes"
                                placeholder={t('budgetApproval.incrementNotesPlaceholder')}
                                value={incrementForm.notes}
                                onChange={(e) => setIncrementForm({ ...incrementForm, notes: e.target.value })}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowRequestIncrement(false)}>
                            {tCommon('cancel')}
                        </Button>
                        <Button
                            onClick={handleRequestIncrement}
                            disabled={requestIncrement.isPending || !incrementForm.amount}
                        >
                            {requestIncrement.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {t('budgetApproval.requestIncrement')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
