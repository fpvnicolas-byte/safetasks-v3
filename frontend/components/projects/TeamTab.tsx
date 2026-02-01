'use client'

import { useStakeholders } from '@/lib/api/hooks/useStakeholders'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Plus, Edit, Trash2, Users } from 'lucide-react'
import { LocaleLink } from '@/components/LocaleLink'
import { useDeleteStakeholder } from '@/lib/api/hooks/useStakeholders'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { StakeholderStatusBadge } from '@/components/stakeholders/StakeholderStatusBadge'

interface TeamTabProps {
    projectId: string
}

export function TeamTab({ projectId }: TeamTabProps) {
    const t = useTranslations('projects.details.team')
    const tCommon = useTranslations('common')
    const tFeedback = useTranslations('common.feedback')
    const tTable = useTranslations('stakeholders.table')

    const { data: stakeholders, isLoading } = useStakeholders(projectId)
    const deleteStakeholder = useDeleteStakeholder()

    const handleDelete = async (id: string) => {
        if (!confirm(tFeedback('confirmDelete'))) return

        try {
            await deleteStakeholder.mutateAsync(id)
            toast.success(tFeedback('actionSuccess'))
        } catch (error: unknown) {
            toast.error(tFeedback('actionError', { message: 'Failed to delete stakeholder' }))
            console.error('Delete error:', error)
        }
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <CardTitle className="flex items-center gap-2">
                                <Users className="h-5 w-5" />
                                {t('title')}
                            </CardTitle>
                            <CardDescription>
                                {t('description')}
                            </CardDescription>
                        </div>
                        <Button asChild>
                            <LocaleLink href={`/stakeholders/new?project_id=${projectId}`}>
                                <Plus className="mr-2 h-4 w-4" />
                                {t('addMember')}
                            </LocaleLink>
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="text-center py-8 text-muted-foreground">{tCommon('loading')}</div>
                    ) : stakeholders && stakeholders.length > 0 ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>{tTable('headers.name')}</TableHead>
                                    <TableHead>{tTable('headers.role')}</TableHead>
                                    <TableHead>{tTable('headers.status')}</TableHead>
                                    <TableHead>{tTable('headers.email')}</TableHead>
                                    <TableHead>{tTable('headers.phone')}</TableHead>
                                    <TableHead className="text-right">{tTable('headers.actions')}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {stakeholders.map((stakeholder) => (
                                    <TableRow key={stakeholder.id}>
                                        <TableCell className="font-medium">{stakeholder.name}</TableCell>
                                        <TableCell>{stakeholder.role}</TableCell>
                                        <TableCell>
                                            <StakeholderStatusBadge status={stakeholder.status || 'requested'} />
                                        </TableCell>
                                        <TableCell>{stakeholder.email || '-'}</TableCell>
                                        <TableCell>{stakeholder.phone || '-'}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button variant="ghost" size="icon" asChild>
                                                    <LocaleLink href={`/stakeholders/${stakeholder.id}`}>
                                                        <Edit className="h-4 w-4" />
                                                    </LocaleLink>
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleDelete(stakeholder.id)}
                                                    disabled={deleteStakeholder.isPending}
                                                >
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <div className="text-center py-12">
                            <p className="text-muted-foreground mb-4">{t('empty')}</p>
                            <Button asChild variant="outline">
                                <LocaleLink href={`/stakeholders/new?project_id=${projectId}`}>
                                    <Plus className="mr-2 h-4 w-4" />
                                    {t('addMember')}
                                </LocaleLink>
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
