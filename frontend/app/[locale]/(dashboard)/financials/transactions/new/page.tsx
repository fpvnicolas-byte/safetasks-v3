'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useCreateTransaction, useBankAccounts, useProjects } from '@/lib/api/hooks'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { TransactionType, TransactionCategory, dollarsToCents, getIncomCategories, getExpenseCategories, getCategoryDisplayName } from '@/types'

export default function NewTransactionPage() {
  const router = useRouter()
  const { organizationId } = useAuth()
  const [formData, setFormData] = useState({
    bank_account_id: '',
    type: 'expense' as TransactionType,
    category: 'crew_hire' as TransactionCategory,
    amount: '', // Will be converted to cents
    description: '',
    transaction_date: new Date().toISOString().split('T')[0], // Today's date in YYYY-MM-DD
    project_id: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Get data for dropdowns
  const { data: bankAccounts, isLoading: loadingAccounts } = useBankAccounts(organizationId || '')
  const { data: projects, isLoading: loadingProjects } = useProjects(organizationId || '')
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
      newErrors.bank_account_id = 'Bank account is required'
    }

    if (!formData.category) {
      newErrors.category = 'Category is required'
    }

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      newErrors.amount = 'Amount must be greater than 0'
    }

    if (!formData.transaction_date) {
      newErrors.transaction_date = 'Transaction date is required'
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
      setErrors({ submit: 'Organization not found. Please log in again.' })
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
      }

      await createTransaction.mutateAsync({
        organizationId,
        transaction: transactionData
      })
      router.push('/financials/transactions')
    } catch (err: unknown) {
      const error = err as Error
      setErrors({ submit: error.message || 'Failed to create transaction' })
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
          <h1 className="text-3xl font-bold tracking-tight">New Transaction</h1>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!bankAccounts || bankAccounts.length === 0) {
    return (
      <div className="space-y-8">
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>No Bank Accounts</CardTitle>
            <CardDescription>
              You need to create at least one bank account before recording transactions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/financials/bank-accounts/new">
                Create Bank Account
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
            Back to Transactions
          </Link>
        </Button>
      </div>

      <Card className="max-w-2xl">
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>Record New Transaction</CardTitle>
            <CardDescription>
              Record income or expenses to track your cash flow and update bank balances
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
                <strong>Note:</strong> Recording this transaction will automatically update the selected bank account&apos;s balance.
              </AlertDescription>
            </Alert>

            {/* Transaction Type - Required */}
            <div className="space-y-2">
              <Label htmlFor="type">
                Transaction Type *
              </Label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => handleInputChange('type', 'income')}
                  className={`p-4 border-2 rounded-lg text-left transition-all ${
                    formData.type === 'income'
                      ? 'border-green-500 bg-green-50'
                      : 'border-border hover:border-green-300'
                  }`}
                >
                  <div className="font-semibold text-green-600">Income</div>
                  <div className="text-sm text-muted-foreground">Money received</div>
                </button>
                <button
                  type="button"
                  onClick={() => handleInputChange('type', 'expense')}
                  className={`p-4 border-2 rounded-lg text-left transition-all ${
                    formData.type === 'expense'
                      ? 'border-red-500 bg-red-50'
                      : 'border-border hover:border-red-300'
                  }`}
                >
                  <div className="font-semibold text-red-600">Expense</div>
                  <div className="text-sm text-muted-foreground">Money spent</div>
                </button>
              </div>
            </div>

            {/* Bank Account - Required */}
            <div className="space-y-2">
              <Label htmlFor="bank_account_id">
                Bank Account *
              </Label>
              <Select
                value={formData.bank_account_id}
                onValueChange={(value) => handleInputChange('bank_account_id', value)}
              >
                <SelectTrigger id="bank_account_id">
                  <SelectValue placeholder="Select a bank account" />
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
                The bank account that this transaction affects
              </p>
            </div>

            {/* Category - Required */}
            <div className="space-y-2">
              <Label htmlFor="category">
                Category *
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
                {formData.type === 'income' ? 'Type of revenue' : 'Type of expense'}
              </p>
            </div>

            {/* Amount - Required */}
            <div className="space-y-2">
              <Label htmlFor="amount">
                Amount *
              </Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                value={formData.amount}
                onChange={(e) => handleInputChange('amount', e.target.value)}
                placeholder="0.00"
                required
              />
              {errors.amount && (
                <p className="text-sm text-destructive">{errors.amount}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Enter the amount in the account&apos;s currency (e.g., 100.50)
              </p>
            </div>

            {/* Transaction Date - Required */}
            <div className="space-y-2">
              <Label htmlFor="transaction_date">
                Transaction Date *
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
                When did this transaction occur?
              </p>
            </div>

            {/* Description - Optional */}
            <div className="space-y-2">
              <Label htmlFor="description">
                Description
              </Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Brief description of this transaction..."
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Optional details about this transaction
              </p>
            </div>

            {/* Project - Optional */}
            <div className="space-y-2">
              <Label htmlFor="project_id">
                Project (Optional)
              </Label>
              <Select
                value={formData.project_id || 'none'}
                onValueChange={(value) => handleInputChange('project_id', value === 'none' ? '' : value)}
              >
                <SelectTrigger id="project_id">
                  <SelectValue placeholder="No project (general expense/income)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No project</SelectItem>
                  {projects?.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Link this transaction to a specific project (optional)
              </p>
            </div>
          </CardContent>

          <CardFooter className="flex gap-2">
            <Button type="submit" disabled={createTransaction.isPending}>
              {createTransaction.isPending ? 'Recording...' : 'Record Transaction'}
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link href="/financials/transactions">Cancel</Link>
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
