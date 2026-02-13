'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Copy, Check } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface TeamResendLinkModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  resendLink: string
  resendCopied: boolean
  resendTargetEmail: string
  onCopyLink: (link: string) => void
}

export function TeamResendLinkModal({
  open,
  onOpenChange,
  resendLink,
  resendCopied,
  resendTargetEmail,
  onCopyLink,
}: TeamResendLinkModalProps) {
  const t = useTranslations('team')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
              onClick={() => onCopyLink(resendLink)}
              disabled={!resendLink}
            >
              {resendCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t('resendLinkNote')}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
