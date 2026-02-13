'use client'

import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

const NOTIFICATIONS_KEY = 'notifications'
const IS_DEV = process.env.NODE_ENV !== 'production'

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error'
type WindowWithWsManager = Window & { __SAFE_TASKS_WS_MANAGER__?: WebSocketManager }

interface NotificationMessage {
    type: 'notification' | 'connected'
    action?: 'new' | 'refresh' | 'deleted' | 'read'
    data?: {
        id: string
        title: string
        message: string
        type: string
        is_read: boolean
        created_at: string
        metadata?: Record<string, unknown>
    }
    message?: string
}

interface UseNotificationWebSocketOptions {
    /** Enable/disable the WebSocket connection */
    enabled?: boolean
    /** Callback when a new notification is received */
    onNotification?: (notification: NotificationMessage['data']) => void
}

// --- Singleton Connection Manager ---

class WebSocketManager {
    private static instance: WebSocketManager
    private ws: WebSocket | null = null
    private listeners: Set<(status: ConnectionStatus) => void> = new Set()
    private messageListeners: Set<(msg: NotificationMessage) => void> = new Set()
    private status: ConnectionStatus = 'disconnected'
    private reconnectTimeout: NodeJS.Timeout | null = null
    private pingInterval: NodeJS.Timeout | null = null
    private reconnectAttempts = 0
    private refCount = 0

    private constructor() {
        if (typeof window !== 'undefined') {
            // Reconnect on visibility change
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible' && this.refCount > 0) {
                    if (this.status === 'disconnected' || this.status === 'error') {
                        this.reconnectAttempts = 0
                        this.connect()
                    }
                }
            })
        }
    }

    public static getInstance(): WebSocketManager {
        if (typeof window === 'undefined') {
            return new WebSocketManager()
        }

        const windowWithWsManager = window as WindowWithWsManager
        if (!windowWithWsManager.__SAFE_TASKS_WS_MANAGER__) {
            windowWithWsManager.__SAFE_TASKS_WS_MANAGER__ = new WebSocketManager()
        }
        return windowWithWsManager.__SAFE_TASKS_WS_MANAGER__
    }

    public subscribe(
        onStatusChange: (status: ConnectionStatus) => void,
        onMessage: (msg: NotificationMessage) => void
    ) {
        this.listeners.add(onStatusChange)
        this.messageListeners.add(onMessage)
        this.refCount++

        // Notify current status immediately
        onStatusChange(this.status)

        // Connect if first subscriber
        if (this.refCount === 1) {
            this.connect()
        }

        return () => {
            this.listeners.delete(onStatusChange)
            this.messageListeners.delete(onMessage)
            this.refCount--

            if (this.refCount === 0) {
                this.disconnect()
            }
        }
    }

    private updateStatus(newStatus: ConnectionStatus) {
        if (this.status !== newStatus) {
            this.status = newStatus
            this.listeners.forEach(listener => listener(newStatus))
        }
    }

    private async getWebSocketUrl() {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()

        if (!session?.access_token) return null

        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
        const wsProtocol = backendUrl.startsWith('https') ? 'wss' : 'ws'
        const wsHost = backendUrl.replace(/^https?:\/\//, '')

        return `${wsProtocol}://${wsHost}/ws/notifications?token=${session.access_token}`
    }

    private async connect() {
        if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) return

        this.updateStatus('connecting')

        const wsUrl = await this.getWebSocketUrl()
        if (!wsUrl) {
            this.updateStatus('disconnected')
            return
        }

        try {
            this.ws = new WebSocket(wsUrl)

            this.ws.onopen = () => {
                if (IS_DEV) {
                    console.log('[WS] Notifications WebSocket connected')
                }
                this.updateStatus('connected')
                this.reconnectAttempts = 0
                this.startPing()
            }

            this.ws.onmessage = (event) => {
                try {
                    const message: NotificationMessage = JSON.parse(event.data)
                    this.messageListeners.forEach(listener => listener(message))
                } catch (e) {
                    if (IS_DEV) {
                        console.warn('[WS] Failed to parse message:', e)
                    }
                }
            }

            this.ws.onclose = (event) => {
                if (IS_DEV) {
                    console.log('[WS] WebSocket closed:', event.code, event.reason)
                }
                this.updateStatus('disconnected')
                this.ws = null
                this.stopPing()

                // Auto-reconnect if we still have subscribers
                if (this.refCount > 0 && this.reconnectAttempts < 10) {
                    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000)
                    this.reconnectAttempts++
                    if (IS_DEV) {
                        console.log(`[WS] Reconnecting in ${delay}ms...`)
                    }
                    this.reconnectTimeout = setTimeout(() => this.connect(), delay)
                }
            }

            this.ws.onerror = (error) => {
                if (IS_DEV) {
                    console.error('[WS] Error:', error)
                }
                this.updateStatus('error')
            }

        } catch (e) {
            if (IS_DEV) {
                console.error('[WS] Create failed:', e)
            }
            this.updateStatus('error')
        }
    }

    private disconnect() {
        if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout)
        this.stopPing()

        if (this.ws) {
            this.ws.close()
            this.ws = null
        }
        this.updateStatus('disconnected')
    }

    private startPing() {
        this.stopPing()
        this.pingInterval = setInterval(() => {
            if (this.ws?.readyState === WebSocket.OPEN) {
                this.ws.send('ping')
            }
        }, 25000)
    }

    private stopPing() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval)
            this.pingInterval = null
        }
    }
}

// --- Hook Wrapper ---

export function useNotificationWebSocket(options: UseNotificationWebSocketOptions = {}) {
    const { enabled = true, onNotification } = options
    const queryClient = useQueryClient()
    const [status, setStatus] = useState<ConnectionStatus>('disconnected')

    useEffect(() => {
        if (!enabled) return

        const manager = WebSocketManager.getInstance()

        const unsubscribe = manager.subscribe(
            (newStatus) => setStatus(newStatus),
            (message) => {
                if (message.type === 'connected') {
                    if (IS_DEV) {
                        console.log('[WS] Server confirmed connection:', message.message)
                    }
                    return
                }

                if (message.type === 'notification') {
                    if (IS_DEV) {
                        console.log('[WS] Received notification:', message.action)
                    }
                    // Invalidate queries globally for any listener
                    queryClient.invalidateQueries({ queryKey: [NOTIFICATIONS_KEY] })

                    if (message.action === 'new' && message.data && onNotification) {
                        onNotification(message.data)
                    }
                }
            }
        )

        return unsubscribe
    }, [enabled, queryClient, onNotification])

    return {
        status,
        isConnected: status === 'connected',
    }
}
