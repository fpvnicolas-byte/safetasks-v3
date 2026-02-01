'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCreateTransaction, useBankAccounts, useProjects, useStakeholders, useStakeholderRateCalculation } from '@/lib/api/hooks'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ArrowLeft, Calculator, Check, AlertCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { TransactionType, TransactionCategory, dollarsToCents, getIncomCategories, getExpenseCategories, getCategoryDisplayName } from '@/types'
import { useTranslations } from 'next-intl'

export default function NewTransactionPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { organizationId } = useAuth()
  const t = useTranslations('financials.pages.transactionsNew')
  const tCommon = useTranslations('common')
  const [formData, setFormData] = useState({
    bank_account_id: '',
    type: 'expense' as TransactionType,
    category: 'crew_hire' as TransactionCategory,
    amount: '', // Will be converted to cents
    description: '',
    transaction_date: new Date().toISOString().split('T')[0], // Today's date in YYYY-MM-DD
    project_id: searchParams.get('project_id') || '',
    stakeholder_id: searchParams.get('stakeholder_id') || '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Get data for dropdowns
  const { data: bankAccounts, isLoading: loadingAccounts } = useBankAccounts(organizationId || '')
  const { data: projects, isLoading: loadingProjects } = useProjects(organizationId || '')
  const { data: stakeholders } = useStakeholders(formData.project_id || undefined)
  const { data: stakeholderRateInfo } = useStakeholderRateCalculation(formData.stakeholder_id || undefined)
  const createTransaction = useCreateTransaction()

  // Set first bank account as default when loaded
  useEffect(() => {
    if (bankAccounts && bankAccounts.length > 0 && !formData.bank_account_id) {
      setFormData(prev => ({ ...prev, bank_account_id: bankAccounts[0].id }))
    }
  }, [bankAccounts, formData.bank_account_id])

  // Get categories based on transaction type
  const availableCategories = formData.type === 'income'
    ? getIncomCategories()
    : getExpenseCategories()

  // Update category when type changes
  useEffect(() => {
    if (!availableCategories.includes(formData.category)) {
      setFormData(prev => ({ ...prev, category: availableCategories[0] }))
    }
  }, [formData.type, formData.category, availableCategories])

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.bank_account_id) {
      newErrors.bank_account_id = t('errors.bankAccountRequired')
    }

    if (!formData.category) {
      newErrors.category = t('errors.categoryRequired')
    }

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      newErrors.amount = t('errors.amountRequired')
    }

    if (!formData.transaction_date) {
      newErrors.transaction_date = t('errors.dateRequired')
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    if (!organizationId) {
      setErrors({ submit: t('errors.organizationMissing') })
      return
    }

    try {
      const transactionData = {
        bank_account_id: formData.bank_account_id,
        type: formData.type,
        category: formData.category,
        amount_cents: dollarsToCents(parseFloat(formData.amount)),
        description: formData.description.trim() || undefined,
        transaction_date: formData.transaction_date,
        project_id: formData.project_id || undefined,
        stakeholder_id: formData.stakeholder_id || undefined,
      }

      await createTransaction.mutateAsync({
        organizationId,
        transaction: transactionData
      })
      router.push('/financials/transactions')
    } catch (err: unknown) {
      const error = err as Error
      setErrors({ submit: error.message || t('errors.createFailed') })
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  if (loadingAccounts || loadingProjects) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-display">{t('title')}</h1>
          <p className="text-muted-foreground">{tCommon('loading')}</p>
        </div>
      </div>
    )
  }

  if (!bankAccounts || bankAccounts.length === 0) {
    return (
      <div className="space-y-8">
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>{t('noBankAccounts.title')}</CardTitle>
            <CardDescription>
              {t('noBankAccounts.description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/financials/bank-accounts/new">
                {t('noBankAccounts.action')}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/financials/transactions">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('actions.back')}
          </Link>
        </Button>
      </div>

      <Card className="max-w-2xl">
        <form onSubmit={handleSubmit}>
          <CardHeader>
          <CardTitle className="font-display">{t('form.title')}</CardTitle>
            <CardDescription>
              {t('form.description')}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {errors.submit && (
              <Alert variant="destructive">
                <AlertDescription>{errors.submit}</AlertDescription>
              </Alert>
            )}

            <Alert>
              <AlertDescription>
                <strong>{t('note.title')}</strong> {t('note.description')}
              </AlertDescription>
            </Alert>

            {/* Transaction Type - Required */}
            <div className="space-y-2">
              <Label htmlFor="type">
                {t('fields.type.label')}
              </Label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => handleInputChange('type', 'income')}
                  className={`p-4 border-2 rounded-lg text-left transition-all ${formData.type === 'income'
                    ? 'border-success bg-success/10 text-success'
                    : 'border-border hover:border-success/50'
                    }`}
                >
                  <div className="font-semibold">{t('fields.type.income')}</div>
                  <div className="text-sm text-muted-foreground">{t('fields.type.incomeHint')}</div>
                </button>
                <button
                  type="button"
                  onClick={() => handleInputChange('type', 'expense')}
                  className={`p-4 border-2 rounded-lg text-left transition-all ${formData.type === 'expense'
                    ? 'border-destructive bg-destructive/10 text-destructive'
                    : 'border-border hover:border-destructive/50'
                    }`}
                >
                  <div className="font-semibold">{t('fields.type.expense')}</div>
                  <div className="text-sm text-muted-foreground">{t('fields.type.expenseHint')}</div>
                </button>
              </div>
            </div>

            {/* Bank Account - Required */}
            <div className="space-y-2">
              <Label htmlFor="bank_account_id">
                {t('fields.bankAccount.label')}
              </Label>
              <Select
                value={formData.bank_account_id}
                onValueChange={(value) => handleInputChange('bank_account_id', value)}
              >
                <SelectTrigger id="bank_account_id">
                  <SelectValue placeholder={t('fields.bankAccount.placeholder')} />
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name} ({account.currency})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.bank_account_id && (
                <p className="text-sm text-destructive">{errors.bank_account_id}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {t('fields.bankAccount.help')}
              </p>
            </div>

            {/* Category - Required */}
            <div className="space-y-2">
              <Label htmlFor="category">
                {t('fields.category.label')}
              </Label>
              <Select
                value={formData.category}
                onValueChange={(value) => handleInputChange('category', value as TransactionCategory)}
              >
                <SelectTrigger id="category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableCategories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {getCategoryDisplayName(cat)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.category && (
                <p className="text-sm text-destructive">{errors.category}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {formData.type === 'income'
                  ? t('fields.category.helpIncome')
                  : t('fields.category.helpExpense')}
              </p>
            </div>

            {/* Amount - Required */}
            <div className="space-y-2">
              <Label htmlFor="amount">
                {t('fields.amount.label')}
              </Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                value={formData.amount}
                onChange={(e) => handleInputChange('amount', e.target.value)}
                placeholder={t('fields.amount.placeholder')}
                required
              />
              {errors.amount && (
                <p className="text-sm text-destructive">{errors.amount}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {t('fields.amount.help')}
              </p>
            </div>

            {/* Transaction Date - Required */}
            <div className="space-y-2">
              <Label htmlFor="transaction_date">
                {t('fields.date.label')}
              </Label>
              <Input
                id="transaction_date"
                type="date"
                value={formData.transaction_date}
                onChange={(e) => handleInputChange('transaction_date', e.target.value)}
                required
              />
              {errors.transaction_date && (
                <p className="text-sm text-destructive">{errors.transaction_date}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {t('fields.date.help')}
              </p>
            </div>

            {/* Description - Optional */}
            <div className="space-y-2">
              <Label htmlFor="description">
                {t('fields.description.label')}
              </Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder={t('fields.description.placeholder')}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                {t('fields.description.help')}
              </p>
            </div>

            {/* Project - Optional */}
            <div className="space-y-2">
              <Label htmlFor="project_id">
                {t('fields.project.label')}
              </Label>
              <Select
                value={formData.project_id || 'none'}
                onValueChange={(value) => handleInputChange('project_id', value === 'none' ? '' : value)}
              >
                <SelectTrigger id="project_id">
                  <SelectValue placeholder={t('fields.project.placeholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('fields.project.none')}</SelectItem>
                  {projects?.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {t('fields.project.help')}
              </p>
            </div>


            {/* Stakeholder - Optional (dependent on project) */}
            {formData.project_id && (
              <div className="space-y-2">
                <Label htmlFor="stakeholder_id">
                  {t('fields.stakeholder.label')}
                </Label>
                <Select
                  value={formData.stakeholder_id || 'none'}
                  onValueChange={(value) => handleInputChange('stakeholder_id', value === 'none' ? '' : value)}
                >
                  <SelectTrigger id="stakeholder_id">
                    <SelectValue placeholder={t('fields.stakeholder.placeholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('fields.stakeholder.none')}</SelectItem>
                    {stakeholders?.map((stakeholder) => (
                      <SelectItem key={stakeholder.id} value={stakeholder.id}>
                        {stakeholder.name} ({stakeholder.role})
                        {stakeholder.rate_value_cents ? ` - R$ ${(stakeholder.rate_value_cents / 100).toFixed(2)}/${stakeholder.rate_type === 'daily' ? 'day' : stakeholder.rate_type === 'hourly' ? 'hour' : 'fixed'}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {t('fields.stakeholder.help')}
                </p>

                {/* Rate Calculation Suggestion */}
                {stakeholderRateInfo && stakeholderRateInfo.suggested_amount_cents && (
                  <Alert className="mt-3 border-primary/50 bg-primary/5">
                    <Calculator className="h-4 w-4" />
                    <AlertDescription>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-semibold">Suggested Amount: </span>
                            <span className="text-lg font-bold text-primary">
                              R$ {(stakeholderRateInfo.suggested_amount_cents / 100).toFixed(2)}
                            </span>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleInputChange(
                              'amount',
                              (stakeholderRateInfo.suggested_amount_cents! / 100).toString()
                            )}
                          >
                            Use Amount
                          </Button>
                        </div>

                        {/* Calculation breakdown */}
                        {stakeholderRateInfo.calculation_breakdown && (
                          <p className="text-sm text-muted-foreground">
                            {stakeholderRateInfo.calculation_breakdown.type === 'daily' && (
                              <>{stakeholderRateInfo.calculation_breakdown.days} days x R$ {(stakeholderRateInfo.calculation_breakdown.rate_per_day_cents! / 100).toFixed(2)}/day</>
                            )}
                            {stakeholderRateInfo.calculation_breakdown.type === 'hourly' && (
                              <>{stakeholderRateInfo.calculation_breakdown.hours} hours x R$ {(stakeholderRateInfo.calculation_breakdown.rate_per_hour_cents! / 100).toFixed(2)}/hour</>
                            )}
                            {stakeholderRateInfo.calculation_breakdown.type === 'fixed' && (
                              <>Fixed amount</>
                            )}
                          </p>
                        )}

                        {/* Payment status */}
                        <div className="flex items-center gap-2 pt-1 border-t border-border/50">
                          <span className="text-sm">Payment Status:</span>
                          <Badge
                            variant={
                              stakeholderRateInfo.payment_status === 'paid' ? 'default' :
                              stakeholderRateInfo.payment_status === 'partial' ? 'secondary' :
                              stakeholderRateInfo.payment_status === 'overpaid' ? 'destructive' :
                              'outline'
                            }
                          >
                            {stakeholderRateInfo.payment_status === 'paid' && <Check className="h-3 w-3 mr-1" />}
                            {stakeholderRateInfo.payment_status === 'overpaid' && <AlertCircle className="h-3 w-3 mr-1" />}
                            {stakeholderRateInfo.payment_status.charAt(0).toUpperCase() + stakeholderRateInfo.payment_status.slice(1).replace('_', ' ')}
                          </Badge>
                          {stakeholderRateInfo.total_paid_cents > 0 && (
                            <span className="text-sm text-muted-foreground">
                              (Paid: R$ {(stakeholderRateInfo.total_paid_cents / 100).toFixed(2)})
                            </span>
                          )}
                          {stakeholderRateInfo.pending_amount_cents !== null && stakeholderRateInfo.pending_amount_cents > 0 && (
                            <span className="text-sm text-muted-foreground">
                              | Pending: R$ {(stakeholderRateInfo.pending_amount_cents / 100).toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </CardContent>

          <CardFooter className="flex gap-2">
            <Button type="submit" disabled={createTransaction.isPending}>
              {createTransaction.isPending ? t('actions.recording') : t('actions.record')}
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link href="/financials/transactions">{tCommon('cancel')}</Link>
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div >
  )
}
