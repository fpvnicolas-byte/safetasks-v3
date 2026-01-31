'use client'

import { useState } from 'react'
import { useBankAccounts, useDeleteBankAccount } from '@/lib/api/hooks'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, Edit, Trash2, Wallet, TrendingUp, DollarSign } from 'lucide-react'
import Link from 'next/link'
import { formatCurrency } from '@/types'
import { useLocale, useTranslations } from 'next-intl'

export default function BankAccountsPage() {
  const { organizationId } = useAuth()
  const locale = useLocale()
  const t = useTranslations('financials.pages.bankAccounts')
  const tCommon = useTranslations('common')
  const [searchQuery, setSearchQuery] = useState('')

  // Get bank accounts data
  const { data: allAccounts, isLoading, error } = useBankAccounts(organizationId || '')
  const deleteBankAccount = useDeleteBankAccount()

  // Apply search filter
  const filteredAccounts = allAccounts?.filter(account => {
    if (!searchQuery) return true

    const searchLower = searchQuery.toLowerCase()
    return (
      account.name.toLowerCase().includes(searchLower) ||
      account.currency.toLowerCase().includes(searchLower)
    )
  }) || []

  // Calculate total balance by currency
  const balanceByCurrency = filteredAccounts.reduce((acc, account) => {
    if (!acc[account.currency]) {
      acc[account.currency] = 0
    }
    acc[account.currency] += account.balance_cents
    return acc
  }, {} as Record<string, number>)

  const handleDeleteAccount = async (accountId: string, accountName: string) => {
    if (!confirm(t('deleteConfirm', { name: accountName }))) {
      return
    }

    try {
      await deleteBankAccount.mutateAsync({
        organizationId: organizationId || '',
        accountId: accountId
      })
    } catch (err: unknown) {
      const error = err as Error
      alert(t('deleteError', { message: error.message }))
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

  if (error) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-display">{t('title')}</h1>
          <p className="text-destructive">{t('error')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-display">{t('title')}</h1>
          <p className="text-muted-foreground">
            {t('subtitle')}
          </p>
        </div>
        <Button asChild>
          <Link href="/financials/bank-accounts/new">
            <Plus className="mr-2 h-4 w-4" />
            {t('actions.new')}
          </Link>
        </Button>
      </div>

      {/* Total Balance Summary */}
      {Object.keys(balanceByCurrency).length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Object.entries(balanceByCurrency).map(([currency, totalCents]) => (
            <Card key={currency}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t('summary.totalBalance', { currency })}
                </CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(totalCents, currency)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('summary.accountCount', {
                    count: filteredAccounts.filter(a => a.currency === currency).length
                  })}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle>{t('search.title')}</CardTitle>
          <CardDescription>
            {t('search.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('search.placeholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Bank Account List */}
      {filteredAccounts.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Wallet className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-semibold mb-2">
                {allAccounts && allAccounts.length > 0
                  ? t('empty.filteredTitle')
                  : t('empty.noAccountsTitle')}
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                {allAccounts && allAccounts.length > 0
                  ? t('empty.filteredDescription')
                  : t('empty.noAccountsDescription')}
              </p>
              {(!allAccounts || allAccounts.length === 0) && (
                <Button asChild>
                  <Link href="/financials/bank-accounts/new">
                    <Plus className="mr-2 h-4 w-4" />
                    {t('empty.addFirst')}
                  </Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredAccounts.map((account) => (
            <Card key={account.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{account.name}</CardTitle>
                    <CardDescription className="mt-1">
                      <Badge variant="info">
                        {account.currency}
                      </Badge>
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Balance Display */}
                  <div className="flex items-baseline gap-2">
                      <TrendingUp className={`h-5 w-5 ${account.balance_cents >= 0 ? 'text-success' : 'text-destructive'}`} />
                    <div>
                      <p className="text-xs text-muted-foreground">{t('list.currentBalance')}</p>
                      <p className={`text-2xl font-bold ${account.balance_cents >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {formatCurrency(account.balance_cents, account.currency)}
                      </p>
                    </div>
                  </div>

                  {/* Account Info */}
                  <div className="text-xs text-muted-foreground pt-2 border-t">
                    <p>{t('list.created', { date: new Date(account.created_at).toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) })}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2 border-t">
                    <Button variant="outline" size="sm" asChild className="flex-1">
                      <Link href={`/financials/bank-accounts/${account.id}/edit`}>
                        <Edit className="h-4 w-4 mr-1" />
                        {tCommon('edit')}
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteAccount(account.id, account.name)}
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Summary */}
      {allAccounts && allAccounts.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                {t('summary.showing', { filtered: filteredAccounts.length, total: allAccounts.length })}
              </span>
              <span>
                {t('summary.currencyCount', { count: Object.keys(balanceByCurrency).length })}
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
