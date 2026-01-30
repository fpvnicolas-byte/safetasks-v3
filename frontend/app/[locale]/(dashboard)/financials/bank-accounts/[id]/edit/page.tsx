'use client'

import { use, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useBankAccount, useUpdateBankAccount } from '@/lib/api/hooks'
import { useAuth } from '@/contexts/AuthContext'
import { useErrorDialog } from '@/lib/hooks/useErrorDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ErrorDialog } from '@/components/ui/error-dialog'
import { ArrowLeft, Shield } from 'lucide-react'
import Link from 'next/link'
import { formatCurrency } from '@/types'

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

export default function EditBankAccountPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const { profile } = useAuth()
  const { data: account, isLoading: accountLoading } = useBankAccount(resolvedParams.id)
  const updateBankAccount = useUpdateBankAccount()

  const [formData, setFormData] = useState({
    name: '',
    currency: 'BRL',
  })
  const { errorDialog, showError, closeError } = useErrorDialog()

  // Check if user is admin
  const isAdmin = profile?.role === 'admin'

  // Populate form when account data loads
  useEffect(() => {
    if (account) {
      setFormData({
        name: account.name,
        currency: account.currency,
      })
    }
  }, [account])

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

    try {
      const accountData = {
        name: formData.name.trim(),
        currency: formData.currency,
      }

      await updateBankAccount.mutateAsync({
        organizationId: profile?.organization_id || '',
        accountId: resolvedParams.id,
        data: accountData,
      })
      router.push('/financials/bank-accounts')
    } catch (err: any) {
      console.error('Update bank account error:', err)
      showError(err, 'Error Updating Bank Account')
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  if (accountLoading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Loading...</h1>
        </div>
      </div>
    )
  }

  if (!account) {
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
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive">Bank account not found.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Non-admin users can't edit
  if (!isAdmin) {
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
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-warning-foreground" />
              Administrator Access Required
            </CardTitle>
            <CardDescription>
              Only administrators can edit bank accounts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Bank account settings can only be modified by users with administrator privileges.
              This is to protect sensitive financial information.
            </p>
            <Button asChild>
              <Link href="/financials/bank-accounts">
                Back to Bank Accounts
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
          <Link href="/financials/bank-accounts">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Bank Accounts
          </Link>
        </Button>
      </div>

      <Card className="max-w-2xl">
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>Edit Bank Account</CardTitle>
            <CardDescription>
              Update bank account information for {account.name}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">

            {/* Current Balance Display */}
            <div className="rounded-lg border p-4 bg-muted/50">
              <h4 className="text-sm font-medium mb-1">Current Balance</h4>
              <p className={`text-2xl font-bold ${account.balance_cents >= 0 ? 'text-success' : 'text-destructive'}`}>
                {formatCurrency(account.balance_cents, account.currency)}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Balance is updated automatically by transactions and cannot be edited directly.
              </p>
            </div>

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
                A descriptive name for this bank account
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
                The currency for this account
              </p>
            </div>

            {/* Admin Note */}
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                <strong>Administrator Note:</strong> Changes to bank account settings affect all users in your organization.
                The balance cannot be edited directly - it updates automatically through transactions.
              </AlertDescription>
            </Alert>
          </CardContent>

          <CardFooter className="flex gap-2">
            <Button type="submit" disabled={updateBankAccount.isPending}>
              {updateBankAccount.isPending ? 'Saving...' : 'Save Changes'}
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
