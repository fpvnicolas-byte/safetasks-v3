'use client'

import { useMemo, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useLocale, useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Loader2, Shield, UserPlus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import {
  useCreateProjectAssignment,
  useDeleteProjectAssignment,
  useProjectAssignments,
  useTeamMembers,
  type ProjectAssignment,
  type TeamMember,
} from '@/lib/api/hooks'
import type { ApiError } from '@/types'

interface ProjectAssignmentsCardProps {
  projectId: string
}

export function ProjectAssignmentsCard({ projectId }: ProjectAssignmentsCardProps) {
  const t = useTranslations('projectAssignments')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const { organizationId, profile } = useAuth()

  const effectiveRole = profile?.effective_role || ''
  const canManage =
    profile?.is_master_owner === true ||
    effectiveRole === 'owner' ||
    effectiveRole === 'admin' ||
    effectiveRole === 'producer'

  const [assignOpen, setAssignOpen] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState('')

  const { data: members, isLoading: membersLoading } = useTeamMembers(
    canManage ? (organizationId || undefined) : undefined
  )
  const { data: assignments, isLoading: assignmentsLoading } = useProjectAssignments(
    canManage ? projectId : undefined
  )
  const createAssignment = useCreateProjectAssignment()
  const deleteAssignment = useDeleteProjectAssignment()
  const membersById = useMemo(() => {
    return new Map((members || []).map((m) => [m.id, m]))
  }, [members])

  const freelancerMembers = useMemo(() => {
    return (members || []).filter((m) => m.effective_role === 'freelancer')
  }, [members])

  const assignedUserIds = useMemo(() => {
    return new Set((assignments || []).map((a) => a.user_id))
  }, [assignments])

  const availableFreelancers = useMemo(() => {
    return freelancerMembers.filter((m) => !assignedUserIds.has(m.id))
  }, [freelancerMembers, assignedUserIds])

  const rows = useMemo(() => {
    const list = (assignments || []).slice()
    list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    return list.map((assignment) => ({
      assignment,
      member: membersById.get(assignment.user_id) || null,
    }))
  }, [assignments, membersById])

  const resetAssignDialog = () => {
    setAssignOpen(false)
    setSelectedUserId('')
  }

  const handleAssign = async () => {
    if (!selectedUserId) return
    try {
      await createAssignment.mutateAsync({
        project_id: projectId,
        user_id: selectedUserId,
      })
      toast.success(t('toast.assigned'))
      resetAssignDialog()
    } catch (err: unknown) {
      const status = (err as Partial<ApiError>)?.statusCode
      const message = (err as Partial<ApiError>)?.message
      if (status === 409) {
        toast.error(t('errors.alreadyAssigned'))
      } else {
        toast.error(message || t('errors.assignFailed'))
      }
    }
  }

  const handleRemove = async (assignment: ProjectAssignment, member: TeamMember | null) => {
    const name = member?.full_name || member?.email || assignment.user_id
    if (!confirm(t('confirmRemove', { name }))) return
    try {
      await deleteAssignment.mutateAsync(assignment.id)
      toast.success(t('toast.removed'))
    } catch (err: unknown) {
      const message = (err as Partial<ApiError>)?.message
      toast.error(message || t('errors.removeFailed'))
    }
  }

  if (!canManage) return null

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                {t('title')}
                {!assignmentsLoading && (
                  <Badge variant="secondary" className="ml-2">
                    {assignments?.length || 0}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>{t('description')}</CardDescription>
            </div>

            <Button
              onClick={() => setAssignOpen(true)}
              disabled={membersLoading || assignmentsLoading || availableFreelancers.length === 0}
            >
              <UserPlus className="mr-2 h-4 w-4" />
              {t('assignFreelancer')}
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {membersLoading || assignmentsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('table.headers.name')}</TableHead>
                  <TableHead>{t('table.headers.email')}</TableHead>
                  <TableHead>{t('table.headers.assignedAt')}</TableHead>
                  <TableHead className="text-right">{t('table.headers.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ assignment, member }) => {
                  const displayName = member?.full_name || member?.email || assignment.user_id
                  const displayEmail = member?.email || '-'
                  return (
                    <TableRow key={assignment.id}>
                      <TableCell className="font-medium">{displayName}</TableCell>
                      <TableCell>{displayEmail}</TableCell>
                      <TableCell>
                        {new Date(assignment.created_at).toLocaleDateString(locale, {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleRemove(assignment, member)}
                          disabled={deleteAssignment.isPending}
                        >
                          {t('remove')}
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">{t('empty')}</p>
              <Button
                variant="outline"
                onClick={() => setAssignOpen(true)}
                disabled={availableFreelancers.length === 0}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                {t('assignFreelancer')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={assignOpen}
        onOpenChange={(open) => {
          if (!open) setSelectedUserId('')
          setAssignOpen(open)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('modalTitle')}</DialogTitle>
            <DialogDescription>{t('modalDescription')}</DialogDescription>
          </DialogHeader>

          {membersLoading || assignmentsLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : availableFreelancers.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noAvailableFreelancers')}</p>
          ) : (
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger>
                <SelectValue placeholder={t('selectPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {availableFreelancers.map((m) => {
                  const label = m.full_name ? `${m.full_name} (${m.email})` : m.email
                  return (
                    <SelectItem key={m.id} value={m.id}>
                      {label}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={resetAssignDialog}>
              {tCommon('cancel')}
            </Button>
            <Button
              onClick={handleAssign}
              disabled={availableFreelancers.length === 0 || !selectedUserId || createAssignment.isPending}
            >
              {createAssignment.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('assign')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
