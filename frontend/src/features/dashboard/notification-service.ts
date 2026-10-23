import { ApiRequestError, requestJson } from '../../shared/api/client'

export type DashboardNotification = {
  id: string
  orderId: string | null
  orderNumber: string | null
  type: string
  title: string
  message: string
  createdAt: string
  readAt: string | null
}

type NotificationResponse = {
  notifications: DashboardNotification[]
}

export class NotificationRequestError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'NotificationRequestError'
    this.status = status
    this.code = code
  }
}

async function notificationRequest<T>(path: string, init?: RequestInit) {
  try {
    return await requestJson<T>(path, init)
  } catch (error) {
    if (error instanceof ApiRequestError) {
      throw new NotificationRequestError(error.status, error.code, error.message || 'The notification request failed.')
    }
    throw error
  }
}

export async function listNotifications() {
  const result = await notificationRequest<NotificationResponse>('/api/v1/notifications')
  return result.notifications
}

export async function markNotificationRead(notificationId: string) {
  await notificationRequest<{ ok: true }>(`/api/v1/notifications/${notificationId}/read`, { method: 'POST' })
}

export async function deleteNotification(notificationId: string) {
  await notificationRequest<{ ok: true }>(`/api/v1/notifications/${notificationId}`, { method: 'DELETE' })
}

export function openNotificationStream(onNotification: (notification: DashboardNotification) => void, onDisconnect: () => void) {
  const apiUrl = import.meta.env.VITE_API_BASE_URL?.trim()
  if (!apiUrl) throw new Error('The Flowline API URL is not configured.')
  const websocketUrl = apiUrl.replace(/\/$/, '').replace(/^http/, 'ws')
  const socket = new WebSocket(`${websocketUrl}/api/v1/notifications/live`)
  let disconnected = false
  let closeRequested = false
  const handleDisconnect = () => {
    if (disconnected) return
    disconnected = true
    onDisconnect()
  }
  socket.addEventListener('message', (event) => {
    try {
      const payload = JSON.parse(String(event.data)) as {
        type?: string
        notification?: DashboardNotification
      }
      if (payload.type === 'notification' && payload.notification) {
        onNotification(payload.notification)
      }
    } catch {
      // Ignore malformed live messages and keep the connection open.
    }
  })
  socket.addEventListener('close', handleDisconnect)
  socket.addEventListener('error', handleDisconnect)
  socket.addEventListener('open', () => {
    if (closeRequested) socket.close()
  })
  return () => {
    closeRequested = true
    if (socket.readyState === WebSocket.OPEN) socket.close()
  }
}
