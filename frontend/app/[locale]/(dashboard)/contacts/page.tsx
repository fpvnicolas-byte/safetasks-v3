'use client'

import { useRef, useState } from 'react'
import { useContacts } from '@/lib/api/hooks/useContacts'
import {
  useDeleteSupplier,
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
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Eye,
  Phone,
  Mail,
  Users,
  FolderOpen,
  UserPlus,
  Copy,
  Check,
  Loader2,
  RotateCw,
  XCircle,
  Shield,
  Crown,
} from 'lucide-react'
import { LocaleLink } from '@/components/LocaleLink'
import { Contact, SupplierCategory, formatCurrency } from '@/types'
import type { PlatformStatus } from '@/types'
import { useTranslations } from 'next-intl'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'
import { toast } from 'sonner'

const PLATFORM_STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  invited: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  none: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}

const ROLE_TRANSLATION_KEYS = {
  owner: 'access.roles.owner',
  admin: 'access.roles.admin',
  producer: 'access.roles.producer',
  finance: 'access.roles.finance',
  freelancer: 'access.roles.freelancer',
} as const

const CATEGORY_TRANSLATION_KEYS: Record<SupplierCategory, string> = {
  rental_house: 'categories.rental_house',
  freelancer: 'categories.freelancer',
  catering: 'categories.catering',
  transport: 'categories.transport',
  post_production: 'categories.post_production',
  other: 'categories.other',
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

export default function ContactsPage() {
  const t = useTranslations('contacts')
  const tTeam = useTranslations('team')
  const { organizationId, profile } = useAuth()
  const effectiveRole = profile?.effective_role || ''

  // Contacts data
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<SupplierCategory | 'all'>('all')
  const [platformFilter, setPlatformFilter] = useState<PlatformStatus | 'all'>('all')
  const [activeOnly, setActiveOnly] = useState(true)

  const { data: contacts, isLoading, error } = useContacts({
    search: searchQuery || undefined,
    category: categoryFilter === 'all' ? undefined : categoryFilter,
    platform_status: platformFilter === 'all' ? undefined : platformFilter,
    active_only: activeOnly,
  })

  // Team data
  const { data: members, isLoading: membersLoading } = useTeamMembers(organizationId || '')
  const { data: invites, isLoading: invitesLoading } = useInvites(organizationId || '')

  // Mutations
  const deleteSupplier = useDeleteSupplier()
  const createInvite = useCreateInvite()
  const revokeInvite = useRevokeInvite()
  const resendInvite = useResendInvite()
  const changeRole = useChangeRole()
  const removeMember = useRemoveMember()

  // Contact delete state
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Invite state
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('')
  const [inviteLink, setInviteLink] = useState('')
  const [copied, setCopied] = useState(false)

  // Resend invite state
  const [resendLinkOpen, setResendLinkOpen] = useState(false)
  const [resendLink, setResendLink] = useState('')
  const [resendCopied, setResendCopied] = useState(false)
  const [resendTargetEmail, setResendTargetEmail] = useState('')
  const [resendTargetId, setResendTargetId] = useState<string | null>(null)
  const isResendingRef = useRef(false)

  // Remove member state
  const [removeTarget, setRemoveTarget] = useState<TeamMember | null>(null)
  const [isRemoving, setIsRemoving] = useState(false)

  const pendingInvites = invites?.filter((inv) => inv.status === 'pending') || []
  const invitableRoles = getRolesCanInvite(effectiveRole)
  const getRoleLabel = (role: string) => {
    const key = ROLE_TRANSLATION_KEYS[role as keyof typeof ROLE_TRANSLATION_KEYS]
    return key ? t(key) : role
  }
  const getCategoryLabel = (category: SupplierCategory) => t(CATEGORY_TRANSLATION_KEYS[category])

  // --- Handlers ---
  const handleDelete = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      await deleteSupplier.mutateAsync(deleteTarget.id)
      setDeleteTarget(null)
    } catch (err: unknown) {
      const error = err as Error
      toast.error(error.message)
    } finally {
      setIsDeleting(false)
    }
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
    } catch (err: any) {
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
      } catch { /* clipboard may fail */ }
      toast.success(tTeam('inviteResent'))
    } catch (err: any) {
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
    } catch (err: any) {
      toast.error(err?.message || tTeam('revokeError'))
    }
  }

  const handleChangeRole = async (memberId: string, newRole: string) => {
    try {
      await changeRole.mutateAsync({ profileId: memberId, role_v2: newRole })
      toast.success(tTeam('roleChanged'))
    } catch (err: any) {
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
    } catch (err: any) {
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
        title={tTeam('removeMember')}
        description={tTeam('removeConfirm', { name: removeTarget?.full_name || removeTarget?.email || '' })}
      />

      {/* Delete contact confirmation */}
      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={isDeleting}
        title={t('delete.confirmTitle')}
        description={t('delete.confirm', { name: deleteTarget?.name || '' })}
      />

      {/* Page header */}
      <div className="rounded-xl border bg-card/60 px-6 py-5">
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          {t('breadcrumb')}
        </div>
        <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight font-display">{t('title')}</h1>
            <p className="text-muted-foreground">{t('description')}</p>
          </div>
          <div className="flex gap-2">
            {invitableRoles.length > 0 && (
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
            )}
            <Button asChild>
              <LocaleLink href="/contacts/new">
                <Plus className="mr-2 h-4 w-4" />
                {t('addContact')}
              </LocaleLink>
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs for Contacts vs Team & Invites */}
      <Tabs defaultValue="contacts" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="contacts">
            <Users className="mr-2 h-4 w-4" />
            {t('tabs.contacts')}
            {contacts && <Badge variant="secondary" className="ml-2">{contacts.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="team">
            <Shield className="mr-2 h-4 w-4" />
            {t('tabs.team')}
            {members && <Badge variant="secondary" className="ml-2">{members.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        {/* Contacts Tab */}
        <TabsContent value="contacts" className="space-y-6 mt-4">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle>{t('filters.title')}</CardTitle>
              <CardDescription>{t('filters.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('filters.search')}</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={t('filters.searchPlaceholder')}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('filters.category')}</label>
                  <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as SupplierCategory | 'all')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('filters.allCategories')}</SelectItem>
                      <SelectItem value="rental_house">{t('filters.rentalHouse')}</SelectItem>
                      <SelectItem value="freelancer">{t('filters.freelancer')}</SelectItem>
                      <SelectItem value="catering">{t('filters.catering')}</SelectItem>
                      <SelectItem value="transport">{t('filters.transport')}</SelectItem>
                      <SelectItem value="post_production">{t('filters.postProduction')}</SelectItem>
                      <SelectItem value="other">{t('filters.other')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('filters.platformStatus')}</label>
                  <Select value={platformFilter} onValueChange={(v) => setPlatformFilter(v as PlatformStatus | 'all')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('filters.allAccess')}</SelectItem>
                      <SelectItem value="active">{t('filters.platformActive')}</SelectItem>
                      <SelectItem value="invited">{t('filters.platformInvited')}</SelectItem>
                      <SelectItem value="none">{t('filters.platformNone')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('filters.results')}</label>
                  <div className="flex items-center justify-center h-10 px-3 py-2 bg-muted rounded-md">
                    <span className="text-sm font-medium">
                      {(contacts?.length ?? 0) === 1
                        ? t('filters.contactCount', { count: 1 })
                        : t('filters.contactCount_other', { count: contacts?.length ?? 0 })}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Grid */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div>{t('error')}</div>
          ) : contacts && contacts.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {contacts.map((contact) => (
                <ContactCard
                  key={contact.id}
                  contact={contact}
                  onDelete={() => setDeleteTarget({ id: contact.id, name: contact.name })}
                  t={t}
                  getCategoryLabel={getCategoryLabel}
                />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Users className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground mb-4">{t('empty.helpText')}</p>
                <Button asChild>
                  <LocaleLink href="/contacts/new">
                    <Plus className="mr-2 h-4 w-4" />
                    {t('empty.addFirst')}
                  </LocaleLink>
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Team & Invites Tab */}
        <TabsContent value="team" className="space-y-6 mt-4">
          {/* Active Members */}
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

          {/* Pending Invites */}
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
        </TabsContent>
      </Tabs>

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

      {/* Invite Modal */}
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

interface ContactCardProps {
  contact: Contact
  onDelete: () => void
  t: (key: string, values?: Record<string, string | number>) => string
  getCategoryLabel: (category: SupplierCategory) => string
}

function ContactCard({ contact, onDelete, t, getCategoryLabel }: ContactCardProps) {
  return (
    <Card className="h-full hover:shadow-md transition-shadow">
      <CardHeader className="min-h-[96px]">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg flex items-center gap-2 line-clamp-1">
              {contact.name}
              {!contact.is_active && (
                <Badge variant="outline" className="text-xs">{t('card.inactive')}</Badge>
              )}
            </CardTitle>
            <CardDescription className="flex items-center gap-2 mt-1">
              <Badge variant="secondary">
                {getCategoryLabel(contact.category)}
              </Badge>
              <Badge className={PLATFORM_STATUS_COLORS[contact.platform_status]}>
                {t(`card.platform.${contact.platform_status}`)}
              </Badge>
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex h-full flex-col gap-4">
        <div className="space-y-2 text-sm">
          {contact.email && (
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">{contact.email}</span>
            </div>
          )}
          {contact.phone && (
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span>{contact.phone}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <FolderOpen className="h-3.5 w-3.5" />
            <span>{contact.project_count} {t('card.projects')}</span>
          </div>
          {contact.total_spent_cents > 0 && (
            <span>{formatCurrency(contact.total_spent_cents)}</span>
          )}
        </div>

        <div className="flex gap-2 pt-2 mt-auto">
          <Button asChild variant="outline" size="sm" className="flex-1">
            <LocaleLink href={`/contacts/${contact.id}`}>
              <Eye className="mr-2 h-3 w-3" />
              {t('card.view')}
            </LocaleLink>
          </Button>
          <Button asChild variant="outline" size="sm" className="flex-1">
            <LocaleLink href={`/contacts/${contact.id}/edit`}>
              <Edit className="mr-2 h-3 w-3" />
              {t('card.edit')}
            </LocaleLink>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onDelete}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
