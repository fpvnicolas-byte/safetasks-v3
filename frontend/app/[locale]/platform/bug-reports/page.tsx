'use client'

import { usePlatformBugReports, useUpdateBugReport } from '@/lib/api/hooks/useBugReports'
import KanbanBoard from '@/components/platform/KanbanBoard'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'

export default function PlatformBugReportsPage() {
    const { data: reports, isLoading } = usePlatformBugReports()
    const updateReport = useUpdateBugReport()
    const t = useTranslations('platform.bugReports')

    const handleStatusChange = (id: string, newStatus: string) => {
        updateReport.mutate(
            { id, status: newStatus },
            {
                onSuccess: () => toast.success('Status updated'),
                onError: () => toast.error('Failed to update status'),
            }
        )
    }

    if (isLoading) return <div className="p-8"><Loader2 className="animate-spin" /></div>

    return (
        <div className="space-y-6">
            <h2 className="text-3xl font-bold tracking-tight">{t('title')}</h2>
            <KanbanBoard reports={reports ?? []} onStatusChange={handleStatusChange} />
        </div>
    )
}
