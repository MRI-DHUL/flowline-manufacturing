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

type NotificationErrorBody = {
  error?: { code?: string; message?: string }
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

function getApiBaseUrl() {
  const value = import.meta.env.VITE_API_BASE_URL?.trim()
  if (!value) throw new Error('The Flowline API URL is not configured.')
  return value.replace(/\/$/, '')
}

async function parseResponse<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as NotificationErrorBody
  if (!response.ok) {
    throw new NotificationRequestError(
      response.status,
      body.error?.code ?? 'REQUEST_FAILED',
      body.error?.message ?? 'The notification request failed.',
    )
  }
  return body as T
}

export async function listNotifications() {
  const response = await fetch(`${getApiBaseUrl()}/api/v1/notifications`, {
    credentials: 'include',
  })
  const result = await parseResponse<NotificationResponse>(response)
  return result.notifications
}

export async function markNotificationRead(notificationId: string) {
  const response = await fetch(`${getApiBaseUrl()}/api/v1/notifications/${notificationId}/read`, {
    method: 'POST',
    credentials: 'include',
  })
  await parseResponse<{ ok: true }>(response)
}

export function openNotificationStream(
  onNotification: (notification: DashboardNotification) => void,
  onDisconnect: () => void,
) {
  const websocketUrl = getApiBaseUrl().replace(/^http/, 'ws')
  const socket = new WebSocket(`${websocketUrl}/api/v1/notifications/live`)
  let disconnected = false
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
  return () => socket.close()
}
