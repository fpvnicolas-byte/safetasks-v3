'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiClient } from '@/lib/api/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft, CheckCircle, XCircle, DollarSign } from 'lucide-react'
import { RefundDetailSkeleton } from '@/components/LoadingSkeletons'
import Link from 'next/link'
import { useLocale } from 'next-intl'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import { format } from 'date-fns'

interface RefundDetail {
    id: string
    organization_id: string
    purchase_id: string
    status: string
    amount_paid_cents: number
    consumed_usage_value_cents: number
    calculated_max_refund_cents: number
    approved_amount_cents?: number
    reason_detail?: string
    requested_at: string
    eligible_until: string
}

type ActionPayload =
    | { action: 'approve'; approved_amount_cents: number }
    | { action: 'reject'; reason: string }
    | { action: 'confirm_execution'; provider_refund_id: string }

export default function PlatformRefundDetailPage() {
    const params = useParams()
    const id = params.id as string
    const locale = useLocale()

    const [request, setRequest] = useState<RefundDetail | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isProcessing, setIsProcessing] = useState(false)

    const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null)
    const [approvedAmount, setApprovedAmount] = useState<string>('')
    const [rejectReason, setRejectReason] = useState('')
    const [providerId, setProviderId] = useState('')

    const loadDetail = useCallback(async () => {
        try {
            const data = await apiClient.get<RefundDetail>(`/api/v1/platform/refunds/${id}`)
            setRequest(data)
        } catch (err) {
            console.error('Failed to load request', err)
            toast.error('Failed to load request details')
        } finally {
            setIsLoading(false)
        }
    }, [id])

    useEffect(() => {
        void loadDetail()
    }, [loadDetail])

    const submitAction = async (payload: ActionPayload) => {
        try {
            setIsProcessing(true)
            await apiClient.post(`/api/v1/platform/refunds/${id}/action`, payload)
            toast.success('Action successful')
            await loadDetail()
            setActionType(null)
            setProviderId('')
        } catch (err) {
            console.error(err)
            toast.error('Action failed')
        } finally {
            setIsProcessing(false)
        }
    }

    const handleApprove = async () => {
        const amount = Math.round(parseFloat(approvedAmount || '0') * 100)
        if (!Number.isFinite(amount) || amount <= 0) {
            toast.error('Enter a valid approved amount')
            return
        }
        await submitAction({ action: 'approve', approved_amount_cents: amount })
    }

    const handleReject = async () => {
        if (!rejectReason.trim()) {
            toast.error('Please provide a rejection reason')
            return
        }
        await submitAction({ action: 'reject', reason: rejectReason })
    }

    const handleConfirmExecution = async () => {
        if (!providerId.trim()) {
            toast.error('Provider refund ID is required')
            return
        }
        await submitAction({ action: 'confirm_execution', provider_refund_id: providerId.trim() })
    }

    if (isLoading) return <RefundDetailSkeleton />
    if (!request) return <div className="p-8">Request not found</div>

    const formatCents = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

    return (
        <div className="space-y-6 max-w-3xl">
            <Link href={`/${locale}/platform/refunds`} className="flex items-center text-sm text-muted-foreground hover:text-primary">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Queue
            </Link>

            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Refund Request <span className="text-muted-foreground text-lg ml-2">#{id.slice(0, 8)}</span></h1>
                <Badge className="text-lg">{request.status}</Badge>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader><CardTitle>Financials</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                        <div className="flex justify-between"><span>Amount Paid:</span> <span className="font-mono">{formatCents(request.amount_paid_cents)}</span></div>
                        <div className="flex justify-between"><span>Consumed Usage:</span> <span className="font-mono text-muted-foreground">{formatCents(request.consumed_usage_value_cents)}</span></div>
                        <div className="pt-2 border-t flex justify-between font-bold"><span>Max Refundable:</span> <span className="text-green-600">{formatCents(request.calculated_max_refund_cents)}</span></div>
                        {request.approved_amount_cents && (
                            <div className="pt-2 flex justify-between font-bold text-blue-600"><span>Approved:</span> <span>{formatCents(request.approved_amount_cents)}</span></div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle>Details</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                        <div><span className="font-semibold">Org ID:</span> {request.organization_id}</div>
                        <div><span className="font-semibold">Requested:</span> {format(new Date(request.requested_at), 'PP p')}</div>
                        <div><span className="font-semibold">Reason:</span> <p className="mt-1 text-sm bg-muted p-2 rounded">{request.reason_detail || 'No details'}</p></div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader><CardTitle>Actions</CardTitle></CardHeader>
                <CardContent>
                    {request.status === 'requested' && (
                        <div className="space-y-4">
                            {!actionType && (
                                <div className="flex gap-4">
                                    <Button onClick={() => { setActionType('approve'); setApprovedAmount((request.calculated_max_refund_cents / 100).toFixed(2)) }} className="bg-green-600 hover:bg-green-700"><CheckCircle className="mr-2 h-4 w-4" /> Approve Refund</Button>
                                    <Button onClick={() => setActionType('reject')} variant="destructive"><XCircle className="mr-2 h-4 w-4" /> Reject Request</Button>
                                </div>
                            )}

                            {actionType === 'approve' && (
                                <div className="space-y-4 border p-4 rounded bg-green-50/50">
                                    <Label>Approved Amount (BRL)</Label>
                                    <Input type="number" value={approvedAmount} onChange={e => setApprovedAmount(e.target.value)} />
                                    <div className="flex gap-2">
                                        <Button onClick={handleApprove} disabled={isProcessing}>Confirm Approval</Button>
                                        <Button variant="ghost" onClick={() => setActionType(null)}>Cancel</Button>
                                    </div>
                                </div>
                            )}

                            {actionType === 'reject' && (
                                <div className="space-y-4 border p-4 rounded bg-red-50/50">
                                    <Label>Rejection Reason</Label>
                                    <Textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
                                    <div className="flex gap-2">
                                        <Button onClick={handleReject} disabled={isProcessing} variant="destructive">Confirm Rejection</Button>
                                        <Button variant="ghost" onClick={() => setActionType(null)}>Cancel</Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {request.status === 'processing' && (
                        <div className="space-y-4">
                            <div className="p-4 bg-blue-50 text-blue-800 rounded mb-4">
                                <strong>Action Required:</strong> Please manually refund <strong>{formatCents(request.approved_amount_cents || 0)}</strong> in the Payment Provider Dashboard.
                            </div>

                            <div className="space-y-4 border p-4 rounded">
                                <Label>Provider Refund ID (Proof)</Label>
                                <Input placeholder="e.g. re_123456789" value={providerId} onChange={e => setProviderId(e.target.value)} />
                                <Button onClick={handleConfirmExecution} disabled={isProcessing || !providerId}>
                                    <DollarSign className="mr-2 h-4 w-4" /> Confirm Manual Execution
                                </Button>
                            </div>
                        </div>
                    )}

                    {['refunded', 'rejected'].includes(request.status) && (
                        <div className="text-muted-foreground">No further actions available. Request is {request.status}.</div>
                    )}
                </CardContent>
            </Card>

        </div>
    )
}
