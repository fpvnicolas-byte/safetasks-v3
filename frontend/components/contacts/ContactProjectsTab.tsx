'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Plus, FolderOpen } from 'lucide-react'
import { toast } from 'sonner'
import { useLocale, useTranslations } from 'next-intl'
import { LocaleLink } from '@/components/LocaleLink'
import type { ContactDetail } from '@/types'
import { StakeholderStatusBadge } from '@/components/stakeholders/StakeholderStatusBadge'
import { formatCurrency } from '@/types'
import { AssignToProjectDialog } from '@/components/contacts/AssignToProjectDialog'
import { useDeleteProjectAssignment } from '@/lib/api/hooks'

interface ContactProjectsTabProps {
  contact: ContactDetail
}

export function ContactProjectsTab({ contact }: ContactProjectsTabProps) {
  const t = useTranslations('contacts.projects')
  const locale = useLocale()
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const deleteProjectAssignment = useDeleteProjectAssignment()
  const isFreelancerMode = contact.team_info?.effective_role === 'freelancer'
  const stakeholderAssignments = contact.assignments || []
  const projectAccessAssignments = contact.project_access_assignments || []

  const formatDate = (value: string | null) => {
    if (!value) return '-'
    return new Date(value).toLocaleDateString(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  const handleRemoveAccess = async (assignmentId: string) => {
    try {
      await deleteProjectAssignment.mutateAsync(assignmentId)
      toast.success(t('accessRemoved'))
    } catch (err: unknown) {
      toast.error((err as { message?: string })?.message || t('accessRemoveError'))
    }
  }

  return (
    <div className="space-y-6 mt-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5" />
                {isFreelancerMode ? t('projectAccessTitle') : t('title')}
              </CardTitle>
              <CardDescription>
                {isFreelancerMode ? t('projectAccessDescription') : t('description')}
              </CardDescription>
            </div>
            <Button onClick={() => setAssignDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {t('assignToProject')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isFreelancerMode ? (
            projectAccessAssignments.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('table.project')}</TableHead>
                    <TableHead>{t('table.assignedAt')}</TableHead>
                    <TableHead className="text-right">{t('table.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projectAccessAssignments.map((assignment) => (
                    <TableRow key={assignment.id}>
                      <TableCell className="font-medium">
                        <LocaleLink
                          href={`/projects/${assignment.project_id}`}
                          className="hover:underline"
                        >
                          {assignment.project_title}
                        </LocaleLink>
                      </TableCell>
                      <TableCell>{formatDate(assignment.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          disabled={deleteProjectAssignment.isPending}
                          onClick={() => handleRemoveAccess(assignment.id)}
                        >
                          {t('removeProjectAccess')}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">{t('noProjectAccess')}</p>
                <Button variant="outline" onClick={() => setAssignDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  {t('assignToProject')}
                </Button>
              </div>
            )
          ) : stakeholderAssignments.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('table.project')}</TableHead>
                  <TableHead>{t('table.role')}</TableHead>
                  <TableHead>{t('table.status')}</TableHead>
                  <TableHead>{t('table.rate')}</TableHead>
                  <TableHead>{t('table.bookingDates')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stakeholderAssignments.map((assignment) => (
                  <TableRow key={assignment.id}>
                    <TableCell className="font-medium">
                      <LocaleLink
                        href={`/projects/${assignment.project_id}`}
                        className="hover:underline"
                      >
                        {assignment.project_title}
                      </LocaleLink>
                    </TableCell>
                    <TableCell>{assignment.role}</TableCell>
                    <TableCell>
                      <StakeholderStatusBadge status={assignment.status || 'requested'} />
                    </TableCell>
                    <TableCell>
                      {assignment.rate_value_cents
                        ? `${formatCurrency(assignment.rate_value_cents)} / ${assignment.rate_type || 'fixed'}`
                        : '-'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {assignment.booking_start_date && assignment.booking_end_date
                        ? `${assignment.booking_start_date} - ${assignment.booking_end_date}`
                        : assignment.booking_start_date || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">{t('noAssignments')}</p>
              <Button variant="outline" onClick={() => setAssignDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                {t('assignToProject')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {isFreelancerMode && stakeholderAssignments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('workAssignmentsTitle')}</CardTitle>
            <CardDescription>{t('workAssignmentsDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('table.project')}</TableHead>
                  <TableHead>{t('table.role')}</TableHead>
                  <TableHead>{t('table.status')}</TableHead>
                  <TableHead>{t('table.rate')}</TableHead>
                  <TableHead>{t('table.bookingDates')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stakeholderAssignments.map((assignment) => (
                  <TableRow key={assignment.id}>
                    <TableCell className="font-medium">
                      <LocaleLink
                        href={`/projects/${assignment.project_id}`}
                        className="hover:underline"
                      >
                        {assignment.project_title}
                      </LocaleLink>
                    </TableCell>
                    <TableCell>{assignment.role}</TableCell>
                    <TableCell>
                      <StakeholderStatusBadge status={assignment.status || 'requested'} />
                    </TableCell>
                    <TableCell>
                      {assignment.rate_value_cents
                        ? `${formatCurrency(assignment.rate_value_cents)} / ${assignment.rate_type || 'fixed'}`
                        : '-'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {assignment.booking_start_date && assignment.booking_end_date
                        ? `${assignment.booking_start_date} - ${assignment.booking_end_date}`
                        : assignment.booking_start_date || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <AssignToProjectDialog
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
        supplierId={contact.id}
        supplierName={contact.name}
        mode={isFreelancerMode ? 'project_access' : 'stakeholder'}
        profileId={contact.team_info?.profile_id}
      />
    </div>
  )
}
