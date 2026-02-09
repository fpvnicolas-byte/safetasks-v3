'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Plus, FolderOpen } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { LocaleLink } from '@/components/LocaleLink'
import type { ContactDetail } from '@/types'
import { StakeholderStatusBadge } from '@/components/stakeholders/StakeholderStatusBadge'
import { formatCurrency } from '@/types'
import { AssignToProjectDialog } from '@/components/contacts/AssignToProjectDialog'

interface ContactProjectsTabProps {
  contact: ContactDetail
}

export function ContactProjectsTab({ contact }: ContactProjectsTabProps) {
  const t = useTranslations('contacts.detail')
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)

  return (
    <div className="space-y-6 mt-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5" />
                {t('projectAssignments')}
              </CardTitle>
              <CardDescription>{t('projectAssignmentsDescription')}</CardDescription>
            </div>
            <Button onClick={() => setAssignDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {t('assignToProject')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {contact.assignments && contact.assignments.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('project')}</TableHead>
                  <TableHead>{t('role')}</TableHead>
                  <TableHead>{t('status')}</TableHead>
                  <TableHead>{t('rate')}</TableHead>
                  <TableHead>{t('dates')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contact.assignments.map((assignment) => (
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

      <AssignToProjectDialog
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
        supplierId={contact.id}
        supplierName={contact.name}
      />
    </div>
  )
}
