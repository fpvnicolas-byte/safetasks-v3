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
import { useLocale } from 'next-intl'

export default function BankAccountsPage() {
  const { organizationId } = useAuth()
  const locale = useLocale()
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
    if (!confirm(`Are you sure you want to delete bank account "${accountName}"? This action cannot be undone.`)) {
      return
    }

    try {
      await deleteBankAccount.mutateAsync({
        organizationId: organizationId || '',
        accountId: accountId
      })
    } catch (err: unknown) {
      const error = err as Error
      alert(`Failed to delete bank account: ${error.message}`)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bank Accounts</h1>
          <p className="text-muted-foreground">Loading bank accounts...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bank Accounts</h1>
          <p className="text-destructive">Failed to load bank accounts. Please try again.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bank Accounts</h1>
          <p className="text-muted-foreground">
            Manage your company bank accounts and track balances
          </p>
        </div>
        <Button asChild>
          <Link href="/financials/bank-accounts/new">
            <Plus className="mr-2 h-4 w-4" />
            New Bank Account
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
                  Total Balance ({currency})
                </CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(totalCents, currency)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {filteredAccounts.filter(a => a.currency === currency).length} account{filteredAccounts.filter(a => a.currency === currency).length !== 1 ? 's' : ''}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle>Search Accounts</CardTitle>
          <CardDescription>
            Find bank accounts by name or currency
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or currency..."
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
                {allAccounts && allAccounts.length > 0 ? 'No accounts found' : 'No bank accounts yet'}
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                {allAccounts && allAccounts.length > 0
                  ? 'Try adjusting your search'
                  : 'Get started by adding your first bank account'}
              </p>
              {(!allAccounts || allAccounts.length === 0) && (
                <Button asChild>
                  <Link href="/financials/bank-accounts/new">
                    <Plus className="mr-2 h-4 w-4" />
                    Add First Bank Account
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
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
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
                    <TrendingUp className={`h-5 w-5 ${account.balance_cents >= 0 ? 'text-green-600' : 'text-red-600'}`} />
                    <div>
                      <p className="text-xs text-muted-foreground">Current Balance</p>
                      <p className={`text-2xl font-bold ${account.balance_cents >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(account.balance_cents, account.currency)}
                      </p>
                    </div>
                  </div>

                  {/* Account Info */}
                  <div className="text-xs text-muted-foreground pt-2 border-t">
                    <p>Created: {new Date(account.created_at).toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2 border-t">
                    <Button variant="outline" size="sm" asChild className="flex-1">
                      <Link href={`/financials/bank-accounts/${account.id}/edit`}>
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteAccount(account.id, account.name)}
                      className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
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
                Showing {filteredAccounts.length} of {allAccounts.length} bank account{allAccounts.length !== 1 ? 's' : ''}
              </span>
              <span>
                {Object.keys(balanceByCurrency).length} currenc{Object.keys(balanceByCurrency).length !== 1 ? 'ies' : 'y'}
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
