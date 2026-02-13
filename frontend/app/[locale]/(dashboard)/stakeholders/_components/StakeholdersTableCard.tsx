'use client'

import Link from 'next/link'
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
import { Plus, Edit, Trash2, DollarSign } from 'lucide-react'
import { StakeholderStatusBadge } from '@/components/stakeholders/StakeholderStatusBadge'
import type { Project, Stakeholder } from '@/types'
import { useTranslations } from 'next-intl'

interface StakeholdersTableCardProps {
  stakeholders: Stakeholder[] | undefined
  isLoading: boolean
  isDeleting: boolean
  projects: Project[] | undefined
  onDelete: (target: { id: string; name: string }) => void
}

export function StakeholdersTableCard({
  stakeholders,
  isLoading,
  isDeleting,
  projects,
  onDelete,
}: StakeholdersTableCardProps) {
  const t = useTranslations('stakeholders')

  const getProjectName = (projectId: string) => {
    return projects?.find((project) => project.id === projectId)?.title || t('table.unknownProject')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('table.title')}</CardTitle>
        <CardDescription>
          {t('table.count', { count: stakeholders?.length || 0 })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">{t('table.loading')}</div>
        ) : stakeholders && stakeholders.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('table.headers.name')}</TableHead>
                <TableHead>{t('table.headers.role')}</TableHead>
                <TableHead>{t('table.headers.status')}</TableHead>
                <TableHead>{t('table.headers.project')}</TableHead>
                <TableHead>{t('table.headers.email')}</TableHead>
                <TableHead>{t('table.headers.phone')}</TableHead>
                <TableHead className="text-right">{t('table.headers.actions')}</TableHead>
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
                  <TableCell>
                    <Link
                      href={`/projects/${stakeholder.project_id}`}
                      className="text-info hover:underline"
                    >
                      {getProjectName(stakeholder.project_id)}
                    </Link>
                  </TableCell>
                  <TableCell>{stakeholder.email || '-'}</TableCell>
                  <TableCell>{stakeholder.phone || '-'}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" asChild>
                        <Link href={`/stakeholders/${stakeholder.id}`}>
                          <Edit className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button variant="ghost" size="icon" asChild title={t('table.addPayment')}>
                        <Link href={`/financials/transactions/new?project_id=${stakeholder.project_id}&stakeholder_id=${stakeholder.id}`}>
                          <DollarSign className="h-4 w-4 text-success" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDelete({ id: stakeholder.id, name: stakeholder.name })}
                        disabled={isDeleting}
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
            <p className="text-muted-foreground mb-4">{t('empty.noStakeholders')}</p>
            <Button asChild>
              <Link href="/stakeholders/new">
                <Plus className="mr-2 h-4 w-4" />
                {t('empty.addFirst')}
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
