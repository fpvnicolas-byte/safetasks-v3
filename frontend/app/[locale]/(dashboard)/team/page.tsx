'use client'

import { useRef, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import {
  useTeamMembers,
  useChangeRole,
  useRemoveMember,
  useInvites,
  useCreateInvite,
  useRevokeInvite,
  useResendInvite,
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
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'

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

export default function TeamPage() {
  const t = useTranslations('team')
  const { organizationId, profile } = useAuth()
  const effectiveRole = profile?.effective_role || ''

  // Data
  const { data: members, isLoading: membersLoading } = useTeamMembers(organizationId || '')
  const { data: invites, isLoading: invitesLoading } = useInvites(organizationId || '')

  // Mutations
  const createInvite = useCreateInvite()
  const revokeInvite = useRevokeInvite()
  const resendInvite = useResendInvite()
  const changeRole = useChangeRole()
  const removeMember = useRemoveMember()

  // UI state
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

  // Handlers
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
      toast.success(t('inviteCreated'))
    } catch (err: any) {
      const status = err?.statusCode
      if (status === 409) {
        toast.error(t('inviteAlreadyPending'))
      } else if (status === 402) {
        toast.error(t('seatLimitReached'))
      } else {
        toast.error(err?.message || t('inviteError'))
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
        // Clipboard can fail on some browsers/contexts; the link is still shown in the dialog.
      }

      toast.success(t('inviteResent'))
    } catch (err: any) {
      toast.error(err?.message || t('resendError'))
    } finally {
      isResendingRef.current = false
      setResendTargetId(null)
    }
  }

  const handleRevoke = async (inviteId: string) => {
    try {
      await revokeInvite.mutateAsync(inviteId)
      toast.success(t('inviteRevoked'))
    } catch (err: any) {
      toast.error(err?.message || t('revokeError'))
    }
  }

  const handleChangeRole = async (memberId: string, newRole: string) => {
    try {
      await changeRole.mutateAsync({ profileId: memberId, role_v2: newRole })
      toast.success(t('roleChanged'))
    } catch (err: any) {
      toast.error(err?.message || t('roleChangeError'))
    }
  }

  const handleRemoveMember = async () => {
    if (!removeTarget) return
    setIsRemoving(true)
    try {
      await removeMember.mutateAsync(removeTarget.id)
      setRemoveTarget(null)
      toast.success(t('memberRemoved'))
    } catch (err: any) {
      toast.error(err?.message || t('removeError'))
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

  const canRemove = (member: TeamMember) => {
    if (member.id === profile?.id) return false
    if (member.is_master_owner) return false
    if (effectiveRole === 'owner') return true
    if (effectiveRole === 'admin') return ['producer', 'finance', 'freelancer'].includes(member.effective_role)
    if (effectiveRole === 'producer') return member.effective_role === 'freelancer'
    return false
  }

  return (
    <div className="space-y-8">
      {/* Remove member confirmation */}
      <ConfirmDeleteDialog
        open={!!removeTarget}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        onConfirm={handleRemoveMember}
        loading={isRemoving}
        title={t('removeMember')}
        description={t('removeConfirm', { name: removeTarget?.full_name || removeTarget?.email || '' })}
      />

      {/* Page header */}
      <div className="rounded-xl border bg-card/60 px-6 py-5">
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Organization / Team
        </div>
        <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight font-display">
              {t('title')}
            </h1>
            <p className="text-muted-foreground">{t('description')}</p>
          </div>
          {invitableRoles.length > 0 && (
            <Button onClick={() => {
              setInviteOpen(true)
              if (invitableRoles.length === 1) {
                setInviteRole(invitableRoles[0])
              }
            }}>
              <UserPlus className="mr-2 h-4 w-4" />
              {t('inviteMember')}
            </Button>
          )}
        </div>
      </div>

      {/* Active Members */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {t('activeMembers')}
            {members && (
              <Badge variant="secondary" className="ml-2">{members.length}</Badge>
            )}
          </CardTitle>
          <CardDescription>{t('activeMembersDescription')}</CardDescription>
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
                  <TableHead>{t('columnName')}</TableHead>
                  <TableHead>{t('columnEmail')}</TableHead>
                  <TableHead>{t('columnRole')}</TableHead>
                  <TableHead>{t('columnJoined')}</TableHead>
                  <TableHead className="text-right">{t('columnActions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members?.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {member.full_name || 'Unnamed'}
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
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="producer">Producer</SelectItem>
                            <SelectItem value="finance">Finance</SelectItem>
                            <SelectItem value="freelancer">Freelancer</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="outline" className={ROLE_COLORS[member.effective_role] || ''}>
                          {member.is_master_owner && <Shield className="h-3 w-3 mr-1" />}
                          {ROLE_LABELS[member.effective_role] || member.effective_role}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {new Date(member.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {canRemove(member) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setRemoveTarget(member)}
                        >
                          {t('remove')}
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

      {/* Pending Invites */}
      {pendingInvites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              {t('pendingInvites')}
              <Badge variant="secondary" className="ml-2">{pendingInvites.length}</Badge>
            </CardTitle>
            <CardDescription>{t('pendingInvitesDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('columnEmail')}</TableHead>
                  <TableHead>{t('columnRole')}</TableHead>
                  <TableHead>{t('columnSent')}</TableHead>
                  <TableHead>{t('columnExpires')}</TableHead>
                  <TableHead className="text-right">{t('columnActions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingInvites.map((invite) => (
                  <TableRow key={invite.id}>
                    <TableCell className="font-medium">{invite.invited_email}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={ROLE_COLORS[invite.role_v2] || ''}>
                        {ROLE_LABELS[invite.role_v2] || invite.role_v2}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(invite.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {new Date(invite.expires_at).toLocaleDateString()}
                    </TableCell>
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
                        {resendInvite.isPending && resendTargetId === invite.id ? t('resending') : t('resend')}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleRevoke(invite.id)}
                      >
                        <XCircle className="h-3 w-3 mr-1" />
                        {t('revoke')}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Resend Link Modal */}
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
            <DialogTitle>{t('resendLinkTitle')}</DialogTitle>
            <DialogDescription>
              {t('resendLinkDescription', { email: resendTargetEmail })}
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
            <p className="text-xs text-muted-foreground">{t('resendLinkNote')}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResendLinkOpen(false)}>
              {t('close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite Modal */}
      <Dialog open={inviteOpen} onOpenChange={(open) => { if (!open) resetInviteModal() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('inviteModalTitle')}</DialogTitle>
            <DialogDescription>{t('inviteModalDescription')}</DialogDescription>
          </DialogHeader>

          {inviteLink ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{t('inviteLinkReady')}</p>
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
                <Label>{t('emailLabel')}</Label>
                <Input
                  type="email"
                  placeholder={t('emailPlaceholder')}
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('roleLabel')}</Label>
                {invitableRoles.length === 1 ? (
                  <Input value={ROLE_LABELS[invitableRoles[0]] || invitableRoles[0]} readOnly />
                ) : (
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('selectRole')} />
                    </SelectTrigger>
                    <SelectContent>
                      {invitableRoles.map((role) => (
                        <SelectItem key={role} value={role}>
                          {ROLE_LABELS[role] || role}
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
              {inviteLink ? t('close') : t('cancel')}
            </Button>
            {!inviteLink && (
              <Button
                onClick={handleCreateInvite}
                disabled={!inviteEmail || !inviteRole || createInvite.isPending}
              >
                {createInvite.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('sendInvite')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
