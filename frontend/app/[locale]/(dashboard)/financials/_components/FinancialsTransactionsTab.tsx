'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock, Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { TransactionListSkeleton } from '@/components/LoadingSkeletons'
import { formatCurrency } from '@/lib/utils/money'
import type { TransactionWithRelations } from '@/types'

interface FinancialsTransactionsTabProps {
  recentTransactions: TransactionWithRelations[] | undefined
  isLoading: boolean
  locale: string
}

export function FinancialsTransactionsTab({
  recentTransactions,
  isLoading,
  locale,
}: FinancialsTransactionsTabProps) {
  const t = useTranslations('financials')
  const tTransactionsPage = useTranslations('financials.pages.transactions')
  const tApprovals = useTranslations('financials.approvals')

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('transactionsTab.title')}</CardTitle>
        <CardDescription>{t('transactionsTab.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <TransactionListSkeleton />
        ) : recentTransactions && recentTransactions.length > 0 ? (
          <div className="space-y-4">
            {recentTransactions.map((transaction) => (
              <div key={transaction.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="font-medium">{transaction.description || t('transactionsTab.noDescription')}</div>
                    {transaction.payment_status === 'pending' && (
                      <Badge variant="warning" className="text-[10px]">
                        <Clock className="w-3 h-3" />
                        {tApprovals('waitingApproval')}
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {new Date(transaction.transaction_date).toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}{' '}
                    • {tTransactionsPage(`categories.${transaction.category}`)}
                    {transaction.bank_account?.name ? ` • ${transaction.bank_account.name}` : ''}
                  </div>
                </div>
                <div className={`font-bold ${transaction.type === 'income' ? 'text-success' : 'text-destructive'}`}>
                  {transaction.type === 'income' ? '+' : '-'}
                  {formatCurrency(transaction.amount_cents, transaction.bank_account?.currency)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <p className="text-sm text-muted-foreground mb-4">{t('transactionsTab.noRecentTransactions')}</p>
          </div>
        )}
        <div className="mt-6 flex justify-center">
          <Button asChild variant="outline">
            <Link href="/financials/transactions">
              <Plus className="mr-2 h-4 w-4" />
              {t('transactionsTab.viewTransactions')}
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
