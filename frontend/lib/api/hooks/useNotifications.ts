import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../client'

const NOTIFICATIONS_KEY = 'notifications'

export interface Notification {
  id: string
  organization_id: string
  profile_id: string
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  is_read: boolean
  metadata: any | null
  created_at: string
  read_at: string | null
}

export interface NotificationStats {
  total_count: number
  unread_count: number
  read_count: number
}

interface UseNotificationsOptions {
  refetchInterval?: number | false
  enabled?: boolean
}

export function useNotifications(unreadOnly: boolean = false, options: UseNotificationsOptions = {}) {
  const { refetchInterval = 30000, enabled = true } = options
  return useQuery({
    queryKey: [NOTIFICATIONS_KEY, unreadOnly],
    queryFn: () => {
      const params = new URLSearchParams()
      if (unreadOnly) params.append('unread_only', 'true')
      const url = params.toString() ? `/api/v1/notifications/?${params.toString()}` : '/api/v1/notifications/'
      return apiClient.get<Notification[]>(url)
    },
    refetchInterval,
    enabled,
  })
}

export function useNotificationStats(options: UseNotificationsOptions = {}) {
  const { refetchInterval = 30000, enabled = true } = options
  return useQuery({
    queryKey: [NOTIFICATIONS_KEY, 'stats'],
    queryFn: () => apiClient.get<NotificationStats>('/api/v1/notifications/stats'),
    refetchInterval,
    enabled,
  })
}

export function useMarkAsRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (notificationId: string) =>
      apiClient.patch(`/api/v1/notifications/${notificationId}/read`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [NOTIFICATIONS_KEY] })
    },
  })
}

export function useMarkAllAsRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () =>
      apiClient.patch('/api/v1/notifications/mark-all-read', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [NOTIFICATIONS_KEY] })
    },
  })
}

export function useDeleteNotification() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (notificationId: string) =>
      apiClient.delete(`/api/v1/notifications/${notificationId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [NOTIFICATIONS_KEY] })
    },
  })
}

export function useClearAllNotifications() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () =>
      apiClient.delete('/api/v1/notifications/'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [NOTIFICATIONS_KEY] })
    },
  })
}

