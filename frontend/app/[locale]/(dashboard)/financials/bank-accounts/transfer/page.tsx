'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ArrowLeftRight } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { useAuth } from '@/contexts/AuthContext'
import { useBankAccounts, useTransferBetweenBankAccounts } from '@/lib/api/hooks'
import { useErrorDialog } from '@/lib/hooks/useErrorDialog'
import { toCents, formatCurrency } from '@/types'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ErrorDialog } from '@/components/ui/error-dialog'

export default function BankAccountTransferPage() {
  const router = useRouter()
  const { organizationId } = useAuth()
  const t = useTranslations('financials.pages.bankAccountsTransfer')

  const { errorDialog, showError, closeError } = useErrorDialog()
  const { data: bankAccounts, isLoading } = useBankAccounts(organizationId || undefined)
  const transferMutation = useTransferBetweenBankAccounts()

  const [formData, setFormData] = useState({
    from_bank_account_id: '',
    to_bank_account_id: '',
    amount: '',
    transaction_date: new Date().toISOString().split('T')[0],
    description: '',
  })

  const fromAccount = useMemo(
    () => bankAccounts?.find((a) => a.id === formData.from_bank_account_id),
    [bankAccounts, formData.from_bank_account_id]
  )

  const toAccountOptions = useMemo(() => {
    if (!bankAccounts) return []
    if (!fromAccount) return bankAccounts.filter((a) => a.id !== formData.from_bank_account_id)
    return bankAccounts.filter(
      (a) => a.id !== formData.from_bank_account_id && a.currency === fromAccount.currency
    )
  }, [bankAccounts, fromAccount, formData.from_bank_account_id])

  useEffect(() => {
    if (!bankAccounts || bankAccounts.length === 0) return

    setFormData((prev) => {
      if (prev.from_bank_account_id && prev.to_bank_account_id) return prev

      const defaultFrom = prev.from_bank_account_id || bankAccounts[0].id
      const from = bankAccounts.find((a) => a.id === defaultFrom) ?? bankAccounts[0]

      const defaultToCandidate = bankAccounts.find((a) => a.id !== from.id && a.currency === from.currency)
      const defaultTo = prev.to_bank_account_id || defaultToCandidate?.id || ''

      return {
        ...prev,
        from_bank_account_id: defaultFrom,
        to_bank_account_id: defaultTo,
      }
    })
  }, [bankAccounts])

  useEffect(() => {
    if (!fromAccount) return

    // Ensure "to" stays valid after changing "from" (different + same currency).
    setFormData((prev) => {
      if (!prev.to_bank_account_id) {
        return { ...prev, to_bank_account_id: toAccountOptions[0]?.id || '' }
      }

      const to = bankAccounts?.find((a) => a.id === prev.to_bank_account_id)
      const isValid =
        !!to && to.id !== fromAccount.id && to.currency === fromAccount.currency

      if (isValid) return prev
      return { ...prev, to_bank_account_id: toAccountOptions[0]?.id || '' }
    })
  }, [fromAccount, toAccountOptions, bankAccounts])

  const validateForm = (): boolean => {
    if (!organizationId) {
      showError({ message: t('errors.organizationMissing') }, t('errors.authTitle'))
      return false
    }

    if (!bankAccounts || bankAccounts.length < 2) {
      showError(
        { message: t('errors.notEnoughAccountsDescription') },
        t('errors.notEnoughAccountsTitle')
      )
      return false
    }

    if (!formData.from_bank_account_id) {
      showError({ message: t('errors.fromRequired') }, t('errors.validationTitle'))
      return false
    }

    if (!formData.to_bank_account_id) {
      showError({ message: t('errors.toRequired') }, t('errors.validationTitle'))
      return false
    }

    if (formData.from_bank_account_id === formData.to_bank_account_id) {
      showError({ message: t('errors.differentAccounts') }, t('errors.validationTitle'))
      return false
    }

    const amountCents = toCents(parseFloat(formData.amount) || 0)
    if (amountCents <= 0) {
      showError({ message: t('errors.amountRequired') }, t('errors.validationTitle'))
      return false
    }

    const from = bankAccounts.find((a) => a.id === formData.from_bank_account_id)
    const to = bankAccounts.find((a) => a.id === formData.to_bank_account_id)
    if (!from || !to) {
      showError({ message: t('errors.accountNotFound') }, t('errors.validationTitle'))
      return false
    }

    if (from.currency !== to.currency) {
      showError({ message: t('errors.currencyMismatch') }, t('errors.validationTitle'))
      return false
    }

    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    try {
      await transferMutation.mutateAsync({
        from_bank_account_id: formData.from_bank_account_id,
        to_bank_account_id: formData.to_bank_account_id,
        amount_cents: toCents(parseFloat(formData.amount)),
        transaction_date: formData.transaction_date,
        description: formData.description.trim() || undefined,
      })

      router.push('/financials/bank-accounts')
    } catch (err: unknown) {
      const logPayload =
        err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : err
      const safeStringify = (value: unknown) => {
        try {
          return JSON.stringify(value, (_key, v) => (typeof v === 'bigint' ? v.toString() : v))
        } catch {
          return String(value)
        }
      }
      console.error('Transfer funds error:', safeStringify(logPayload))
      showError(err, t('errors.transferTitle'))
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-display">{t('title')}</h1>
          <p className="text-muted-foreground">{t('loading')}</p>
        </div>
      </div>
    )
  }

  const fromCurrency = fromAccount?.currency
  const fromBalance = fromAccount ? formatCurrency(fromAccount.balance_cents, fromAccount.currency) : ''

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
            <CardTitle className="flex items-center gap-2">
              <ArrowLeftRight className="h-5 w-5 text-primary" />
              {t('title')}
            </CardTitle>
            <CardDescription>{t('subtitle')}</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="from_account">{t('fields.from.label')}</Label>
                <Select
                  value={formData.from_bank_account_id}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, from_bank_account_id: value }))}
                >
                  <SelectTrigger id="from_account">
                    <SelectValue placeholder={t('fields.from.placeholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {bankAccounts?.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name} • {formatCurrency(account.balance_cents, account.currency)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fromCurrency && (
                  <p className="text-xs text-muted-foreground">
                    {t('fields.from.helper', { currency: fromCurrency, balance: fromBalance })}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="to_account">{t('fields.to.label')}</Label>
                <Select
                  value={formData.to_bank_account_id}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, to_bank_account_id: value }))}
                >
                  <SelectTrigger id="to_account">
                    <SelectValue placeholder={t('fields.to.placeholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {toAccountOptions.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name} • {formatCurrency(account.balance_cents, account.currency)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fromAccount && toAccountOptions.length === 0 && (
                  <p className="text-xs text-muted-foreground">{t('fields.to.noMatches')}</p>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="amount">{t('fields.amount.label')}</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder={t('fields.amount.placeholder')}
                  value={formData.amount}
                  onChange={(e) => setFormData((prev) => ({ ...prev, amount: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="transaction_date">{t('fields.date.label')}</Label>
                <Input
                  id="transaction_date"
                  type="date"
                  value={formData.transaction_date}
                  onChange={(e) => setFormData((prev) => ({ ...prev, transaction_date: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t('fields.description.label')}</Label>
              <Input
                id="description"
                placeholder={t('fields.description.placeholder')}
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>
          </CardContent>

          <CardFooter className="flex gap-2">
            <Button type="submit" disabled={transferMutation.isPending || !formData.to_bank_account_id}>
              {transferMutation.isPending ? t('actions.transferring') : t('actions.transfer')}
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link href="/financials/bank-accounts">{t('actions.cancel')}</Link>
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
