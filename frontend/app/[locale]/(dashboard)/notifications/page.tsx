'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Bell,
  BellRing,
  Check,
  CheckCheck,
  Clock,
  AlertCircle,
  Info,
  X,
  RefreshCw
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useNotifications, useNotificationStats, useMarkAsRead, useMarkAllAsRead } from '@/lib/api/hooks/useNotifications'
import { useTranslations } from 'next-intl'

export default function NotificationsPage() {
  const t = useTranslations('notifications')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const { data: notifications, isLoading, error } = useNotifications(unreadOnly)
  const { data: stats } = useNotificationStats()
  const markAsRead = useMarkAsRead()
  const markAllAsRead = useMarkAllAsRead()

  const getNotificationIcon = (type: string) => {
    const icons = {
      info: <Info className="h-4 w-4 text-info-foreground" />,
      success: <Check className="h-4 w-4 text-success-foreground" />,
      warning: <AlertCircle className="h-4 w-4 text-warning-foreground" />,
      error: <X className="h-4 w-4 text-destructive" />
    }
    return icons[type as keyof typeof icons] || icons.info
  }

  const getNotificationColor = (type: string) => {
    const colors = {
      info: 'bg-info text-info-foreground border-info/30',
      success: 'bg-success text-success-foreground border-success/30',
      warning: 'bg-warning text-warning-foreground border-warning/30',
      error: 'bg-destructive/15 text-destructive border-destructive/30'
    }
    return colors[type as keyof typeof colors] || colors.info
  }

  const handleMarkAsRead = async (notificationId: string) => {
    await markAsRead.mutateAsync(notificationId)
  }

  const handleMarkAllAsRead = async () => {
    await markAllAsRead.mutateAsync()
  }

  if (error) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-display">{t('title')}</h1>
          <p className="text-muted-foreground">{t('unableToLoad')}</p>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <span>{t('failedToLoad', { message: error.message })}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.reload()}
                className="ml-auto"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                {t('retry')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-display">{t('title')}</h1>
        <p className="text-muted-foreground">
          {t('description')}
        </p>
      </div>

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('stats.total')}</CardTitle>
              <Bell className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_count}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('stats.unread')}</CardTitle>
              <BellRing className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">{stats.unread_count}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('stats.read')}</CardTitle>
              <CheckCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.read_count}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant={unreadOnly ? "default" : "outline"}
                size="sm"
                onClick={() => setUnreadOnly(!unreadOnly)}
              >
                <BellRing className="h-4 w-4 mr-2" />
                {unreadOnly ? t('controls.showAll') : t('controls.unreadOnly')}
              </Button>

              {stats && stats.unread_count > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleMarkAllAsRead}
                  disabled={markAllAsRead.isPending}
                >
                  <CheckCheck className="h-4 w-4 mr-2" />
                  {t('controls.markAllRead')}
                </Button>
              )}
            </div>

            <div className="text-sm text-muted-foreground">
              {isLoading ? t('controls.loading') : t('controls.count', { count: notifications?.length || 0 })}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Notifications List */}
      <Card>
        <CardHeader>
          <CardTitle>{t('list.title')}</CardTitle>
          <CardDescription>
            {unreadOnly ? t('list.showingUnread') : t('list.showingAll')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : notifications && notifications.length > 0 ? (
            <div className="space-y-4">
              {notifications.map((notification) => {
                // Translation logic
                const tMessages = useTranslations('notifications.messages')

                // Helper to get translated text or fallback to original
                const getTranslatedContent = (key: string, defaultText: string, metadata: any) => {
                  // Check if the text mimics a key structure (e.g. contains underscores, no spaces)
                  // or checks if the key exists in our known keys list
                  // A simpler approach is to try to translate and if it returns the key, use default
                  // But next-intl returns the key if missing.

                  // For this specific implementation, we'll try to translate if the text is likely a key
                  // OR simply try to translate and check if the result is different from the key
                  // BUT next-intl namespaces make this tricky.

                  // Let's check if the defaultText matches one of our known keys
                  // We can't easily check "has" with nested keys in all versions, 
                  // so we'll check if the translation is different from the key path

                  // Better approach for this project:
                  // The backend sends keys like "welcome_title". 
                  // If we try tMessages('welcome_title'), it returns "Welcome to SafeTasks...".
                  // If we try tMessages('Some random text'), it returns "notifications.messages.Some random text".

                  // However, strict mode might throw errors. 
                  // Let's assume if the backend sends a key, it matches our schema.

                  // To be safe and support legacy/AI notifications, we can check if the text contains spaces.
                  // Keys usually don't have spaces.
                  const isLikelyKey = !defaultText.includes(' ') && defaultText.length < 50;

                  if (isLikelyKey) {
                    try {
                      // We need to handle potential missing keys gracefully to avoid UI crashes
                      // relying on next-intl's behavior to return the key if missing
                      const translated = tMessages(defaultText as any, metadata || {});
                      // If the translated text is just the key (with full namespace), fallback
                      if (translated.includes('notifications.messages.')) return defaultText;
                      return translated;
                    } catch (e) {
                      return defaultText;
                    }
                  }

                  return defaultText;
                };

                const title = getTranslatedContent(notification.title, notification.title, notification.metadata);
                const message = getTranslatedContent(notification.message, notification.message, notification.metadata);

                return (
                  <div
                    key={notification.id}
                    className={`p-4 rounded-lg border transition-all ${!notification.is_read
                      ? 'bg-warning/10 border-warning/30'
                      : 'bg-muted/50 border-transparent'
                      }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <div className={`p-2 rounded-full ${getNotificationColor(notification.type)}`}>
                          {getNotificationIcon(notification.type)}
                        </div>

                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold">{title}</h3>
                            {!notification.is_read && (
                              <Badge variant="secondary" className="text-xs">
                                {t('list.newBadge')}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            {message}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                            </span>
                            <span className="capitalize">{notification.type}</span>
                          </div>
                        </div>
                      </div>

                      {!notification.is_read && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleMarkAsRead(notification.id)}
                          disabled={markAsRead.isPending}
                          className="h-8 w-8 p-0"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p>{t('empty.title')}</p>
              <p className="text-sm">{t('empty.description')}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
