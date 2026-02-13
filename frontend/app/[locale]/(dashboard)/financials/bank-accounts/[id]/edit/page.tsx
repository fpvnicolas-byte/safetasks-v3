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
import { useTranslations } from 'next-intl'

// Common currencies
const CURRENCIES = ['BRL', 'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'MXN']

export default function EditBankAccountPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const { profile } = useAuth()
  const t = useTranslations('financials.pages.bankAccountsEdit')
  const tCommon = useTranslations('common')
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
      showError({ message: t('errors.nameRequired') }, t('errors.validationTitle'))
      return false
    }

    if (!formData.currency) {
      showError({ message: t('errors.currencyRequired') }, t('errors.validationTitle'))
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
    } catch (err: unknown) {
      console.error('Update bank account error:', err)
      showError(err, t('errors.updateTitle'))
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  if (accountLoading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('loading')}</h1>
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
              {t('actions.back')}
            </Link>
          </Button>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive">{t('errors.notFound')}</p>
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
              {t('actions.back')}
            </Link>
          </Button>
        </div>
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-warning-foreground" />
              {t('admin.title')}
            </CardTitle>
            <CardDescription>
              {t('admin.description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              {t('admin.details')}
            </p>
            <Button asChild>
              <Link href="/financials/bank-accounts">
                {t('actions.back')}
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
            {t('actions.back')}
          </Link>
        </Button>
      </div>

      <Card className="max-w-2xl">
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>{t('title')}</CardTitle>
            <CardDescription>
              {t('subtitle', { name: account.name })}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">

            {/* Current Balance Display */}
            <div className="rounded-lg border p-4 bg-muted/50">
              <h4 className="text-sm font-medium mb-1">{t('balance.title')}</h4>
              <p className={`text-2xl font-bold ${account.balance_cents >= 0 ? 'text-success' : 'text-destructive'}`}>
                {formatCurrency(account.balance_cents, account.currency)}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                {t('balance.description')}
              </p>
            </div>

            {/* Name - Required */}
            <div className="space-y-2">
              <Label htmlFor="name">
                {t('fields.name.label')}
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder={t('fields.name.placeholder')}
                required
              />
              <p className="text-xs text-muted-foreground">
                {t('fields.name.help')}
              </p>
            </div>

            {/* Currency - Required */}
            <div className="space-y-2">
              <Label htmlFor="currency">
                {t('fields.currency.label')}
              </Label>
              <Select
                value={formData.currency}
                onValueChange={(value) => handleInputChange('currency', value)}
              >
                <SelectTrigger id="currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((code) => (
                    <SelectItem key={code} value={code}>
                      {t(`currencies.${code}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {t('fields.currency.help')}
              </p>
            </div>

            {/* Admin Note */}
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                <strong>{t('adminNote.title')}</strong> {t('adminNote.description')}
              </AlertDescription>
            </Alert>
          </CardContent>

          <CardFooter className="flex gap-2">
            <Button type="submit" disabled={updateBankAccount.isPending}>
              {updateBankAccount.isPending ? t('actions.saving') : t('actions.save')}
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link href="/financials/bank-accounts">{tCommon('cancel')}</Link>
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
