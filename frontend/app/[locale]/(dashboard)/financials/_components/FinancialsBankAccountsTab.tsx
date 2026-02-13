'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { formatCurrency } from '@/lib/utils/money'
import type { BankAccount } from '@/types'

interface FinancialsBankAccountsTabProps {
  bankAccounts: BankAccount[] | undefined
  isLoading: boolean
}

export function FinancialsBankAccountsTab({ bankAccounts, isLoading }: FinancialsBankAccountsTabProps) {
  const t = useTranslations('financials')

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('bankAccountsTab.title')}</CardTitle>
        <CardDescription>{t('bankAccountsTab.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : bankAccounts && bankAccounts.length > 0 ? (
          <div className="space-y-4">
            {bankAccounts.map((account) => (
              <div key={account.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                <div>
                  <div className="font-medium">{account.name}</div>
                  <div className="text-sm text-muted-foreground">{account.currency}</div>
                </div>
                <div className="font-bold">{formatCurrency(account.balance_cents, account.currency)}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <p className="text-sm text-muted-foreground mb-4">{t('bankAccountsTab.noBankAccounts')}</p>
          </div>
        )}
        <div className="mt-6 flex justify-center">
          <Button asChild variant="outline">
            <Link href="/financials/bank-accounts">
              <Plus className="mr-2 h-4 w-4" />
              {t('bankAccountsTab.viewBankAccounts')}
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
