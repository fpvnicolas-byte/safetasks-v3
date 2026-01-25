'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useTransactions } from '@/lib/api/hooks/useTransactions'
import { useAuth } from '@/contexts/AuthContext'
import { formatCurrency } from '@/lib/utils/money'
import { ArrowUpRight, ArrowDownRight, ExternalLink } from 'lucide-react'
import Link from 'next/link'

export function RecentTransactions() {
  const { organizationId } = useAuth()
  const { data: transactions, isLoading } = useTransactions(
    organizationId ? { organizationId } : {}
  )

  const recentTransactions = transactions?.slice(0, 10) || []

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Recent Transactions</CardTitle>
            <CardDescription>Latest financial activity</CardDescription>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/financials/transactions">
              View All
              <ExternalLink className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading transactions...</div>
        ) : recentTransactions.length > 0 ? (
          <div className="space-y-3">
            {recentTransactions.map((transaction) => {
              const isIncome = transaction.type === 'income'

              return (
                <div key={transaction.id} className="flex items-center justify-between border-b pb-3 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${isIncome ? 'bg-green-100' : 'bg-red-100'}`}>
                      {isIncome ? (
                        <ArrowDownRight className="h-4 w-4 text-green-600" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4 text-red-600" />
                      )}
                    </div>
                    <div>
                      <div className="font-medium text-sm">
                        {transaction.description || 'No description'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {transaction.category} • {new Date(transaction.transaction_date).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className={`font-semibold ${isIncome ? 'text-green-600' : 'text-red-600'}`}>
                    {isIncome ? '+' : '-'}{formatCurrency(transaction.amount_cents)}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">No transactions yet</p>
            <Button asChild>
              <Link href="/financials/transactions/new">Record Transaction</Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
