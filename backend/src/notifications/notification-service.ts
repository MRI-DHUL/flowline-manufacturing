import type pg from 'pg'
import type { WebSocket } from 'ws'
import type { AuthUser } from '../auth/auth-service.js'
import type { EmailNotificationService } from './email-notification-service.js'

export type NotificationItem = {
  id: string
  orderId: string | null
  orderNumber: string | null
  type: string
  title: string
  message: string
  createdAt: Date
  readAt: Date | null
}

export interface NotificationPublisher {
  publish(userId: string, notification: NotificationItem): void
}

export class NotificationHub implements NotificationPublisher {
  private readonly connections = new Map<string, Set<WebSocket>>()

  constructor(private readonly emailService?: EmailNotificationService) {}

  subscribe(userId: string, socket: WebSocket) {
    const userConnections = this.connections.get(userId) ?? new Set<WebSocket>()
    userConnections.add(socket)
    this.connections.set(userId, userConnections)
    return () => {
      userConnections.delete(socket)
      if (!userConnections.size) this.connections.delete(userId)
    }
  }

  publish(userId: string, notification: NotificationItem) {
    void this.emailService?.sendToUser(userId, notification).catch((error: unknown) => {
      console.error('Notification email delivery failed', error)
    })
    const userConnections = this.connections.get(userId)
    if (!userConnections) return
    const payload = JSON.stringify({ type: 'notification', notification })
    for (const socket of userConnections) {
      if (socket.readyState === 1) socket.send(payload)
    }
  }
}

export interface NotificationService {
  listForUser(user: AuthUser): Promise<NotificationItem[]>
  markRead(user: AuthUser, notificationId: string): Promise<void>
  deleteForUser(user: AuthUser, notificationId: string): Promise<void>
}

export class NotificationError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'NotificationError'
  }
}

function ensureActive(user: AuthUser) {
  if (user.status !== 'ACTIVE') {
    throw new NotificationError(403, 'FORBIDDEN', 'Active account access is required.')
  }
}

export class PostgresNotificationService implements NotificationService {
  constructor(private readonly pool: pg.Pool) {}

  async listForUser(user: AuthUser) {
    ensureActive(user)
    const result = await this.pool.query<{
      id: string
      order_id: string | null
      order_number: string | null
      type: string
      title: string
      message: string
      created_at: Date
      read_at: Date | null
    }>(
      `SELECT notification.id, notification.order_id, orders.order_number,
              notification.type, notification.title, notification.message,
              notification.created_at, recipient.read_at
       FROM flowline.notification_recipients AS recipient
       JOIN flowline.notifications AS notification ON notification.id = recipient.notification_id
       LEFT JOIN flowline.orders AS orders ON orders.id = notification.order_id
       WHERE (recipient.recipient_auth_user_id = $1
          OR EXISTS (
            SELECT 1
            FROM flowline.user_profiles AS profile
            JOIN flowline.user_roles AS user_role ON user_role.user_profile_id = profile.id
            WHERE profile.auth_user_id = $1
              AND profile.status = 'ACTIVE'
              AND user_role.role_id = recipient.recipient_role_id
          ))
         AND recipient.hidden_at IS NULL
         AND notification.status = 'ACTIVE'
       ORDER BY recipient.read_at NULLS FIRST, notification.created_at DESC
      LIMIT 200`,
      [user.id],
    )
    return result.rows.map((item) => ({
      id: item.id,
      orderId: item.order_id,
      orderNumber: item.order_number,
      type: item.type,
      title: item.title,
      message: item.message,
      createdAt: item.created_at,
      readAt: item.read_at,
    }))
  }

  async markRead(user: AuthUser, notificationId: string) {
    ensureActive(user)
    const result = await this.pool.query(
      `UPDATE flowline.notification_recipients AS recipient
       SET read_at = COALESCE(recipient.read_at, clock_timestamp())
       FROM flowline.notifications AS notification
       WHERE recipient.notification_id = notification.id
         AND notification.id = $1
         AND (recipient.recipient_auth_user_id = $2
           OR EXISTS (
             SELECT 1
             FROM flowline.user_profiles AS profile
             JOIN flowline.user_roles AS user_role ON user_role.user_profile_id = profile.id
             WHERE profile.auth_user_id = $2
               AND profile.status = 'ACTIVE'
               AND user_role.role_id = recipient.recipient_role_id
           ))
         AND notification.status = 'ACTIVE'`,
      [notificationId, user.id],
    )
    if (!result.rowCount) {
      throw new NotificationError(404, 'NOTIFICATION_NOT_FOUND', 'Notification not found.')
    }
  }

  async deleteForUser(user: AuthUser, notificationId: string) {
    ensureActive(user)
    const result = await this.pool.query(
      `UPDATE flowline.notification_recipients AS recipient
       SET hidden_at = COALESCE(recipient.hidden_at, clock_timestamp())
       FROM flowline.notifications AS notification
       WHERE recipient.notification_id = notification.id
         AND notification.id = $1
         AND (recipient.recipient_auth_user_id = $2
           OR EXISTS (
             SELECT 1
             FROM flowline.user_profiles AS profile
             JOIN flowline.user_roles AS user_role ON user_role.user_profile_id = profile.id
             WHERE profile.auth_user_id = $2
               AND profile.status = 'ACTIVE'
               AND user_role.role_id = recipient.recipient_role_id
           ))
         AND notification.status = 'ACTIVE'`,
      [notificationId, user.id],
    )
    if (!result.rowCount) {
      throw new NotificationError(404, 'NOTIFICATION_NOT_FOUND', 'Notification not found.')
    }
  }
}
