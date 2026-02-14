'use client'

import { useMemo, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useContacts } from '@/lib/api/hooks/useContacts'
import {
  useCreateStakeholder,
  useDeleteStakeholder,
  useStakeholders,
  useUpdateStakeholder,
} from '@/lib/api/hooks/useStakeholders'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Edit, Trash2, Users } from 'lucide-react'
import { LocaleLink } from '@/components/LocaleLink'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { StakeholderStatusBadge } from '@/components/stakeholders/StakeholderStatusBadge'
import type { Stakeholder, RateType } from '@/types'

interface TeamTabProps {
  projectId: string
}

export function TeamTab({ projectId }: TeamTabProps) {
  const t = useTranslations('projects.details.team')
  const tCommon = useTranslations('common')
  const tFeedback = useTranslations('common.feedback')
  const tTable = useTranslations('stakeholders.table')
  const { profile } = useAuth()
  const effectiveRole = profile?.effective_role || profile?.role_v2 || ''
  const canManageTeam = ['owner', 'admin', 'producer'].includes(effectiveRole)

  const { data: stakeholders, isLoading } = useStakeholders(projectId)
  const { data: contacts } = useContacts({ active_only: true }, { enabled: canManageTeam })

  const createStakeholder = useCreateStakeholder()
  const updateStakeholder = useUpdateStakeholder()
  const deleteStakeholder = useDeleteStakeholder()

  const activeContacts = useMemo(
    () => (contacts || []).filter((contact) => contact.is_active),
    [contacts],
  )

  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [selectedSupplierId, setSelectedSupplierId] = useState('')
  const [newRole, setNewRole] = useState('')
  const [newRateType, setNewRateType] = useState('')
  const [newRateValue, setNewRateValue] = useState('')

  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingStakeholder, setEditingStakeholder] = useState<Stakeholder | null>(null)
  const [editRole, setEditRole] = useState('')
  const [editRateType, setEditRateType] = useState('')
  const [editRateValue, setEditRateValue] = useState('')

  const resetAddForm = () => {
    setSelectedSupplierId('')
    setNewRole('')
    setNewRateType('')
    setNewRateValue('')
  }

  const openEditDialog = (stakeholder: Stakeholder) => {
    setEditingStakeholder(stakeholder)
    setEditRole(stakeholder.role || '')
    setEditRateType(stakeholder.rate_type || '')
    setEditRateValue(stakeholder.rate_value_cents ? (stakeholder.rate_value_cents / 100).toString() : '')
    setEditDialogOpen(true)
  }

  const closeEditDialog = () => {
    setEditDialogOpen(false)
    setEditingStakeholder(null)
    setEditRole('')
    setEditRateType('')
    setEditRateValue('')
  }

  const parseRateToCents = (value: string): number | null => {
    if (!value) return null
    const parsed = Number.parseFloat(value)
    if (Number.isNaN(parsed) || parsed < 0) {
      return NaN
    }
    return Math.round(parsed * 100)
  }

  const handleAddMember = async () => {
    const selectedContact = activeContacts.find((contact) => contact.id === selectedSupplierId)
    if (!selectedContact || !newRole.trim()) return

    const rateValueCents = parseRateToCents(newRateValue)
    if (Number.isNaN(rateValueCents)) {
      toast.error(t('invalidRateValue'))
      return
    }

    try {
      await createStakeholder.mutateAsync({
        project_id: projectId,
        supplier_id: selectedContact.id,
        name: selectedContact.name,
        role: newRole.trim(),
        email: selectedContact.email || undefined,
        phone: selectedContact.phone || undefined,
        rate_type: newRateType ? (newRateType as RateType) : undefined,
        rate_value_cents: rateValueCents === null ? undefined : rateValueCents,
      })
      toast.success(t('addSuccess'))
      setAddDialogOpen(false)
      resetAddForm()
    } catch (error: unknown) {
      toast.error((error as { message?: string })?.message || t('addError'))
    }
  }

  const handleEditMember = async () => {
    if (!editingStakeholder || !editRole.trim()) return

    const rateValueCents = parseRateToCents(editRateValue)
    if (Number.isNaN(rateValueCents)) {
      toast.error(t('invalidRateValue'))
      return
    }

    try {
      await updateStakeholder.mutateAsync({
        stakeholderId: editingStakeholder.id,
        data: {
          role: editRole.trim(),
          rate_type: editRateType ? (editRateType as RateType) : null,
          rate_value_cents: rateValueCents,
        },
      })
      toast.success(t('editSuccess'))
      closeEditDialog()
    } catch (error: unknown) {
      toast.error((error as { message?: string })?.message || t('editError'))
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm(tFeedback('confirmDelete'))) return

    try {
      await deleteStakeholder.mutateAsync(id)
      toast.success(tFeedback('actionSuccess'))
    } catch (error: unknown) {
      toast.error((error as { message?: string })?.message || t('deleteError'))
      console.error('Delete error:', error)
    }
  }

  return (
    <div className="space-y-6">
      <Dialog open={addDialogOpen} onOpenChange={(open) => {
        setAddDialogOpen(open)
        if (!open) resetAddForm()
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('addDialog.title')}</DialogTitle>
            <DialogDescription>{t('addDialog.description')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('addDialog.contact')}</Label>
              <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('addDialog.contactPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {activeContacts.map((contact) => (
                    <SelectItem key={contact.id} value={contact.id}>
                      {contact.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('addDialog.role')}</Label>
              <Input
                value={newRole}
                onChange={(event) => setNewRole(event.target.value)}
                placeholder={t('addDialog.rolePlaceholder')}
              />
            </div>

            <div className="grid gap-4 grid-cols-2">
              <div className="space-y-2">
                <Label>{t('addDialog.rateType')}</Label>
                <Select value={newRateType} onValueChange={setNewRateType}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('addDialog.rateTypePlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">{t('addDialog.daily')}</SelectItem>
                    <SelectItem value="hourly">{t('addDialog.hourly')}</SelectItem>
                    <SelectItem value="fixed">{t('addDialog.fixed')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('addDialog.rateValue')}</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newRateValue}
                  onChange={(event) => setNewRateValue(event.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>

            {activeContacts.length === 0 && (
              <p className="text-sm text-muted-foreground">{t('noContactsDescription')}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button
              onClick={handleAddMember}
              disabled={!selectedSupplierId || !newRole.trim() || createStakeholder.isPending}
            >
              {createStakeholder.isPending ? t('addDialog.adding') : t('addDialog.submit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={(open) => {
        setEditDialogOpen(open)
        if (!open) closeEditDialog()
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('editDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('editDialog.description', { name: editingStakeholder?.name || '' })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('editDialog.role')}</Label>
              <Input
                value={editRole}
                onChange={(event) => setEditRole(event.target.value)}
                placeholder={t('editDialog.rolePlaceholder')}
              />
            </div>

            <div className="grid gap-4 grid-cols-2">
              <div className="space-y-2">
                <Label>{t('editDialog.rateType')}</Label>
                <Select value={editRateType} onValueChange={setEditRateType}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('editDialog.rateTypePlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">{t('editDialog.daily')}</SelectItem>
                    <SelectItem value="hourly">{t('editDialog.hourly')}</SelectItem>
                    <SelectItem value="fixed">{t('editDialog.fixed')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('editDialog.rateValue')}</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editRateValue}
                  onChange={(event) => setEditRateValue(event.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeEditDialog}>
              {tCommon('cancel')}
            </Button>
            <Button
              onClick={handleEditMember}
              disabled={!editRole.trim() || updateStakeholder.isPending}
            >
              {updateStakeholder.isPending ? t('editDialog.saving') : t('editDialog.submit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            {canManageTeam && activeContacts.length > 0 ? (
              <Button onClick={() => setAddDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                {t('addMember')}
              </Button>
            ) : canManageTeam ? (
              <Button asChild>
                <LocaleLink href="/contacts/new">
                  <Plus className="mr-2 h-4 w-4" />
                  {t('goToContacts')}
                </LocaleLink>
              </Button>
            ) : null}
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
                  {canManageTeam && (
                    <TableHead className="text-right">{tTable('headers.actions')}</TableHead>
                  )}
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
                    {canManageTeam && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(stakeholder)}>
                            <Edit className="h-4 w-4" />
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
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 space-y-4">
              <p className="text-muted-foreground">{t('empty')}</p>
              {canManageTeam && activeContacts.length > 0 ? (
                <Button variant="outline" onClick={() => setAddDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  {t('addMember')}
                </Button>
              ) : canManageTeam ? (
                <Button asChild variant="outline">
                  <LocaleLink href="/contacts/new">
                    <Plus className="mr-2 h-4 w-4" />
                    {t('goToContacts')}
                  </LocaleLink>
                </Button>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
