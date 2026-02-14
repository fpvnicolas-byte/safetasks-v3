'use client'

import { useState } from 'react'
import { Bell, Check, CheckCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { useNotifications, useNotificationStats, useMarkAsRead, useMarkAllAsRead } from '@/lib/api/hooks/useNotifications'
import { useNotificationWebSocket } from '@/lib/hooks/useNotificationWebSocket'
import { formatDistanceToNow } from 'date-fns'

import { useTranslations } from 'next-intl'
import { LocaleLink } from '@/components/LocaleLink'

type TranslatorFn = (key: string, values?: Record<string, unknown>) => string
type NotificationItemData = NonNullable<ReturnType<typeof useNotifications>['data']>[number]

const normalizeMetadata = (metadata: unknown): Record<string, unknown> => {
  if (!metadata) return {}
  if (typeof metadata === 'string') {
    try {
      const parsed = JSON.parse(metadata) as unknown
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>
      }
    } catch {
      return {}
    }
    return {}
  }
  if (typeof metadata === 'object' && !Array.isArray(metadata)) {
    return metadata as Record<string, unknown>
  }
  return {}
}

// Helper component for individual notification item to use hooks
const NotificationItem = ({ notification, onMarkRead }: { notification: NotificationItemData, onMarkRead: (id: string, e: React.MouseEvent) => void }) => {
  const tMessages = useTranslations('notifications.messages')
  const tMessagesUnsafe = tMessages as unknown as TranslatorFn
  const tControls = useTranslations('notifications.controls')

  const getTranslatedContent = (defaultText: string, metadata?: unknown) => {
    const isLikelyKey = !defaultText.includes(' ') && defaultText.length < 50
    if (isLikelyKey) {
      try {
        const translated = tMessagesUnsafe(defaultText, normalizeMetadata(metadata))
        if (translated.includes('notifications.messages.')) return defaultText
        return translated
      } catch {
        return defaultText
      }
    }
    return defaultText
  }

  const title = getTranslatedContent(notification.title, notification.metadata)
  const message = getTranslatedContent(notification.message, notification.metadata)

  const getNotificationIcon = (type: string) => {
    const colors = {
      info: 'text-blue-600',
      success: 'text-green-600',
      warning: 'text-yellow-600',
      error: 'text-red-600',
    }
    return colors[type as keyof typeof colors] || colors.info
  }

  return (
    <DropdownMenuItem
      className={`flex flex-col items-start gap-1 px-3 py-3.5 cursor-pointer ${!notification.is_read ? 'bg-blue-50 dark:bg-blue-950' : ''
        }`}
    >
      <div className="flex items-start justify-between w-full">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${getNotificationIcon(notification.type)}`} />
            <span className="font-medium text-sm">{title}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {message}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
          </p>
        </div>
        {!notification.is_read && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 flex-shrink-0"
            onClick={(e) => onMarkRead(notification.id, e)}
            aria-label={tControls('markRead')}
          >
            <Check className="h-3 w-3" />
          </Button>
        )}
      </div>
    </DropdownMenuItem>
  )
}

export function NotificationsBell() {
  const [open, setOpen] = useState(false)

  // Keep WebSocket live so badge/page updates arrive immediately.
  const { isConnected } = useNotificationWebSocket({ enabled: true })

  // Disable polling when WebSocket is connected
  const pollingInterval = isConnected ? false : 30000

  const { data: stats } = useNotificationStats({ refetchInterval: pollingInterval })
  const { data: notifications } = useNotifications(false, {
    enabled: open,
    refetchInterval: open ? pollingInterval : false,
  })

  const markAsRead = useMarkAsRead()
  const markAllAsRead = useMarkAllAsRead()
  const t = useTranslations('notifications')

  const recentNotifications = notifications?.slice(0, 5) || []
  const unreadCount = stats?.unread_count || 0

  const handleMarkAsRead = async (notificationId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await markAsRead.mutateAsync(notificationId)
  }

  const handleMarkAllAsRead = async () => {
    await markAllAsRead.mutateAsync()
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={t('title')}>
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-1.5">
        <div className="flex items-center justify-between px-3 pt-3 pb-2">
          <h3 className="font-semibold">{t('title')}</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllAsRead}
              className="h-auto px-3 py-1.5 text-xs font-medium"
            >
              <CheckCheck className="h-3 w-3 mr-1" />
              {t('controls.markAllRead')}
            </Button>
          )}
        </div>
        <DropdownMenuSeparator />

        {recentNotifications.length > 0 ? (
          <>
            {recentNotifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onMarkRead={handleMarkAsRead}
              />
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <div
                className="w-full text-center text-sm text-muted-foreground cursor-pointer px-3 pt-2 pb-3"
                onClick={() => setOpen(false)}
              >
                <LocaleLink href="/notifications" className="w-full inline-block rounded-md py-1.5 hover:bg-muted/60">
                  {t('viewAll')}
                </LocaleLink>
              </div>
            </DropdownMenuItem>
          </>
        ) : (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            {t('empty.title')}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
