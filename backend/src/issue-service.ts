import type pg from 'pg'
import type { AuthUser } from './auth-service.js'
import type { NotificationItem, NotificationPublisher } from './notification-service.js'

export type ReportedOrderIssue = {
  id: string
  orderId: string
  orderNumber: string
  message: string
  status: 'OPEN'
  reportedAt: Date
  recipientCount: number
}

export interface IssueService {
  report(user: AuthUser, orderId: string, message: string): Promise<ReportedOrderIssue>
}

export class IssueError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'IssueError'
  }
}

type OrderAccessRow = {
  id: string
  order_number: string
  created_by_auth_user_id: string
  owner_auth_user_id: string | null
  participated: boolean
}

export class PostgresIssueService implements IssueService {
  constructor(
    private readonly pool: pg.Pool,
    private readonly notificationPublisher?: NotificationPublisher,
  ) {}

  async report(user: AuthUser, orderId: string, rawMessage: string) {
    if (user.status !== 'ACTIVE') throw new IssueError(403, 'FORBIDDEN', 'Active account access is required.')
    const message = rawMessage.trim()
    if (message.length < 10 || message.length > 2000) {
      throw new IssueError(422, 'ISSUE_MESSAGE_INVALID', 'Describe the issue in 10 to 2000 characters.')
    }

    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const orderResult = await client.query<OrderAccessRow>(
        `SELECT orders.id, orders.order_number, orders.created_by_auth_user_id,
                orders.owner_auth_user_id,
                (
                  orders.created_by_auth_user_id = $2
                  OR orders.owner_auth_user_id = $2
                  OR EXISTS (
                    SELECT 1 FROM flowline.audit_events audit
                    WHERE audit.order_id = orders.id AND audit.actor_auth_user_id = $2
                  )
                  OR EXISTS (
                    SELECT 1 FROM flowline.technical_reviews review
                    WHERE review.order_id = orders.id AND review.reviewer_auth_user_id = $2
                  )
                  OR EXISTS (
                    SELECT 1 FROM flowline.planning_reviews review
                    WHERE review.order_id = orders.id AND review.planner_auth_user_id = $2
                  )
                  OR EXISTS (
                    SELECT 1 FROM flowline.production_runs run
                    WHERE run.order_id = orders.id AND run.operator_auth_user_id = $2
                  )
                  OR EXISTS (
                    SELECT 1 FROM flowline.shipments shipment
                    WHERE shipment.order_id = orders.id AND shipment.created_by_auth_user_id = $2
                  )
                ) AS participated
         FROM flowline.orders AS orders
         WHERE orders.id = $1
         FOR UPDATE`,
        [orderId, user.id],
      )
      const order = orderResult.rows[0]
      if (!order) throw new IssueError(404, 'ORDER_NOT_FOUND', 'Order not found.')
      if (!order.participated && !user.roles.includes('MANAGER')) {
        throw new IssueError(403, 'FORBIDDEN', 'You can report issues only for orders assigned to or handled by you.')
      }

      const recipients = await client.query<{ auth_user_id: string }>(
        `SELECT DISTINCT profile.auth_user_id
         FROM flowline.user_profiles AS profile
         WHERE profile.status = 'ACTIVE'
           AND profile.auth_user_id <> $2
           AND (
             profile.auth_user_id = $3
             OR EXISTS (
               SELECT 1 FROM flowline.audit_events audit
               WHERE audit.order_id = $1
                 AND audit.new_status IS NOT NULL
                 AND audit.actor_auth_user_id = profile.auth_user_id
             )
             OR EXISTS (
               SELECT 1 FROM flowline.technical_reviews review
               WHERE review.order_id = $1
                 AND review.reviewer_auth_user_id = profile.auth_user_id
             )
             OR EXISTS (
               SELECT 1 FROM flowline.planning_reviews review
               WHERE review.order_id = $1
                 AND review.planner_auth_user_id = profile.auth_user_id
             )
             OR EXISTS (
               SELECT 1 FROM flowline.production_runs run
               WHERE run.order_id = $1
                 AND run.operator_auth_user_id = profile.auth_user_id
             )
             OR EXISTS (
               SELECT 1 FROM flowline.shipments shipment
               WHERE shipment.order_id = $1
                 AND shipment.created_by_auth_user_id = profile.auth_user_id
             )
             OR EXISTS (
               SELECT 1
               FROM flowline.user_roles user_role
               JOIN flowline.roles role ON role.id = user_role.role_id
               WHERE user_role.user_profile_id = profile.id AND role.code = 'MANAGER'
             )
           )
         ORDER BY profile.auth_user_id`,
        [orderId, user.id, order.created_by_auth_user_id],
      )
      if (!recipients.rows.length) {
        throw new IssueError(422, 'NO_ESCALATION_RECIPIENTS', 'No active escalation recipients are configured for this order.')
      }

      const issueResult = await client.query<{ id: string; reported_at: Date }>(
        `INSERT INTO flowline.order_issues (order_id, message, reported_by_auth_user_id)
         VALUES ($1, $2, $3)
         RETURNING id, reported_at`,
        [orderId, message, user.id],
      )
      const issue = issueResult.rows[0]
      if (!issue) throw new Error('Issue insert did not return a row')

      const notificationResult = await client.query<{ id: string; created_at: Date }>(
        `INSERT INTO flowline.notifications (order_id, type, title, message)
         VALUES ($1, 'ORDER_ISSUE_REPORTED', $2, $3)
         RETURNING id, created_at`,
        [orderId, `Issue reported for ${order.order_number}`, `${user.displayName}: ${message}`],
      )
      const notification = notificationResult.rows[0]
      if (!notification) throw new Error('Notification insert did not return a row')

      for (const recipient of recipients.rows) {
        await client.query(
          `INSERT INTO flowline.order_issue_recipients (issue_id, recipient_auth_user_id)
           VALUES ($1, $2)`,
          [issue.id, recipient.auth_user_id],
        )
        await client.query(
          `INSERT INTO flowline.notification_recipients (notification_id, recipient_auth_user_id)
           VALUES ($1, $2)`,
          [notification.id, recipient.auth_user_id],
        )
      }
      await client.query(
        `INSERT INTO flowline.audit_events (
           order_id, actor_auth_user_id, action, reason, details
         ) VALUES ($1, $2, 'ORDER_ISSUE_REPORTED', $3,
           jsonb_build_object('issueId', $4::text, 'recipientCount', $5::int))`,
        [orderId, user.id, message, issue.id, recipients.rows.length],
      )
      await client.query('COMMIT')

      const notificationItem: NotificationItem = {
        id: notification.id,
        orderId,
        orderNumber: order.order_number,
        type: 'ORDER_ISSUE_REPORTED',
        title: `Issue reported for ${order.order_number}`,
        message: `${user.displayName}: ${message}`,
        createdAt: notification.created_at,
        readAt: null,
      }
      for (const recipient of recipients.rows) {
        this.notificationPublisher?.publish(recipient.auth_user_id, notificationItem)
      }

      return {
        id: issue.id,
        orderId,
        orderNumber: order.order_number,
        message,
        status: 'OPEN' as const,
        reportedAt: issue.reported_at,
        recipientCount: recipients.rows.length,
      }
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }
}
