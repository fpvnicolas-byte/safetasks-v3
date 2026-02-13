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
import { useTranslations } from 'next-intl'

// Common currencies
const CURRENCIES = ['BRL', 'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'MXN']

export default function NewBankAccountPage() {
  const router = useRouter()
  const { organizationId } = useAuth()
  const t = useTranslations('financials.pages.bankAccountsNew')
  const tCommon = useTranslations('common')
  const [formData, setFormData] = useState({
    name: '',
    currency: 'BRL', // Default to BRL as per backend
  })
  const { errorDialog, showError, closeError } = useErrorDialog()

  const createBankAccount = useCreateBankAccount()

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

    if (!organizationId) {
      showError({ message: t('errors.organizationMissing') }, t('errors.authTitle'))
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
    } catch (err: unknown) {
      console.error('Create bank account error:', err)
      showError(err, t('errors.createTitle'))
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
            {t('actions.back')}
          </Link>
        </Button>
      </div>

      <Card className="max-w-2xl">
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>{t('title')}</CardTitle>
            <CardDescription>
              {t('subtitle')}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">

            <Alert>
              <AlertDescription>
                <strong>{t('note.title')}</strong> {t('note.description')}
              </AlertDescription>
            </Alert>

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

            {/* Info about balance */}
            <div className="rounded-lg border p-4 bg-muted/50">
              <h4 className="text-sm font-medium mb-2">{t('balance.title')}</h4>
              <p className="text-sm text-muted-foreground">
                {t('balance.description')}
              </p>
              <ul className="text-sm text-muted-foreground mt-2 ml-4 list-disc">
                <li>{t('balance.items.income')}</li>
                <li>{t('balance.items.expense')}</li>
                <li>{t('balance.items.auto')}</li>
              </ul>
            </div>
          </CardContent>

          <CardFooter className="flex gap-2">
            <Button type="submit" disabled={createBankAccount.isPending}>
              {createBankAccount.isPending ? t('actions.creating') : t('actions.create')}
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
