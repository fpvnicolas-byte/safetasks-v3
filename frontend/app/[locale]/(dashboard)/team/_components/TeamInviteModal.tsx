'use client'

import { useEffect, useState } from 'react'
import { useCreateInvite } from '@/lib/api/hooks'
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
import { Loader2, Copy, Check } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'

interface TeamInviteModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  invitableRoles: string[]
  roleLabels: Record<string, string>
}

export function TeamInviteModal({
  open,
  onOpenChange,
  invitableRoles,
  roleLabels,
}: TeamInviteModalProps) {
  const t = useTranslations('team')
  const createInvite = useCreateInvite()

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('')
  const [inviteLink, setInviteLink] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!open) return
    if (invitableRoles.length === 1) {
      setInviteRole(invitableRoles[0])
    }
  }, [invitableRoles, open])

  const resetInviteModal = () => {
    setInviteEmail('')
    setInviteRole('')
    setInviteLink('')
    setCopied(false)
  }

  const copyLink = async (link: string) => {
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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
      toast.success(t('inviteCreated'))
    } catch (err: unknown) {
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

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          resetInviteModal()
        }
        onOpenChange(nextOpen)
      }}
    >
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
                <Input value={roleLabels[invitableRoles[0]] || invitableRoles[0]} readOnly />
              ) : (
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('selectRole')} />
                  </SelectTrigger>
                  <SelectContent>
                    {invitableRoles.map((role) => (
                      <SelectItem key={role} value={role}>
                        {roleLabels[role] || role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              resetInviteModal()
              onOpenChange(false)
            }}
          >
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
  )
}
