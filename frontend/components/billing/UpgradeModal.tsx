'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { TrendingUp, Zap } from 'lucide-react'
import Link from 'next/link'
import { useLocale } from 'next-intl'

interface UpgradeModalProps {
  isOpen: boolean
  onClose: () => void
  message?: string
}

export function UpgradeModal({ isOpen, onClose, message }: UpgradeModalProps) {
  const locale = useLocale()

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center justify-center mb-4">
            <div className="p-4 bg-warning/10 rounded-full">
              <Zap className="h-8 w-8 text-warning" />
            </div>
          </div>
          <DialogTitle className="text-center text-2xl">
            Plan Limit Reached
          </DialogTitle>
          <DialogDescription className="text-center">
            {message || "You've reached your current plan limit. Upgrade to continue."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <div className="font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Unlock More with Pro
            </div>
            <ul className="text-sm space-y-1 ml-6 list-disc">
              <li>Unlimited projects, clients, and proposals</li>
              <li>More storage and AI credits</li>
              <li>Unlimited team members</li>
            </ul>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Link href={`/${locale}/settings/billing/plans`} className="flex-1">
              <Button className="w-full">
                View Plans
              </Button>
            </Link>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
