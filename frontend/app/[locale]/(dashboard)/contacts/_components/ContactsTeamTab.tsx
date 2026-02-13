'use client'

import { useRef, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import {
  useTeamMembers,
  useInvites,
  useCreateInvite,
  useRevokeInvite,
  useResendInvite,
  useChangeRole,
  useRemoveMember,
  type TeamMember,
  type InviteOut,
} from '@/lib/api/hooks'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'
import {
  UserPlus,
  Users,
  Copy,
  Check,
  Loader2,
  RotateCw,
  XCircle,
  Shield,
  Crown,
} from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { toast } from 'sonner'

const ROLE_TRANSLATION_KEYS = {
  owner: 'access.roles.owner',
  admin: 'access.roles.admin',
  producer: 'access.roles.producer',
  finance: 'access.roles.finance',
  freelancer: 'access.roles.freelancer',
} as const

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

export function ContactsTeamTab() {
  const t = useTranslations('contacts')
  const tTeam = useTranslations('team')
  const locale = useLocale()
  const { organizationId, profile } = useAuth()
  const effectiveRole = profile?.effective_role || ''

  const { data: members, isLoading: membersLoading } = useTeamMembers(organizationId || '')
  const { data: invites } = useInvites(organizationId || '')

  const createInvite = useCreateInvite()
  const revokeInvite = useRevokeInvite()
  const resendInvite = useResendInvite()
  const changeRole = useChangeRole()
  const removeMember = useRemoveMember()

  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('')
  const [inviteLink, setInviteLink] = useState('')
  const [copied, setCopied] = useState(false)

  const [resendLinkOpen, setResendLinkOpen] = useState(false)
  const [resendLink, setResendLink] = useState('')
  const [resendCopied, setResendCopied] = useState(false)
  const [resendTargetEmail, setResendTargetEmail] = useState('')
  const [resendTargetId, setResendTargetId] = useState<string | null>(null)
  const isResendingRef = useRef(false)

  const [removeTarget, setRemoveTarget] = useState<TeamMember | null>(null)
  const [isRemoving, setIsRemoving] = useState(false)

  const pendingInvites = invites?.filter((inv) => inv.status === 'pending') || []
  const invitableRoles = getRolesCanInvite(effectiveRole)

  const getRoleLabel = (role: string) => {
    const key = ROLE_TRANSLATION_KEYS[role as keyof typeof ROLE_TRANSLATION_KEYS]
    return key ? t(key) : role
  }

  const canRemove = (member: TeamMember) => {
    if (member.id === profile?.id) return false
    if (member.is_master_owner) return false
    if (effectiveRole === 'owner') return true
    if (effectiveRole === 'admin') return ['producer', 'finance', 'freelancer'].includes(member.effective_role)
    if (effectiveRole === 'producer') return member.effective_role === 'freelancer'
    return false
  }

  const handleCreateInvite = async () => {
    if (!inviteEmail || !inviteRole) return
    try {
      const result = await createInvite.mutateAsync({
        email: inviteEmail,
        role_v2: inviteRole,
      })
      setInviteLink(result.invite_link)
      if (result.seat_warning) {
        toast.warning(result.seat_warning)
      }
      toast.success(tTeam('inviteCreated'))
    } catch (err: unknown) {
      const status = err?.statusCode
      if (status === 409) {
        toast.error(tTeam('inviteAlreadyPending'))
      } else if (status === 402) {
        toast.error(tTeam('seatLimitReached'))
      } else {
        toast.error(err?.message || tTeam('inviteError'))
      }
    }
  }

  const handleResend = async (invite: InviteOut) => {
    if (isResendingRef.current) return
    isResendingRef.current = true
    setResendTargetId(invite.id)
    try {
      const result = await resendInvite.mutateAsync(invite.id)
      setResendLink(result.invite_link)
      setResendTargetEmail(invite.invited_email)
      setResendCopied(false)
      setResendLinkOpen(true)
      try {
        await navigator.clipboard.writeText(result.invite_link)
        setResendCopied(true)
      } catch {
        // Clipboard may fail in some contexts.
      }
      toast.success(tTeam('inviteResent'))
    } catch (err: unknown) {
      toast.error(err?.message || tTeam('resendError'))
    } finally {
      isResendingRef.current = false
      setResendTargetId(null)
    }
  }

  const handleRevoke = async (inviteId: string) => {
    try {
      await revokeInvite.mutateAsync(inviteId)
      toast.success(tTeam('inviteRevoked'))
    } catch (err: unknown) {
      toast.error(err?.message || tTeam('revokeError'))
    }
  }

  const handleChangeRole = async (memberId: string, newRole: string) => {
    try {
      await changeRole.mutateAsync({ profileId: memberId, role_v2: newRole })
      toast.success(tTeam('roleChanged'))
    } catch (err: unknown) {
      toast.error(err?.message || tTeam('roleChangeError'))
    }
  }

  const handleRemoveMember = async () => {
    if (!removeTarget) return
    setIsRemoving(true)
    try {
      await removeMember.mutateAsync(removeTarget.id)
      setRemoveTarget(null)
      toast.success(tTeam('memberRemoved'))
    } catch (err: unknown) {
      toast.error(err?.message || tTeam('removeError'))
    } finally {
      setIsRemoving(false)
    }
  }

  const copyLink = async (link: string) => {
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const copyResendLink = async (link: string) => {
    await navigator.clipboard.writeText(link)
    setResendCopied(true)
    setTimeout(() => setResendCopied(false), 2000)
  }

  const resetInviteModal = () => {
    setInviteOpen(false)
    setInviteEmail('')
    setInviteRole('')
    setInviteLink('')
    setCopied(false)
  }

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })

  return (
    <div className="space-y-6">
      <ConfirmDeleteDialog
        open={!!removeTarget}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        onConfirm={handleRemoveMember}
        loading={isRemoving}
        title={tTeam('removeMember')}
        description={tTeam('removeConfirm', { name: removeTarget?.full_name || removeTarget?.email || '' })}
      />

      {invitableRoles.length > 0 && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            onClick={() => {
              setInviteOpen(true)
              if (invitableRoles.length === 1) {
                setInviteRole(invitableRoles[0])
              }
            }}
          >
            <UserPlus className="mr-2 h-4 w-4" />
            {t('invite.inviteMember')}
          </Button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {t('team.activeMembers')}
            {members && <Badge variant="secondary" className="ml-2">{members.length}</Badge>}
          </CardTitle>
          <CardDescription>{t('team.activeMembersDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          {membersLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('team.columnName')}</TableHead>
                  <TableHead>{t('team.columnEmail')}</TableHead>
                  <TableHead>{t('team.columnRole')}</TableHead>
                  <TableHead>{t('team.columnJoined')}</TableHead>
                  <TableHead className="text-right">{t('team.columnActions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members?.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {member.full_name || t('team.unnamed')}
                        {member.is_master_owner && (
                          <Crown className="h-4 w-4 text-amber-500" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{member.email}</TableCell>
                    <TableCell>
                      {effectiveRole === 'owner' && !member.is_master_owner && member.id !== profile?.id ? (
                        <Select
                          value={member.effective_role}
                          onValueChange={(val) => handleChangeRole(member.id, val)}
                        >
                          <SelectTrigger className="w-[130px]">
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
                        <Badge variant="outline" className={ROLE_COLORS[member.effective_role] || ''}>
                          {member.is_master_owner && <Shield className="h-3 w-3 mr-1" />}
                          {getRoleLabel(member.effective_role)}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{formatDate(member.created_at)}</TableCell>
                    <TableCell className="text-right">
                      {canRemove(member) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setRemoveTarget(member)}
                        >
                          {t('team.remove')}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {pendingInvites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              {t('team.pendingInvites')}
              <Badge variant="secondary" className="ml-2">{pendingInvites.length}</Badge>
            </CardTitle>
            <CardDescription>{t('team.pendingInvitesDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('team.columnEmail')}</TableHead>
                  <TableHead>{t('team.columnRole')}</TableHead>
                  <TableHead>{t('team.columnSent')}</TableHead>
                  <TableHead>{t('team.columnExpires')}</TableHead>
                  <TableHead className="text-right">{t('team.columnActions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingInvites.map((invite) => (
                  <TableRow key={invite.id}>
                    <TableCell className="font-medium">{invite.invited_email}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={ROLE_COLORS[invite.role_v2] || ''}>
                        {getRoleLabel(invite.role_v2)}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(invite.created_at)}</TableCell>
                    <TableCell>{formatDate(invite.expires_at)}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleResend(invite)}
                        disabled={resendInvite.isPending || resendTargetId === invite.id}
                      >
                        {resendInvite.isPending && resendTargetId === invite.id ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <RotateCw className="h-3 w-3 mr-1" />
                        )}
                        {resendInvite.isPending && resendTargetId === invite.id
                          ? t('team.resending')
                          : t('team.resend')}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleRevoke(invite.id)}
                      >
                        <XCircle className="h-3 w-3 mr-1" />
                        {t('team.revoke')}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog
        open={resendLinkOpen}
        onOpenChange={(open) => {
          setResendLinkOpen(open)
          if (!open) {
            setResendLink('')
            setResendCopied(false)
            setResendTargetEmail('')
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tTeam('resendLinkTitle')}</DialogTitle>
            <DialogDescription>
              {tTeam('resendLinkDescription', { email: resendTargetEmail })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input value={resendLink} readOnly className="flex-1 text-xs" />
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyResendLink(resendLink)}
                disabled={!resendLink}
              >
                {resendCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{tTeam('resendLinkNote')}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResendLinkOpen(false)}>
              {tTeam('close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={inviteOpen} onOpenChange={(open) => { if (!open) resetInviteModal() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('invite.modalTitle')}</DialogTitle>
            <DialogDescription>{t('invite.modalDescription')}</DialogDescription>
          </DialogHeader>

          {inviteLink ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{t('invite.linkReady')}</p>
              <div className="flex gap-2">
                <Input value={inviteLink} readOnly className="flex-1 text-xs" />
                <Button variant="outline" size="icon" onClick={() => copyLink(inviteLink)}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t('invite.emailLabel')}</Label>
                <Input
                  type="email"
                  placeholder={t('invite.emailPlaceholder')}
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('invite.roleLabel')}</Label>
                {invitableRoles.length === 1 ? (
                  <Input value={getRoleLabel(invitableRoles[0])} readOnly />
                ) : (
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('invite.selectRole')} />
                    </SelectTrigger>
                    <SelectContent>
                      {invitableRoles.map((role) => (
                        <SelectItem key={role} value={role}>
                          {getRoleLabel(role)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={resetInviteModal}>
              {inviteLink ? t('invite.close') : t('invite.cancel')}
            </Button>
            {!inviteLink && (
              <Button
                onClick={handleCreateInvite}
                disabled={!inviteEmail || !inviteRole || createInvite.isPending}
              >
                {createInvite.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('invite.sendInvite')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
