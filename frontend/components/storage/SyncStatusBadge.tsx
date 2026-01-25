'use client'

import { CheckCircle2, XCircle, Loader2, Cloud, CloudOff } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export type SyncStatus = 'synced' | 'syncing' | 'failed' | 'not_synced'

interface SyncStatusBadgeProps {
  status: SyncStatus
  onSync?: () => void
  isSyncing?: boolean
  errorMessage?: string
  className?: string
}

export function SyncStatusBadge({
  status,
  onSync,
  isSyncing = false,
  errorMessage,
  className,
}: SyncStatusBadgeProps) {
  const getBadgeContent = () => {
    if (isSyncing || status === 'syncing') {
      return {
        icon: <Loader2 className="h-3 w-3 animate-spin" />,
        text: 'Syncing...',
        variant: 'outline' as const,
        className: 'border-blue-500 text-blue-600',
      }
    }

    switch (status) {
      case 'synced':
        return {
          icon: <CheckCircle2 className="h-3 w-3" />,
          text: 'Synced',
          variant: 'outline' as const,
          className: 'border-green-500 text-green-600',
        }
      case 'failed':
        return {
          icon: <XCircle className="h-3 w-3" />,
          text: 'Sync failed',
          variant: 'outline' as const,
          className: 'border-destructive text-destructive',
        }
      case 'not_synced':
        return {
          icon: <CloudOff className="h-3 w-3" />,
          text: 'Not synced',
          variant: 'outline' as const,
          className: 'border-muted-foreground/30 text-muted-foreground',
        }
      default:
        return {
          icon: <Cloud className="h-3 w-3" />,
          text: 'Unknown',
          variant: 'outline' as const,
          className: '',
        }
    }
  }

  const badgeContent = getBadgeContent()

  const badge = (
    <Badge
      variant={badgeContent.variant}
      className={cn('gap-1', badgeContent.className, className)}
    >
      {badgeContent.icon}
      {badgeContent.text}
    </Badge>
  )

  // If there's an error message or sync button, wrap in tooltip
  if (errorMessage || (onSync && status !== 'syncing' && !isSyncing)) {
    return (
      <div className="flex items-center gap-2">
        {errorMessage ? (
          <Tooltip>
            <TooltipTrigger asChild>{badge}</TooltipTrigger>
            <TooltipContent>
              <p className="text-xs max-w-xs">{errorMessage}</p>
            </TooltipContent>
          </Tooltip>
        ) : (
          badge
        )}

        {onSync && status !== 'syncing' && !isSyncing && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onSync}
            disabled={isSyncing}
            className="h-6 px-2 text-xs"
          >
            <Cloud className="h-3 w-3 mr-1" />
            Sync
          </Button>
        )}
      </div>
    )
  }

  return badge
}
