'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { usePendingBudgetProjects, useApproveBudget, useRejectBudget } from '@/lib/api/hooks/useProjects'
import { useAuth } from '@/contexts/AuthContext'
import { useTranslations } from 'next-intl'
import { formatCurrency } from '@/lib/utils/money'
import { Loader2, CheckCircle, XCircle, Wallet, Folder, Clock } from 'lucide-react'
import { ProjectWithClient } from '@/types'
import { toast } from 'sonner'

export function BudgetApprovalDashboard() {
    const t = useTranslations('financials.budgetApprovals')
    const { organizationId } = useAuth()
    const [selectedProject, setSelectedProject] = useState<ProjectWithClient | null>(null)
    const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false)
    const [rejectionReason, setRejectionReason] = useState('')

    // Fetch pending budget projects
    const { data: pendingProjects, isLoading } = usePendingBudgetProjects(organizationId || undefined)

    // Calculate total pending budget
    const totalPending = pendingProjects?.reduce((acc, p) => acc + (p.budget_total_cents || 0), 0) || 0

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>{t('title')}</CardTitle>
                    <CardDescription>{t('description')}</CardDescription>
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
                        <Wallet className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(totalPending)}</div>
                        <p className="text-xs text-muted-foreground">
                            {t('pendingCount', { count: pendingProjects?.length || 0 })}
                        </p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>{t('title')}</CardTitle>
                            <CardDescription>
                                {t('pendingCount', { count: pendingProjects?.length || 0 })}
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {!pendingProjects || pendingProjects.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                            <CheckCircle className="h-12 w-12 mb-4 opacity-20" />
                            <p>{t('noPending')}</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {pendingProjects.map((project) => (
                                <BudgetApprovalCard
                                    key={project.id}
                                    project={project}
                                    organizationId={organizationId || ''}
                                    onReject={(p) => {
                                        setSelectedProject(p)
                                        setIsRejectDialogOpen(true)
                                    }}
                                />
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Rejection Dialog */}
            <RejectBudgetDialog
                project={selectedProject}
                open={isRejectDialogOpen}
                onOpenChange={(open) => {
                    setIsRejectDialogOpen(open)
                    if (!open) {
                        setRejectionReason('')
                        setSelectedProject(null)
                    }
                }}
                organizationId={organizationId || ''}
            />
        </>
    )
}

interface BudgetApprovalCardProps {
    project: ProjectWithClient
    organizationId: string
    onReject: (project: ProjectWithClient) => void
}

function BudgetApprovalCard({ project, organizationId, onReject }: BudgetApprovalCardProps) {
    const t = useTranslations('financials.budgetApprovals')
    const approveBudget = useApproveBudget(project.id, organizationId)

    const handleApprove = async () => {
        try {
            await approveBudget.mutateAsync({})
            toast.success(t('approveSuccess'))
        } catch (error) {
            console.error('Failed to approve budget:', error)
            toast.error(t('error'))
        }
    }

    return (
        <div className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-4">
                <div className="p-2 rounded-full bg-yellow-100 dark:bg-yellow-900/30">
                    <Folder className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div className="grid gap-1">
                    <div className="font-medium">{project.title}</div>
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                        {project.client?.name && <span>{project.client.name}</span>}
                        {project.budget_notes && (
                            <>
                                <span>•</span>
                                <span className="italic">{project.budget_notes}</span>
                            </>
                        )}
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-4">
                <div className="text-right">
                    <div className="font-bold text-lg">{formatCurrency(project.budget_total_cents || 0)}</div>
                    <Badge variant="secondary" className="mt-1 gap-1">
                        <Clock className="h-3 w-3" />
                        {t('pending')}
                    </Badge>
                </div>
                <div className="flex gap-2">
                    <Button
                        size="sm"
                        onClick={handleApprove}
                        disabled={approveBudget.isPending}
                    >
                        {approveBudget.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <CheckCircle className="h-4 w-4 mr-1" />
                        )}
                        {t('approve')}
                    </Button>
                    <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => onReject(project)}
                    >
                        <XCircle className="h-4 w-4 mr-1" />
                        {t('reject')}
                    </Button>
                </div>
            </div>
        </div>
    )
}

interface RejectBudgetDialogProps {
    project: ProjectWithClient | null
    open: boolean
    onOpenChange: (open: boolean) => void
    organizationId: string
}

function RejectBudgetDialog({ project, open, onOpenChange, organizationId }: RejectBudgetDialogProps) {
    const t = useTranslations('financials.budgetApprovals')
    const [reason, setReason] = useState('')
    const rejectBudget = useRejectBudget(project?.id || '', organizationId)

    const handleReject = async () => {
        if (!reason.trim() || !project) return

        try {
            await rejectBudget.mutateAsync({ reason })
            toast.success(t('rejectSuccess'))
            onOpenChange(false)
            setReason('')
        } catch (error) {
            console.error('Failed to reject budget:', error)
            toast.error(t('error'))
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t('rejectTitle')}</DialogTitle>
                    <DialogDescription>
                        {t('rejectDescription', { project: project?.title || '' })}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="reason">{t('rejectReason')}</Label>
                        <Textarea
                            id="reason"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder={t('rejectReasonPlaceholder')}
                            rows={3}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        {t('cancel')}
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={handleReject}
                        disabled={!reason.trim() || rejectBudget.isPending}
                    >
                        {rejectBudget.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        {t('confirmReject')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
