'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Receipt } from 'lucide-react'
import { BillingHistorySkeleton } from '@/components/LoadingSkeletons'
import { useLocale, useTranslations } from 'next-intl'
import { apiClient } from '@/lib/api/client'
import { toast } from 'sonner'

interface BillingPurchase {
    id: string
    amount_paid_cents: number
    currency: string
    plan_name: string | null
    paid_at: string
    provider: string
    total_refunded_cents: number
}

export function BillingHistory() {
    const t = useTranslations('settings.billingPage.history')
    const locale = useLocale()
    const [purchases, setPurchases] = useState<BillingPurchase[]>([])
    const [isLoading, setIsLoading] = useState(true)

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

    const getPaymentStatusLabel = (purchase: BillingPurchase) => {
        if (purchase.total_refunded_cents >= purchase.amount_paid_cents) {
            return t('status.fullyRefunded')
        }
        return 'Paid via Stripe'
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
                                                {getPaymentStatusLabel(purchase)}
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
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
