'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock, Loader2, Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { formatCurrency } from '@/lib/utils/money'
import type { TransactionWithRelations } from '@/types'

interface FinancialsExpensesTabProps {
  recentExpenses: TransactionWithRelations[] | undefined
  isLoading: boolean
  locale: string
}

export function FinancialsExpensesTab({
  recentExpenses,
  isLoading,
  locale,
}: FinancialsExpensesTabProps) {
  const t = useTranslations('financials')
  const tTransactionsPage = useTranslations('financials.pages.transactions')
  const tApprovals = useTranslations('financials.approvals')

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('expensesTab.title')}</CardTitle>
        <CardDescription>{t('expensesTab.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : recentExpenses && recentExpenses.length > 0 ? (
          <div className="space-y-4">
            {recentExpenses.map((expense) => (
              <div key={expense.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="font-medium">{expense.description || t('transactionsTab.noDescription')}</div>
                    {expense.payment_status === 'pending' && (
                      <Badge variant="warning" className="text-[10px]">
                        <Clock className="w-3 h-3" />
                        {tApprovals('waitingApproval')}
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {new Date(expense.transaction_date).toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}{' '}
                    • {tTransactionsPage(`categories.${expense.category}`)}
                    {expense.bank_account?.name ? ` • ${expense.bank_account.name}` : ''}
                  </div>
                </div>
                <div className="font-bold text-destructive">
                  -{formatCurrency(expense.amount_cents, expense.bank_account?.currency)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <p className="text-sm text-muted-foreground mb-4">{t('expensesTab.noRecentExpenses')}</p>
          </div>
        )}
        <div className="mt-6 flex justify-center">
          <Button asChild variant="outline">
            <Link href="/financials/transactions?type=expense">
              <Plus className="mr-2 h-4 w-4" />
              {t('expensesTab.viewExpenses')}
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
