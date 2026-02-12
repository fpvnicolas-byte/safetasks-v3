'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, Receipt } from 'lucide-react'
import { useTranslations } from 'next-intl'
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
}

export function BillingHistory() {
    const t = useTranslations('settings.billingPage.history')
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
                toast.error('Failed to load billing history')
            } finally {
                setIsLoading(false)
            }
        }
        fetchHistory()
    }, [])

    const formatCurrency = (cents: number, currency: string) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: currency,
        }).format(cents / 100)
    }

    const formatDate = (dateString: string) => {
        return new Intl.DateTimeFormat('pt-BR').format(new Date(dateString))
    }

    const isEligibleForRefund = (purchase: BillingPurchase) => {
        const paidAt = new Date(purchase.paid_at).getTime()
        const now = Date.now()
        const diffDays = (now - paidAt) / (1000 * 60 * 60 * 24)
        return diffDays <= 7 && purchase.total_refunded_cents < purchase.amount_paid_cents
    }

    const getRefundStatusLabel = (purchase: BillingPurchase) => {
        if (purchase.total_refunded_cents >= purchase.amount_paid_cents) {
            return 'Fully refunded'
        }
        if (isEligibleForRefund(purchase)) {
            return 'Refund available'
        }
        return 'Refund window closed'
    }

    if (isLoading) {
        return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
    }

    return (
        <Card className="mt-8">
            <CardHeader>
                <CardTitle>{t('title', 'Billing History')}</CardTitle>
                <CardDescription>
                    {t('description', 'View your recent payments and receipts. Refund requests are available for 7 days after purchase.')}
                </CardDescription>
            </CardHeader>
            <CardContent>
                {purchases.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        No billing purchases found yet for this organization.
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
                                            {purchase.plan_name || 'Billed Charge'}
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
                                                Refunded: {formatCurrency(purchase.total_refunded_cents, purchase.currency)}
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
                                            Request Refund
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
