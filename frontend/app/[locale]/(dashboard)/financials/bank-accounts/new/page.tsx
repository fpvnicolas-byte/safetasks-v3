'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCreateBankAccount } from '@/lib/api/hooks'
import { useAuth } from '@/contexts/AuthContext'
import { useErrorDialog } from '@/lib/hooks/useErrorDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorDialog } from '@/components/ui/error-dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

// Common currencies
const CURRENCIES = [
  { code: 'BRL', name: 'Brazilian Real (R$)' },
  { code: 'USD', name: 'US Dollar ($)' },
  { code: 'EUR', name: 'Euro (€)' },
  { code: 'GBP', name: 'British Pound (£)' },
  { code: 'JPY', name: 'Japanese Yen (¥)' },
  { code: 'CAD', name: 'Canadian Dollar (C$)' },
  { code: 'AUD', name: 'Australian Dollar (A$)' },
  { code: 'MXN', name: 'Mexican Peso (MX$)' },
]

export default function NewBankAccountPage() {
  const router = useRouter()
  const { organizationId } = useAuth()
  const [formData, setFormData] = useState({
    name: '',
    currency: 'BRL', // Default to BRL as per backend
  })
  const { errorDialog, showError, closeError } = useErrorDialog()

  const createBankAccount = useCreateBankAccount()

  const validateForm = (): boolean => {
    if (!formData.name.trim()) {
      showError({ message: 'Account name is required' }, 'Validation Error')
      return false
    }

    if (!formData.currency) {
      showError({ message: 'Currency is required' }, 'Validation Error')
      return false
    }

    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    if (!organizationId) {
      showError({ message: 'Organization not found. Please log in again.' }, 'Authentication Error')
      return
    }

    try {
      const accountData = {
        name: formData.name.trim(),
        currency: formData.currency,
      }

      await createBankAccount.mutateAsync({
        organizationId,
        account: accountData
      })
      router.push('/financials/bank-accounts')
    } catch (err: any) {
      console.error('Create bank account error:', err)
      showError(err, 'Error Creating Bank Account')
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/financials/bank-accounts">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Bank Accounts
          </Link>
        </Button>
      </div>

      <Card className="max-w-2xl">
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>Create New Bank Account</CardTitle>
            <CardDescription>
              Add a new bank account to track your organization&apos;s finances
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">

            <Alert>
              <AlertDescription>
                <strong>Note:</strong> The initial balance will be 0. You can update the balance by creating transactions.
              </AlertDescription>
            </Alert>

            {/* Name - Required */}
            <div className="space-y-2">
              <Label htmlFor="name">
                Account Name *
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Business Checking Account"
                required
              />
              <p className="text-xs text-muted-foreground">
                A descriptive name for this bank account (e.g., &quot;Main Checking&quot;, &quot;Savings&quot;, &quot;PayPal&quot;)
              </p>
            </div>

            {/* Currency - Required */}
            <div className="space-y-2">
              <Label htmlFor="currency">
                Currency *
              </Label>
              <Select
                value={formData.currency}
                onValueChange={(value) => handleInputChange('currency', value)}
              >
                <SelectTrigger id="currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((curr) => (
                    <SelectItem key={curr.code} value={curr.code}>
                      {curr.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Select the currency for this account. Cannot be changed after creation.
              </p>
            </div>

            {/* Info about balance */}
            <div className="rounded-lg border p-4 bg-muted/50">
              <h4 className="text-sm font-medium mb-2">Account Balance</h4>
              <p className="text-sm text-muted-foreground">
                The account will start with a balance of 0.00. To set an opening balance or record transactions:
              </p>
              <ul className="text-sm text-muted-foreground mt-2 ml-4 list-disc">
                <li>Create income transactions to add funds</li>
                <li>Create expense transactions to deduct funds</li>
                <li>The balance updates automatically with each transaction</li>
              </ul>
            </div>
          </CardContent>

          <CardFooter className="flex gap-2">
            <Button type="submit" disabled={createBankAccount.isPending}>
              {createBankAccount.isPending ? 'Creating...' : 'Create Bank Account'}
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link href="/financials/bank-accounts">Cancel</Link>
            </Button>
          </CardFooter>
        </form>
      </Card>

      <ErrorDialog
        open={errorDialog.open}
        onOpenChange={closeError}
        title={errorDialog.title}
        message={errorDialog.message}
        validationErrors={errorDialog.validationErrors}
        statusCode={errorDialog.statusCode}
      />
    </div>
  )
}
