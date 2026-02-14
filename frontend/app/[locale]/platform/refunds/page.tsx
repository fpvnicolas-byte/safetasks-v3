'use client'

import { useState, useEffect } from 'react'
import { apiClient } from '@/lib/api/client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RefundQueueSkeleton } from '@/components/LoadingSkeletons'
import Link from 'next/link'
import { useLocale } from 'next-intl'

interface RefundRequest {
    id: string
    purchase_id: string
    status: string
    amount_paid_cents: number
    approved_amount_cents?: number
    requested_at: string
    requester_profile_id: string
}

export default function PlatformRefundsPage() {
    const [requests, setRequests] = useState<RefundRequest[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const locale = useLocale()

    useEffect(() => {
        const fetchQueue = async () => {
            try {
                const data = await apiClient.get<RefundRequest[]>('/api/v1/platform/refunds/')
                setRequests(data)
            } catch (err) {
                console.error('Failed to load queue', err)
            } finally {
                setIsLoading(false)
            }
        }
        fetchQueue()
    }, [])

    const formatCurrency = (cents: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'requested': return 'bg-blue-100 text-blue-800'
            case 'processing': return 'bg-yellow-100 text-yellow-800'
            case 'refunded': return 'bg-green-100 text-green-800'
            case 'rejected': return 'bg-red-100 text-red-800'
            default: return 'bg-gray-100 text-gray-800'
        }
    }

    if (isLoading) return <RefundQueueSkeleton />

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tight">Refund Queue</h2>
            </div>

            <Card>
                <CardContent className="p-0">
                    <div className="relative w-full overflow-auto">
                        <table className="w-full caption-bottom text-sm">
                            <thead className="[&_tr]:border-b">
                                <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Date</th>
                                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Status</th>
                                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Amount Paid</th>
                                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="[&_tr:last-child]:border-0">
                                {requests.map((req) => (
                                    <tr key={req.id} className="border-b transition-colors hover:bg-muted/50">
                                        <td className="p-4 align-middle">
                                            {new Date(req.requested_at).toLocaleDateString()}
                                        </td>
                                        <td className="p-4 align-middle">
                                            <Badge className={getStatusColor(req.status)} variant="secondary">
                                                {req.status}
                                            </Badge>
                                        </td>
                                        <td className="p-4 align-middle font-mono">
                                            {formatCurrency(req.amount_paid_cents)}
                                        </td>
                                        <td className="p-4 align-middle">
                                            <Link href={`/${locale}/platform/refunds/${req.id}`}>
                                                <Button size="sm" variant="outline">Review</Button>
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
