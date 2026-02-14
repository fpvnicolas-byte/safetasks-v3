'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import {
  useProjects,
  useCreateStakeholder,
  useCreateProjectAssignment,
} from '@/lib/api/hooks'
import { useAuth } from '@/contexts/AuthContext'

type AssignMode = 'stakeholder' | 'project_access'

interface AssignToProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  supplierId: string
  supplierName: string
  mode: AssignMode
  profileId?: string | null
}

export function AssignToProjectDialog({
  open,
  onOpenChange,
  supplierId,
  supplierName,
  mode,
  profileId,
}: AssignToProjectDialogProps) {
  const t = useTranslations('contacts.assignDialog')
  const { organizationId } = useAuth()
  const { data: projects } = useProjects(organizationId || undefined)
  const createStakeholder = useCreateStakeholder()
  const createProjectAssignment = useCreateProjectAssignment()

  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [role, setRole] = useState('')
  const [rateType, setRateType] = useState<string>('')
  const [rateValue, setRateValue] = useState('')
  const isStakeholderMode = mode === 'stakeholder'
  const isSubmitting = isStakeholderMode
    ? createStakeholder.isPending
    : createProjectAssignment.isPending

  const resetForm = () => {
    setSelectedProjectId('')
    setRole('')
    setRateType('')
    setRateValue('')
  }

  const getErrorMessage = (err: unknown): string => {
    const status = (err as { statusCode?: number })?.statusCode
    if (status === 400) {
      return isStakeholderMode ? t('errors.stakeholder400') : t('errors.projectAccess400')
    }
    if (status === 403) {
      return t('errors.forbidden')
    }
    if (status === 409) {
      return isStakeholderMode ? t('errors.stakeholder409') : t('errors.projectAccess409')
    }
    return (err as { message?: string })?.message || t('errors.generic')
  }

  const handleAssign = async () => {
    if (!selectedProjectId) return
    if (isStakeholderMode && !role.trim()) return

    try {
      if (isStakeholderMode) {
        await createStakeholder.mutateAsync({
          project_id: selectedProjectId,
          supplier_id: supplierId,
          name: supplierName,
          role: role.trim(),
          rate_type: rateType ? (rateType as 'daily' | 'hourly' | 'fixed') : undefined,
          rate_value_cents: rateValue ? Math.round(parseFloat(rateValue) * 100) : undefined,
        })
        toast.success(t('success.stakeholder'))
      } else {
        if (!profileId) {
          toast.error(t('errors.missingProfile'))
          return
        }
        await createProjectAssignment.mutateAsync({
          project_id: selectedProjectId,
          user_id: profileId,
        })
        toast.success(t('success.projectAccess'))
      }
      resetForm()
      onOpenChange(false)
    } catch (err: unknown) {
      toast.error(getErrorMessage(err))
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); onOpenChange(o) }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isStakeholderMode ? t('title.stakeholder') : t('title.projectAccess')}
          </DialogTitle>
          <DialogDescription>
            {isStakeholderMode
              ? t('description.stakeholder', { name: supplierName })
              : t('description.projectAccess', { name: supplierName })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t('selectProject')}</Label>
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger>
                <SelectValue placeholder={t('projectPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {projects?.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {projects && projects.length === 0 && (
              <p className="text-sm text-muted-foreground">{t('noProjects')}</p>
            )}
          </div>

          {isStakeholderMode && (
            <>
              <div className="space-y-2">
                <Label>{t('role')}</Label>
                <Input
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder={t('rolePlaceholder')}
                />
              </div>

              <div className="grid gap-4 grid-cols-2">
                <div className="space-y-2">
                  <Label>{t('rateType')}</Label>
                  <Select value={rateType} onValueChange={setRateType}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('rateTypePlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">{t('daily')}</SelectItem>
                      <SelectItem value="hourly">{t('hourly')}</SelectItem>
                      <SelectItem value="fixed">{t('fixed')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('rateValue')}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={rateValue}
                    onChange={(e) => setRateValue(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { resetForm(); onOpenChange(false) }}>
            {t('cancel')}
          </Button>
          <Button
            onClick={handleAssign}
            disabled={
              !selectedProjectId
              || (isStakeholderMode && !role.trim())
              || isSubmitting
            }
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSubmitting ? t('assigning') : t('assign')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
