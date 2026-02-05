'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { usePendingTransactions, useTransactions } from '@/lib/api/hooks/useTransactions'
import { useAuth } from '@/contexts/AuthContext'
import { useTranslations } from 'next-intl'
import { formatCurrency } from '@/lib/utils/money'
import { Loader2, CheckCircle, XCircle, AlertCircle, Filter, Clock } from 'lucide-react'
import { ExpenseApprovalDialog } from './ExpenseApprovalDialog'
import { TransactionWithRelations } from '@/types'

export function ExpenseApprovalDashboard() {
    const t = useTranslations('financials.approvals')
    const { organizationId } = useAuth()
    const [selectedTransaction, setSelectedTransaction] = useState<TransactionWithRelations | null>(null)
    const [isDialogOpen, setIsDialogOpen] = useState(false)

    // Fetch pending transactions
    const { data: pendingTransactions, isLoading, error } = usePendingTransactions(organizationId || undefined)

    // Calculate total pending amount
    const totalPending = pendingTransactions?.reduce((acc, tx) => acc + (tx.amount_cents || 0), 0) || 0

    const handleTransactionClick = (transaction: TransactionWithRelations) => {
        setSelectedTransaction(transaction)
        setIsDialogOpen(true)
    }

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>{t('title')}</CardTitle>
                    <CardDescription>{t('pendingAmount')}</CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </CardContent>
            </Card>
        )
    }

    return (
        <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            {t('pendingAmount')}
                        </CardTitle>
                        <AlertCircle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(totalPending)}</div>
                        <p className="text-xs text-muted-foreground">
                            {t('pendingCount', { count: pendingTransactions?.length || 0 })}
                        </p>
                    </CardContent>
                </Card>
            </div>

            <Card className="col-span-4">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>{t('title')}</CardTitle>
                            <CardDescription>
                                {t('pendingCount', { count: pendingTransactions?.length || 0 })}
                            </CardDescription>
                        </div>
                        {/* Future: Add filters here */}
                    </div>
                </CardHeader>
                <CardContent>
                    {!pendingTransactions || pendingTransactions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                            <CheckCircle className="h-12 w-12 mb-4 opacity-20" />
                            <p>No pending approvals</p>
                        </div>
                    ) : (
                        <div className="h-[400px] pr-4 overflow-y-auto">
                            <div className="space-y-4">
                                {pendingTransactions.map((tx) => (
                                    <div
                                        key={tx.id}
                                        className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                                        onClick={() => handleTransactionClick(tx)}
                                    >
                                        <div className="grid gap-1">
                                            <div className="font-medium">
                                                {tx.description || 'No description'}
                                            </div>
                                            <div className="text-sm text-muted-foreground">
                                                {new Date(tx.transaction_date).toLocaleDateString()} • {tx.category}
                                                {tx.supplier_id && ' • Supplier'}
                                                {tx.project && ` • ${tx.project.title}`}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="text-right">
                                                <div className="font-bold">{formatCurrency(tx.amount_cents)}</div>
                                                <div className="mt-1 flex flex-wrap justify-end gap-1.5">
                                                    <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                                                        <Clock className="w-3 h-3 mr-1" />
                                                        {t('waitingApproval')}
                                                    </Badge>
                                                    {tx.project?.budget_status === 'approved' && (
                                                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                                            <CheckCircle className="w-3 h-3 mr-1" />
                                                            {t('budgetApproved') || 'Budget Approved'}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            <ExpenseApprovalDialog
                transaction={selectedTransaction}
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
            />
        </>
    )
}
