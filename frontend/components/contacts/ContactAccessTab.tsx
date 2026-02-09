'use client'

import { useState } from 'react'
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
import { useTranslations } from 'next-intl'
import { useAuth } from '@/contexts/AuthContext'
import {
  useChangeRole,
  useRemoveMember,
  useCreateInvite,
  useRevokeInvite,
  useResendInvite,
} from '@/lib/api/hooks'
import type { ContactDetail } from '@/types'

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  producer: 'Producer',
  finance: 'Finance',
  freelancer: 'Freelancer',
}

const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  admin: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  producer: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  finance: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  freelancer: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
}

interface ContactAccessTabProps {
  contact: ContactDetail
}

export function ContactAccessTab({ contact }: ContactAccessTabProps) {
  const t = useTranslations('contacts.detail')
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

  const hasTeamAccess = !!contact.team_info
  const hasPendingInvite = !!contact.pending_invite
  const canManage = ['owner', 'admin', 'producer'].includes(effectiveRole)

  const handleChangeRole = async (newRole: string) => {
    if (!contact.team_info) return
    try {
      await changeRole.mutateAsync({ profileId: contact.team_info.profile_id, role_v2: newRole })
      toast.success(t('roleChanged'))
    } catch (err: any) {
      toast.error(err?.message || t('roleChangeError'))
    }
  }

  const handleRemoveAccess = async () => {
    if (!contact.team_info) return
    setIsRemoving(true)
    try {
      await removeMember.mutateAsync(contact.team_info.profile_id)
      setRemoveConfirmOpen(false)
      toast.success(t('accessRemoved'))
    } catch (err: any) {
      toast.error(err?.message || t('removeError'))
    } finally {
      setIsRemoving(false)
    }
  }

  const handleInvite = async () => {
    if (!contact.email) {
      toast.error(t('noEmailForInvite'))
      return
    }
    try {
      const result = await createInvite.mutateAsync({
        email: contact.email,
        role_v2: 'freelancer',
        supplier_id: contact.id,
      })
      setInviteLink(result.invite_link)
      setInviteDialogOpen(true)
      if (result.seat_warning) {
        toast.warning(result.seat_warning)
      }
    } catch (err: any) {
      const status = err?.statusCode
      if (status === 409) toast.error(t('inviteAlreadyPending'))
      else if (status === 402) toast.error(t('seatLimitReached'))
      else toast.error(err?.message || t('inviteError'))
    }
  }

  const handleResendInvite = async () => {
    if (!contact.pending_invite) return
    try {
      const result = await resendInvite.mutateAsync(contact.pending_invite.id)
      setInviteLink(result.invite_link)
      setInviteDialogOpen(true)
      toast.success(t('inviteResent'))
    } catch (err: any) {
      toast.error(err?.message || t('resendError'))
    }
  }

  const handleRevokeInvite = async () => {
    if (!contact.pending_invite) return
    try {
      await revokeInvite.mutateAsync(contact.pending_invite.id)
      toast.success(t('inviteRevoked'))
    } catch (err: any) {
      toast.error(err?.message || t('revokeError'))
    }
  }

  return (
    <div className="space-y-6 mt-4">
      <ConfirmDeleteDialog
        open={removeConfirmOpen}
        onOpenChange={setRemoveConfirmOpen}
        onConfirm={handleRemoveAccess}
        loading={isRemoving}
        title={t('removeAccessTitle')}
        description={t('removeAccessConfirm', { name: contact.name })}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {t('platformAccess')}
          </CardTitle>
          <CardDescription>{t('platformAccessDescription')}</CardDescription>
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
                  {canManage && !contact.team_info.is_master_owner ? (
                    <Select
                      value={contact.team_info.effective_role}
                      onValueChange={handleChangeRole}
                    >
                      <SelectTrigger className="w-[130px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="producer">Producer</SelectItem>
                        <SelectItem value="finance">Finance</SelectItem>
                        <SelectItem value="freelancer">Freelancer</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="outline" className={ROLE_COLORS[contact.team_info.effective_role] || ''}>
                      {ROLE_LABELS[contact.team_info.effective_role] || contact.team_info.effective_role}
                    </Badge>
                  )}
                  {canManage && !contact.team_info.is_master_owner && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => setRemoveConfirmOpen(true)}
                    >
                      {t('removeAccess')}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ) : hasPendingInvite && contact.pending_invite ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg border-yellow-200 dark:border-yellow-900">
                <div className="space-y-1">
                  <div className="font-medium">{t('pendingInvite')}</div>
                  <div className="text-sm text-muted-foreground">
                    {t('inviteSentTo', { email: contact.pending_invite.invited_email })}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t('expiresAt', { date: contact.pending_invite.expires_at || '' })}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleResendInvite} disabled={resendInvite.isPending}>
                    {resendInvite.isPending ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <RotateCw className="mr-1 h-3 w-3" />
                    )}
                    {t('resend')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={handleRevokeInvite}
                  >
                    <XCircle className="mr-1 h-3 w-3" />
                    {t('revoke')}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">{t('noAccess')}</p>
              {canManage && (
                <Button onClick={handleInvite} disabled={createInvite.isPending}>
                  {createInvite.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <UserPlus className="mr-2 h-4 w-4" />
                  )}
                  {t('inviteToPlatform')}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invite Link Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setInviteDialogOpen(false)
          setInviteLink('')
          setCopied(false)
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('inviteLinkTitle')}</DialogTitle>
            <DialogDescription>{t('inviteLinkDescription', { name: contact.name })}</DialogDescription>
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
              {t('close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
