'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Receipt } from 'lucide-react'
import { BillingHistorySkeleton } from '@/components/LoadingSkeletons'
import { useLocale, useTranslations } from 'next-intl'
import { apiClient } from '@/lib/api/client'
import { toast } from 'sonner'
import { RefundRequestModal } from './RefundRequestModal'

interface BillingPurchase {
    id: string
    amount_paid_cents: number
    currency: string
    plan_name: string | null
    paid_at: string
    provider: string
    total_refunded_cents: number
    has_refund_request?: boolean
}

export function BillingHistory() {
    const t = useTranslations('settings.billingPage.history')
    const locale = useLocale()
    const [purchases, setPurchases] = useState<BillingPurchase[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [selectedPurchase, setSelectedPurchase] = useState<BillingPurchase | null>(null)

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const data = await apiClient.get<BillingPurchase[]>('/api/v1/billing/history')
                setPurchases(data)
            } catch (err) {
                console.error('Failed to load billing history', err)
                toast.error(t('loadError'))
            } finally {
                setIsLoading(false)
            }
        }
        fetchHistory()
    }, [t])

    const formatCurrency = (cents: number, currency: string) => {
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: currency || 'BRL',
        }).format(cents / 100)
    }

    const formatDate = (dateString: string) => {
        return new Intl.DateTimeFormat(locale).format(new Date(dateString))
    }

    const isEligibleForRefund = (purchase: BillingPurchase) => {
        if (purchase.has_refund_request) {
            return false
        }
        const paidAt = new Date(purchase.paid_at).getTime()
        const now = Date.now()
        const diffDays = (now - paidAt) / (1000 * 60 * 60 * 24)
        return diffDays <= 7 && purchase.total_refunded_cents < purchase.amount_paid_cents
    }

    const getRefundStatusLabel = (purchase: BillingPurchase) => {
        if (purchase.total_refunded_cents >= purchase.amount_paid_cents) {
            return t('status.fullyRefunded')
        }
        if (purchase.has_refund_request) {
            return t('status.alreadyRequested')
        }
        if (isEligibleForRefund(purchase)) {
            return t('status.refundAvailable')
        }
        return t('status.windowClosed')
    }

    if (isLoading) {
        return <BillingHistorySkeleton />
    }

    return (
        <Card className="mt-8">
            <CardHeader>
                <CardTitle>{t('title')}</CardTitle>
                <CardDescription>
                    {t('description')}
                </CardDescription>
            </CardHeader>
            <CardContent>
                {purchases.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        {t('emptyState')}
                    </p>
                ) : (
                    <div className="space-y-4">
                        {purchases.map((purchase) => (
                            <div key={purchase.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                                <div className="flex items-start gap-4">
                                    <div className="p-2 bg-muted rounded-full">
                                        <Receipt className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                    <div>
                                        <div className="font-medium">
                                            {purchase.plan_name || t('fallbackPlanName')}
                                        </div>
                                        <div className="text-sm text-muted-foreground">
                                            {formatDate(purchase.paid_at)} • {purchase.provider}
                                        </div>
                                        <div className="mt-1">
                                            <Badge variant="outline" className="text-xs">
                                                {getRefundStatusLabel(purchase)}
                                            </Badge>
                                        </div>
                                        {purchase.total_refunded_cents > 0 && (
                                            <Badge variant="outline" className="mt-1 text-xs text-amber-600 border-amber-200">
                                                {t('refundedAmount', {
                                                    amount: formatCurrency(purchase.total_refunded_cents, purchase.currency),
                                                })}
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="font-bold">{formatCurrency(purchase.amount_paid_cents, purchase.currency)}</div>
                                    {isEligibleForRefund(purchase) && (
                                        <Button
                                            variant="link"
                                            size="sm"
                                            className="text-xs h-auto p-0 mt-1 text-muted-foreground hover:text-destructive"
                                            onClick={() => setSelectedPurchase(purchase)}
                                        >
                                            {t('requestRefund')}
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>

            {selectedPurchase && (
                <RefundRequestModal
                    purchase={selectedPurchase}
                    isOpen={!!selectedPurchase}
                    onClose={() => setSelectedPurchase(null)}
                />
            )}
        </Card>
    )
}
