'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { apiClient } from '@/lib/api/client'
import { BugReport } from '@/lib/api/hooks/useBugReports'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { useLocale } from 'next-intl'

function statusVariant(status: string) {
    switch (status) {
        case 'open':
            return 'default' as const
        case 'in_review':
            return 'warning' as const
        case 'resolved':
            return 'success' as const
        case 'closed':
            return 'secondary' as const
        default:
            return 'outline' as const
    }
}

function categoryVariant(category: string) {
    switch (category) {
        case 'bug':
            return 'destructive' as const
        case 'feature_request':
            return 'info' as const
        default:
            return 'secondary' as const
    }
}

export default function BugReportDetailPage() {
    const params = useParams()
    const id = params.id as string
    const locale = useLocale()
    const t = useTranslations('platform.bugReports.detail')

    const [report, setReport] = useState<BugReport | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [adminNotes, setAdminNotes] = useState('')
    const [isSaving, setIsSaving] = useState(false)

    useEffect(() => {
        const fetchReport = async () => {
            try {
                setIsLoading(true)
                const data = await apiClient.get<BugReport>(`/api/v1/platform/bug-reports/${id}`)
                setReport(data)
                setAdminNotes(data.admin_notes ?? '')
            } catch {
                setError('Failed to load bug report')
            } finally {
                setIsLoading(false)
            }
        }

        if (id) fetchReport()
    }, [id])

    const handleSaveNotes = async () => {
        try {
            setIsSaving(true)
            await apiClient.patch(`/api/v1/platform/bug-reports/${id}`, { admin_notes: adminNotes })
            toast.success(t('saved'))
        } catch {
            toast.error(t('saveFailed'))
        } finally {
            setIsSaving(false)
        }
    }

    if (isLoading) {
        return (
            <div className="p-8">
                <Loader2 className="animate-spin" />
            </div>
        )
    }

    if (error || !report) {
        return (
            <div className="p-8 space-y-4">
                <p className="text-destructive">{error ?? 'Report not found'}</p>
                <Link href={`/${locale}/platform/bug-reports`}>
                    <Button variant="ghost">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        {t('back')}
                    </Button>
                </Link>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <Link href={`/${locale}/platform/bug-reports`}>
                <Button variant="ghost">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    {t('back')}
                </Button>
            </Link>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-2xl">{report.title}</CardTitle>
                        <div className="flex gap-2">
                            <Badge variant={categoryVariant(report.category)}>
                                {report.category}
                            </Badge>
                            <Badge variant={statusVariant(report.status)}>
                                {report.status}
                            </Badge>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div>
                        <Label className="text-muted-foreground">{t('description')}</Label>
                        <p className="mt-1 whitespace-pre-wrap">{report.description}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label className="text-muted-foreground">{t('reporter')}</Label>
                            <p className="mt-1 text-sm font-mono">{report.reporter_profile_id}</p>
                        </div>
                        <div>
                            <Label className="text-muted-foreground">{t('organization')}</Label>
                            <p className="mt-1 text-sm font-mono">{report.organization_id}</p>
                        </div>
                        <div>
                            <Label className="text-muted-foreground">{t('category')}</Label>
                            <p className="mt-1 text-sm">{report.category}</p>
                        </div>
                        <div>
                            <Label className="text-muted-foreground">{t('status')}</Label>
                            <p className="mt-1 text-sm">{report.status}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label className="text-muted-foreground">Created</Label>
                            <p className="mt-1 text-sm">{new Date(report.created_at).toLocaleString()}</p>
                        </div>
                        <div>
                            <Label className="text-muted-foreground">Updated</Label>
                            <p className="mt-1 text-sm">{new Date(report.updated_at).toLocaleString()}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>{t('adminNotes')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Textarea
                        value={adminNotes}
                        onChange={(e) => setAdminNotes(e.target.value)}
                        rows={6}
                        placeholder={t('adminNotesPlaceholder')}
                    />
                    <Button onClick={handleSaveNotes} disabled={isSaving}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {t('save')}
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}
