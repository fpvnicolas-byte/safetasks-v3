'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { apiClient } from '@/lib/api/client'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'

interface BillingPurchase {
    id: string
    amount_paid_cents: number
    currency: string
    plan_name: string | null
    paid_at: string
}

interface RefundRequestModalProps {
    purchase: BillingPurchase
    isOpen: boolean
    onClose: () => void
}

export function RefundRequestModal({ purchase, isOpen, onClose }: RefundRequestModalProps) {
    const t = useTranslations('settings.billingPage.refundModal')
    const [reasonCode, setReasonCode] = useState<string>('')
    const [reasonDetail, setReasonDetail] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleSubmit = async () => {
        if (!reasonCode) {
            toast.error('Please select a reason')
            return
        }

        try {
            setIsSubmitting(true)
            await apiClient.post('/api/v1/refunds/request', {
                purchase_id: purchase.id,
                reason_code: reasonCode,
                reason_detail: reasonDetail
            })
            toast.success('Refund request submitted successfully. We will review it shortly.')
            onClose()
        } catch (error: unknown) {
            console.error('Refund request failed', error)
            const message =
                typeof error === 'object' &&
                error !== null &&
                'message' in error &&
                typeof (error as { message?: unknown }).message === 'string'
                    ? (error as { message: string }).message
                    : 'Failed to submit refund request'
            toast.error(message)
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t('title', 'Request Refund')}</DialogTitle>
                    <DialogDescription>
                        {t('description', 'You can request a refund within 7 days of purchase. Amount is subject to usage deduction.')}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="text-sm font-medium">
                        Refund for: <span className="font-bold">{purchase.plan_name}</span>
                    </div>

                    <div className="space-y-2">
                        <Label>Reason</Label>
                        <Select value={reasonCode} onValueChange={setReasonCode}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a reason" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="accidental_purchase">Accidental Purchase</SelectItem>
                                <SelectItem value="features_not_as_expected">Features not as expected</SelectItem>
                                <SelectItem value="found_better_alternative">Found better alternative</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Additional Details (Optional)</Label>
                        <Textarea
                            value={reasonDetail}
                            onChange={(e) => setReasonDetail(e.target.value)}
                            placeholder="Tell us more about why you are requesting a refund..."
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting || !reasonCode}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Submit Request
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
