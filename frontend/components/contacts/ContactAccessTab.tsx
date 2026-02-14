'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'
import {
  Shield,
  UserPlus,
  RotateCw,
  XCircle,
  Copy,
  Check,
  Loader2,
  Crown,
} from 'lucide-react'
import { toast } from 'sonner'
import { useLocale, useTranslations } from 'next-intl'
import { useAuth } from '@/contexts/AuthContext'
import {
  useChangeRole,
  useRemoveMember,
  useCreateInvite,
  useRevokeInvite,
  useResendInvite,
} from '@/lib/api/hooks'
import type { ContactDetail } from '@/types'

const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  admin: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  producer: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  finance: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  freelancer: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
}

function getRolesCanInvite(effectiveRole: string): string[] {
  switch (effectiveRole) {
    case 'owner':
      return ['admin', 'producer', 'finance', 'freelancer']
    case 'admin':
      return ['producer', 'finance', 'freelancer']
    case 'producer':
      return ['freelancer']
    default:
      return []
  }
}

function canRemoveTarget(
  effectiveRole: string,
  targetRole: string,
  targetIsMasterOwner: boolean,
  targetProfileId: string,
  currentProfileId?: string,
) {
  if (targetProfileId === currentProfileId) return false
  if (targetIsMasterOwner) return false
  if (effectiveRole === 'owner') return true
  if (effectiveRole === 'admin') return ['producer', 'finance', 'freelancer'].includes(targetRole)
  if (effectiveRole === 'producer') return targetRole === 'freelancer'
  return false
}

interface ContactAccessTabProps {
  contact: ContactDetail
}

export function ContactAccessTab({ contact }: ContactAccessTabProps) {
  const tAccess = useTranslations('contacts.access')
  const locale = useLocale()
  const { profile } = useAuth()
  const effectiveRole = profile?.effective_role || ''

  const changeRole = useChangeRole()
  const removeMember = useRemoveMember()
  const createInvite = useCreateInvite()
  const revokeInvite = useRevokeInvite()
  const resendInvite = useResendInvite()

  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)
  const [inviteLink, setInviteLink] = useState('')
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const invitableRoles = useMemo(() => getRolesCanInvite(effectiveRole), [effectiveRole])
  const [selectedRole, setSelectedRole] = useState(invitableRoles[0] || '')
  useEffect(() => {
    if (invitableRoles.length === 0) {
      setSelectedRole('')
      return
    }
    if (!invitableRoles.includes(selectedRole)) {
      setSelectedRole(invitableRoles[0])
    }
  }, [invitableRoles, selectedRole])

  const hasTeamAccess = !!contact.team_info
  const hasPendingInvite = !!contact.pending_invite
  const canManageInvites = invitableRoles.length > 0

  const getRoleLabel = (role: string) => {
    const key = `roles.${role}`
    const translated = tAccess(key)
    return translated === key ? role : translated
  }

  const canChangeRole =
    effectiveRole === 'owner'
    && !!contact.team_info
    && !contact.team_info.is_master_owner
    && contact.team_info.profile_id !== profile?.id

  const canRemoveAccess =
    !!contact.team_info
    && canRemoveTarget(
      effectiveRole,
      contact.team_info.effective_role,
      contact.team_info.is_master_owner,
      contact.team_info.profile_id,
      profile?.id,
    )

  const formatDate = (value: string | null) => {
    if (!value) return '-'
    return new Date(value).toLocaleDateString(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  const handleChangeRole = async (newRole: string) => {
    if (!contact.team_info) return
    try {
      await changeRole.mutateAsync({ profileId: contact.team_info.profile_id, role_v2: newRole })
      toast.success(tAccess('roleChanged'))
    } catch (err: unknown) {
      toast.error((err as { message?: string })?.message || tAccess('roleChangeError'))
    }
  }

  const handleRemoveAccess = async () => {
    if (!contact.team_info) return
    setIsRemoving(true)
    try {
      await removeMember.mutateAsync(contact.team_info.profile_id)
      setRemoveConfirmOpen(false)
      toast.success(tAccess('accessRemoved'))
    } catch (err: unknown) {
      toast.error((err as { message?: string })?.message || tAccess('removeError'))
    } finally {
      setIsRemoving(false)
    }
  }

  const handleInvite = async () => {
    if (!contact.email) {
      toast.error(tAccess('noEmailForInvite'))
      return
    }
    if (!selectedRole) {
      toast.error(tAccess('inviteForm.selectRole'))
      return
    }

    try {
      const result = await createInvite.mutateAsync({
        email: contact.email,
        role_v2: selectedRole,
        supplier_id: contact.id,
      })
      setInviteLink(result.invite_link)
      setInviteDialogOpen(true)
      if (result.seat_warning) {
        toast.warning(result.seat_warning)
      }
    } catch (err: unknown) {
      const status = (err as { statusCode?: number })?.statusCode
      if (status === 409) toast.error(tAccess('inviteAlreadyPending'))
      else if (status === 402) toast.error(tAccess('seatLimitReached'))
      else toast.error((err as { message?: string })?.message || tAccess('inviteError'))
    }
  }

  const handleResendInvite = async () => {
    if (!contact.pending_invite) return
    try {
      const result = await resendInvite.mutateAsync(contact.pending_invite.id)
      setInviteLink(result.invite_link)
      setInviteDialogOpen(true)
      toast.success(tAccess('inviteResent'))
    } catch (err: unknown) {
      toast.error((err as { message?: string })?.message || tAccess('resendError'))
    }
  }

  const handleRevokeInvite = async () => {
    if (!contact.pending_invite) return
    try {
      await revokeInvite.mutateAsync(contact.pending_invite.id)
      toast.success(tAccess('inviteRevoked'))
    } catch (err: unknown) {
      toast.error((err as { message?: string })?.message || tAccess('revokeError'))
    }
  }

  return (
    <div className="space-y-6 mt-4">
      <ConfirmDeleteDialog
        open={removeConfirmOpen}
        onOpenChange={setRemoveConfirmOpen}
        onConfirm={handleRemoveAccess}
        loading={isRemoving}
        title={tAccess('removeAccessTitle')}
        description={tAccess('removeAccessDescription', { name: contact.name })}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {tAccess('title')}
          </CardTitle>
          <CardDescription>{tAccess('description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {hasTeamAccess && contact.team_info ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{contact.team_info.full_name || contact.team_info.email}</span>
                    {contact.team_info.is_master_owner && <Crown className="h-4 w-4 text-amber-500" />}
                  </div>
                  <div className="text-sm text-muted-foreground">{contact.team_info.email}</div>
                </div>
                <div className="flex items-center gap-2">
                  {canChangeRole ? (
                    <Select
                      value={contact.team_info.effective_role}
                      onValueChange={handleChangeRole}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">{getRoleLabel('admin')}</SelectItem>
                        <SelectItem value="producer">{getRoleLabel('producer')}</SelectItem>
                        <SelectItem value="finance">{getRoleLabel('finance')}</SelectItem>
                        <SelectItem value="freelancer">{getRoleLabel('freelancer')}</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="outline" className={ROLE_COLORS[contact.team_info.effective_role] || ''}>
                      {getRoleLabel(contact.team_info.effective_role)}
                    </Badge>
                  )}
                  {canRemoveAccess && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => setRemoveConfirmOpen(true)}
                    >
                      {tAccess('removeAccess')}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ) : hasPendingInvite && contact.pending_invite ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg border-yellow-200 dark:border-yellow-900">
                <div className="space-y-1">
                  <div className="font-medium">{tAccess('pendingInvite')}</div>
                  <div className="text-sm text-muted-foreground">
                    {tAccess('pendingInviteDescription', { email: contact.pending_invite.invited_email })}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {tAccess('expiresAt')}: {formatDate(contact.pending_invite.expires_at)}
                  </div>
                </div>
                {canManageInvites && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleResendInvite} disabled={resendInvite.isPending}>
                      {resendInvite.isPending ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <RotateCw className="mr-1 h-3 w-3" />
                      )}
                      {tAccess('resendInvite')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={handleRevokeInvite}
                    >
                      <XCircle className="mr-1 h-3 w-3" />
                      {tAccess('revokeInvite')}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 space-y-4">
              <p className="text-muted-foreground">{tAccess('noAccess')}</p>
              <p className="text-sm text-muted-foreground">{tAccess('noAccessHelp')}</p>
              {canManageInvites && (
                <div className="flex flex-col items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">{tAccess('inviteForm.role')}:</span>
                    <Select value={selectedRole} onValueChange={setSelectedRole}>
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {invitableRoles.map((role) => (
                          <SelectItem key={role} value={role}>
                            {getRoleLabel(role)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleInvite} disabled={createInvite.isPending || !selectedRole}>
                    {createInvite.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <UserPlus className="mr-2 h-4 w-4" />
                    )}
                    {tAccess('inviteToPlatform')}
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={inviteDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setInviteDialogOpen(false)
          setInviteLink('')
          setCopied(false)
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tAccess('inviteLinkTitle')}</DialogTitle>
            <DialogDescription>{tAccess('inviteLinkDescription', { name: contact.name })}</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input value={inviteLink} readOnly className="flex-1 text-xs" />
            <Button
              variant="outline"
              size="icon"
              onClick={async () => {
                await navigator.clipboard.writeText(inviteLink)
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
              }}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => { setInviteDialogOpen(false); setInviteLink(''); setCopied(false) }}>
              {tAccess('close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
