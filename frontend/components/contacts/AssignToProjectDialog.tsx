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
import { useProjects, useCreateStakeholder } from '@/lib/api/hooks'
import { useAuth } from '@/contexts/AuthContext'

interface AssignToProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  supplierId: string
  supplierName: string
}

export function AssignToProjectDialog({
  open,
  onOpenChange,
  supplierId,
  supplierName,
}: AssignToProjectDialogProps) {
  const t = useTranslations('contacts.detail')
  const { organizationId } = useAuth()
  const { data: projects } = useProjects()
  const createStakeholder = useCreateStakeholder()

  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [role, setRole] = useState('')
  const [rateType, setRateType] = useState<string>('')
  const [rateValue, setRateValue] = useState('')

  const resetForm = () => {
    setSelectedProjectId('')
    setRole('')
    setRateType('')
    setRateValue('')
  }

  const handleAssign = async () => {
    if (!selectedProjectId || !role) return

    try {
      await createStakeholder.mutateAsync({
        project_id: selectedProjectId,
        supplier_id: supplierId,
        name: supplierName,
        role,
        rate_type: rateType ? (rateType as 'daily' | 'hourly' | 'fixed') : undefined,
        rate_value_cents: rateValue ? Math.round(parseFloat(rateValue) * 100) : undefined,
      })
      toast.success(t('assignmentCreated'))
      resetForm()
      onOpenChange(false)
    } catch (err: unknown) {
      toast.error(err?.message || t('assignmentError'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); onOpenChange(o) }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('assignToProjectTitle')}</DialogTitle>
          <DialogDescription>
            {t('assignToProjectDescription', { name: supplierName })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t('selectProject')}</Label>
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger>
                <SelectValue placeholder={t('selectProjectPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {projects?.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t('roleLabel')}</Label>
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { resetForm(); onOpenChange(false) }}>
            {t('cancel')}
          </Button>
          <Button
            onClick={handleAssign}
            disabled={!selectedProjectId || !role || createStakeholder.isPending}
          >
            {createStakeholder.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('assign')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
