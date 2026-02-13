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
            toast.error(t('messages.reasonRequired'))
            return
        }

        try {
            setIsSubmitting(true)
            await apiClient.post('/api/v1/refunds/request', {
                purchase_id: purchase.id,
                reason_code: reasonCode,
                reason_detail: reasonDetail
            })
            toast.success(t('messages.submitSuccess'))
            onClose()
        } catch (error: unknown) {
            console.error('Refund request failed', error)
            const message =
                typeof error === 'object' &&
                error !== null &&
                'message' in error &&
                typeof (error as { message?: unknown }).message === 'string'
                    ? (error as { message: string }).message
                    : t('messages.submitError')
            toast.error(message)
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t('title')}</DialogTitle>
                    <DialogDescription>
                        {t('description')}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="text-sm font-medium">
                        {t('refundFor')}{' '}
                        <span className="font-bold">{purchase.plan_name || t('fallbackPlanName')}</span>
                    </div>

                    <div className="space-y-2">
                        <Label>{t('fields.reasonLabel')}</Label>
                        <Select value={reasonCode} onValueChange={setReasonCode}>
                            <SelectTrigger>
                                <SelectValue placeholder={t('fields.reasonPlaceholder')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="accidental_purchase">{t('fields.reasonOptions.accidentalPurchase')}</SelectItem>
                                <SelectItem value="features_not_as_expected">{t('fields.reasonOptions.featuresNotAsExpected')}</SelectItem>
                                <SelectItem value="found_better_alternative">{t('fields.reasonOptions.foundBetterAlternative')}</SelectItem>
                                <SelectItem value="other">{t('fields.reasonOptions.other')}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>{t('fields.detailsLabel')}</Label>
                        <Textarea
                            value={reasonDetail}
                            onChange={(e) => setReasonDetail(e.target.value)}
                            placeholder={t('fields.detailsPlaceholder')}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
                        {t('actions.cancel')}
                    </Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting || !reasonCode}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {t('actions.submit')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
