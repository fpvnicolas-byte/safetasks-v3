'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { TransactionWithRelations } from '@/types'
import { formatCurrency } from '@/lib/utils/money'
import { useApproveTransaction, useRejectTransaction, useMarkTransactionPaid } from '@/lib/api/hooks/useTransactions'
import { Loader2, CheckCircle, DollarSign, Ban } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/contexts/AuthContext'

interface ExpenseApprovalDialogProps {
    transaction: TransactionWithRelations | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function ExpenseApprovalDialog({ transaction, open, onOpenChange }: ExpenseApprovalDialogProps) {
    const t = useTranslations('financials.approvals')
    const { organizationId } = useAuth()

    const [rejectionReason, setRejectionReason] = useState('')
    const [isRejecting, setIsRejecting] = useState(false)

    const approveMutation = useApproveTransaction()
    const rejectMutation = useRejectTransaction()
    const markPaidMutation = useMarkTransactionPaid()

    if (!transaction || !organizationId) return null

    const handleApprove = async () => {
        try {
            await approveMutation.mutateAsync({ organizationId, transactionId: transaction.id })
            toast.success(t('approveConfirm'))
            onOpenChange(false)
        } catch (error) {
            toast.error('Failed to approve transaction')
        }
    }

    const handleReject = async () => {
        if (!rejectionReason.trim()) {
            toast.error(t('warnings.rejectionReasonRequired'))
            return
        }

        try {
            await rejectMutation.mutateAsync({
                organizationId,
                transactionId: transaction.id,
                reason: rejectionReason
            })
            toast.success(t('rejectConfirm'))
            onOpenChange(false) // Close dialog
            setIsRejecting(false) // Reset state
            setRejectionReason('')
        } catch (error) {
            toast.error('Failed to reject transaction')
        }
    }

    const handleMarkPaid = async () => {
        try {
            await markPaidMutation.mutateAsync({ organizationId, transactionId: transaction.id })
            toast.success(t('paid'))
            onOpenChange(false)
        } catch (error) {
            toast.error('Failed to mark as paid')
        }
    }

    const handleClose = () => {
        onOpenChange(false)
        setIsRejecting(false)
        setRejectionReason('')
    }

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{t('dialogTitle')}</DialogTitle>
                    <DialogDescription>
                        {transaction.description || 'No description'}
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    {/* Details */}
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-muted-foreground">{t('expenseInfo')}</span>
                    </div>

                    <div className="rounded-lg border p-3 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Amount</span>
                            <span className="text-xl font-bold">{formatCurrency(transaction.amount_cents)}</span>
                        </div>

                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Date</span>
                            <span>{new Date(transaction.transaction_date).toLocaleDateString()}</span>
                        </div>

                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Category</span>
                            <Badge variant="outline" className="capitalize">{transaction.category.replace('_', ' ')}</Badge>
                        </div>

                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Status</span>
                            <StatusBadge status={transaction.payment_status} t={t} />
                        </div>
                    </div>

                    {transaction.payment_status === 'rejected' && transaction.rejection_reason && (
                        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                            <div className="font-semibold mb-1">{t('rejectionReason')}</div>
                            {transaction.rejection_reason}
                        </div>
                    )}

                    {isRejecting && (
                        <div className="space-y-2 pt-2 animate-in fade-in slide-in-from-top-2">
                            <Label htmlFor="reason">{t('rejectionReason')}</Label>
                            <Textarea
                                id="reason"
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                placeholder={t('rejectionReasonPlaceholder')}
                                rows={3}
                            />
                        </div>
                    )}
                </div>

                <DialogFooter className="flex-col sm:flex-row gap-2">
                    {!isRejecting ? (
                        <>
                            <Button variant="outline" onClick={handleClose}>
                                Close
                            </Button>

                            {transaction.payment_status === 'pending' && (
                                <>
                                    <Button variant="destructive" onClick={() => setIsRejecting(true)}>
                                        <Ban className="w-4 h-4 mr-2" />
                                        {t('reject')}
                                    </Button>
                                    <Button onClick={handleApprove} disabled={approveMutation.isPending}>
                                        {approveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                        {!approveMutation.isPending && <CheckCircle className="w-4 h-4 mr-2" />}
                                        {t('approve')}
                                    </Button>
                                </>
                            )}

                            {transaction.payment_status === 'approved' && (
                                <Button onClick={handleMarkPaid} disabled={markPaidMutation.isPending} className="bg-green-600 hover:bg-green-700">
                                    {markPaidMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                    {!markPaidMutation.isPending && <DollarSign className="w-4 h-4 mr-2" />}
                                    {t('markPaid')}
                                </Button>
                            )}
                        </>
                    ) : (
                        <>
                            <Button variant="ghost" onClick={() => setIsRejecting(false)}>
                                Cancel
                            </Button>
                            <Button variant="destructive" onClick={handleReject} disabled={rejectMutation.isPending}>
                                {rejectMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                {t('rejectConfirm')}
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function StatusBadge({ status, t }: { status?: string, t: any }) {
    if (!status) return null

    const variants: Record<string, "default" | "secondary" | "destructive" | "outline" | "success"> = {
        pending: "secondary",
        approved: "default", // or custom blue
        paid: "success", // Need to ensure badge supports 'success' variant or use green class
        rejected: "destructive"
    }

    // Custom styling for paid/approved if variant not supported
    let className = ""
    if (status === 'paid') className = "bg-green-100 text-green-800 hover:bg-green-200 border-green-200"
    if (status === 'approved') className = "bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-200"

    return (
        <Badge variant={variants[status] as any || "outline"} className={className}>
            {t(status)}
        </Badge>
    )
}
