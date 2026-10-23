import { randomUUID } from 'node:crypto'
import type pg from 'pg'
import type { AuthUser } from '../auth/auth-service.js'
import type { NotificationPublisher } from '../notifications/notification-service.js'
import { PostgresCsrReadService } from './csr-read-service.js'
import { applyPatch, ensureCsr } from './csr-write-helpers.js'
import type { CsrOrderRow as OrderRow } from './csr-write-helpers.js'
export type { CsrAttachment, CsrOrderDetail, CsrOrderStatusRow, CsrOrderSummary, CsrReviewer, CsrService, OrderPatch } from './csr-service-types.js'
export { CsrError } from './csr-service-types.js'
import type { CsrAttachment, CsrOrderDetail, CsrService, OrderPatch } from './csr-service-types.js'
import { CsrError } from './csr-service-types.js'

export class PostgresCsrService extends PostgresCsrReadService implements CsrService {
  constructor(
    pool: pg.Pool,
    private readonly notificationPublisher?: NotificationPublisher,
  ) {
    super(pool)
  }

  async createDraft(user: AuthUser, patch: OrderPatch) {
    ensureCsr(user)
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const created = await client.query<{ id: string }>(
        `INSERT INTO flowline.orders (status, stage, created_by_auth_user_id)
         VALUES ('Draft', 'CSR', $1)
         RETURNING id`,
        [user.id],
      )
      const orderId = created.rows[0]?.id
      if (!orderId) throw new Error('Draft creation returned no row')
      await applyPatch(client, orderId, patch)
      await client.query(
        `INSERT INTO flowline.audit_events (order_id, actor_auth_user_id, action, new_status)
         VALUES ($1, $2, 'ORDER_DRAFT_CREATED', 'Draft')`,
        [orderId, user.id],
      )
      await client.query('COMMIT')
      return this.getOrder(user, orderId)
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  async updateDraft(user: AuthUser, orderId: string, patch: OrderPatch) {
    ensureCsr(user)
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const owned = await client.query<{ status: string; open_clarifications: string }>(
        `SELECT orders.status,
          count(clarification.id) FILTER (WHERE clarification.status = 'OPEN') AS open_clarifications
         FROM flowline.orders AS orders
         LEFT JOIN flowline.clarification_requests AS clarification ON clarification.order_id = orders.id
         WHERE orders.id = $1 AND orders.created_by_auth_user_id = $2
         GROUP BY orders.id`,
        [orderId, user.id],
      )
      const order = owned.rows[0]
      if (!order) throw new CsrError(404, 'ORDER_NOT_FOUND', 'Order not found.')
      const rejection = await client.query(
        `SELECT 1 FROM flowline.technical_reviews
         WHERE order_id = $1 AND decision = 'REJECTED'
         LIMIT 1`,
        [orderId],
      )
      const rejectedForRecovery = order.status === 'Cancelled' && rejection.rows.length > 0
      if (order.status !== 'Draft' && Number(order.open_clarifications) === 0 && !rejectedForRecovery) {
        throw new CsrError(409, 'ORDER_NOT_EDITABLE', 'Only drafts or orders awaiting clarification can be edited.')
      }
      await applyPatch(client, orderId, patch)
      await client.query(
        `INSERT INTO flowline.audit_events (order_id, actor_auth_user_id, action, previous_status, new_status)
         VALUES ($1, $2, 'ORDER_UPDATED', $3, $3)`,
        [orderId, user.id, order.status],
      )
      await client.query('COMMIT')
      return this.getOrder(user, orderId)
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  async submitOrder(user: AuthUser, orderId: string) {
    ensureCsr(user)
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const result = await client.query<OrderRow>(
        `SELECT orders.*, '0'::text AS open_clarifications
         FROM flowline.orders AS orders
         WHERE orders.id = $1 AND orders.created_by_auth_user_id = $2
         FOR UPDATE`,
        [orderId, user.id],
      )
      const order = result.rows[0]
      if (!order) throw new CsrError(404, 'ORDER_NOT_FOUND', 'Order not found.')
      const clarificationResult = await client.query<{ count: string }>(
        `SELECT count(*) AS count
         FROM flowline.clarification_requests
         WHERE order_id = $1 AND status = 'OPEN'`,
        [orderId],
      )
      order.open_clarifications = clarificationResult.rows[0]?.count ?? '0'
      const rejectedForRecovery =
        order.status === 'Cancelled' &&
        (
          await client.query(
            `SELECT 1 FROM flowline.technical_reviews
         WHERE order_id = $1 AND decision = 'REJECTED'
         LIMIT 1`,
            [orderId],
          )
        ).rows.length > 0
      if (!['Draft', 'R&D Review'].includes(order.status) && !rejectedForRecovery) {
        throw new CsrError(409, 'ORDER_NOT_SUBMITTABLE', 'This order cannot be submitted from its current status.')
      }
      if (Number(order.open_clarifications) > 0) {
        throw new CsrError(409, 'CLARIFICATION_OPEN', 'Respond to all clarification requests before resubmitting.')
      }
      const missing = this.missingSubmissionFields(order)
      if (missing.length) {
        throw new CsrError(422, 'SUBMISSION_INCOMPLETE', 'Complete all required fields before submission.', missing)
      }

      const rdRole = await client.query<{ id: string }>(`SELECT id FROM flowline.roles WHERE code = 'R&D'`)
      const previousStatus = order.status
      await client.query(
        `UPDATE flowline.orders
         SET status = 'R&D Review', stage = 'R&D', owner_role_id = $2, version = version + 1
         WHERE id = $1`,
        [orderId, rdRole.rows[0]?.id ?? null],
      )
      await client.query(
        `INSERT INTO flowline.order_revisions (
           order_id, revision_number, snapshot, reason, created_by_auth_user_id
         )
         SELECT id, version, to_jsonb(orders), 'Submitted for R&D review', $2
         FROM flowline.orders WHERE id = $1`,
        [orderId, user.id],
      )
      await client.query(
        `INSERT INTO flowline.audit_events (
           order_id, actor_auth_user_id, action, previous_status, new_status
         ) VALUES ($1, $2, 'ORDER_SUBMITTED', $3, 'R&D Review')`,
        [orderId, user.id, previousStatus],
      )
      const notificationResult = await client.query<{
        id: string
        order_id: string
        type: string
        title: string
        message: string
        created_at: Date
      }>(
        `WITH notification AS (
           INSERT INTO flowline.notifications (order_id, type, title, message)
           VALUES ($1, 'ORDER_SUBMITTED', 'New order ready for R&D review',
                   'Order ' || $2 || ' has been submitted for technical review.')
           RETURNING id, order_id, type, title, message, created_at
         ), recipient AS (
           INSERT INTO flowline.notification_recipients (notification_id, recipient_auth_user_id)
           SELECT notification.id, $3
           FROM notification
           RETURNING notification_id
         )
         SELECT notification.id, notification.order_id, notification.type,
                notification.title, notification.message, notification.created_at
         FROM notification
         JOIN recipient ON recipient.notification_id = notification.id`,
        [orderId, order.order_number, order.owner_auth_user_id],
      )
      await client.query('COMMIT')
      const notification = notificationResult.rows[0]
      if (notification && order.owner_auth_user_id) {
        this.notificationPublisher?.publish(order.owner_auth_user_id, {
          id: notification.id,
          orderId: notification.order_id,
          orderNumber: order.order_number,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          createdAt: notification.created_at,
          readAt: null,
        })
      }
      return this.getOrder(user, orderId)
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  async uploadAttachment(user: AuthUser, orderId: string, attachment: CsrAttachment) {
    ensureCsr(user)
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const owned = await client.query(
        `SELECT 1 FROM flowline.orders
         WHERE id = $1 AND created_by_auth_user_id = $2
         FOR UPDATE`,
        [orderId, user.id],
      )
      if (!owned.rowCount) throw new CsrError(404, 'ORDER_NOT_FOUND', 'Order not found.')
      await client.query(
        `INSERT INTO flowline.attachments (
           order_id, related_entity_type, file_name, media_type, size_bytes,
           storage_key, uploaded_by_auth_user_id, content
         ) VALUES ($1, 'ORDER', $2, $3, $4, $5, $6, $7)`,
        [orderId, attachment.fileName, attachment.mediaType, attachment.content.length, randomUUID(), user.id, attachment.content],
      )
      await client.query(
        `INSERT INTO flowline.audit_events (order_id, actor_auth_user_id, action, details)
         VALUES ($1, $2, 'ATTACHMENT_ADDED', jsonb_build_object('fileName', $3::text))`,
        [orderId, user.id, attachment.fileName],
      )
      await client.query('COMMIT')
      return this.getOrder(user, orderId)
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  async downloadAttachment(user: AuthUser, orderId: string, attachmentId: string) {
    ensureCsr(user)
    const result = await this.pool.query<{
      file_name: string
      media_type: string
      content: Buffer | null
    }>(
      `SELECT attachment.file_name, attachment.media_type, attachment.content
       FROM flowline.attachments AS attachment
       JOIN flowline.orders AS orders ON orders.id = attachment.order_id
       WHERE attachment.id = $1 AND orders.id = $2 AND orders.created_by_auth_user_id = $3`,
      [attachmentId, orderId, user.id],
    )
    const attachment = result.rows[0]
    if (!attachment?.content) throw new CsrError(404, 'ATTACHMENT_NOT_FOUND', 'Attachment not found.')
    return { fileName: attachment.file_name, mediaType: attachment.media_type, content: attachment.content }
  }

  async deleteAttachment(user: AuthUser, orderId: string, attachmentId: string) {
    ensureCsr(user)
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const deleted = await client.query(
        `DELETE FROM flowline.attachments AS attachment
         USING flowline.orders AS orders
         WHERE attachment.id = $1 AND attachment.order_id = orders.id
           AND orders.id = $2 AND orders.created_by_auth_user_id = $3
           AND orders.status = 'Draft'`,
        [attachmentId, orderId, user.id],
      )
      if (deleted.rowCount !== 1) {
        throw new CsrError(404, 'ATTACHMENT_NOT_FOUND', 'Draft attachment not found.')
      }
      await client.query(
        `INSERT INTO flowline.audit_events (order_id, actor_auth_user_id, action)
         VALUES ($1, $2, 'ATTACHMENT_REMOVED')`,
        [orderId, user.id],
      )
      await client.query('COMMIT')
      return this.getOrder(user, orderId)
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  async respondToClarification(user: AuthUser, orderId: string, clarificationId: string, response: string) {
    ensureCsr(user)
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const clarification = await client.query<{
        requested_by_auth_user_id: string
        stage: string
        order_number: string
        order_status: string
      }>(
        `SELECT clarification.requested_by_auth_user_id, clarification.stage,
                orders.order_number, orders.status AS order_status
         FROM flowline.clarification_requests AS clarification
         JOIN flowline.orders AS orders ON orders.id = clarification.order_id
         WHERE clarification.id = $1 AND clarification.order_id = $2
           AND orders.created_by_auth_user_id = $3
           AND clarification.status = 'OPEN'
         FOR UPDATE OF clarification, orders`,
        [clarificationId, orderId, user.id],
      )
      const request = clarification.rows[0]
      if (!request) {
        throw new CsrError(404, 'CLARIFICATION_NOT_FOUND', 'Open clarification request not found.')
      }
      const updated = await client.query(
        `UPDATE flowline.clarification_requests
         SET status = 'RESOLVED', response = $2,
           responded_by_auth_user_id = $3, responded_at = clock_timestamp()
         WHERE id = $1 AND status = 'OPEN'`,
        [clarificationId, response.trim(), user.id],
      )
      if (updated.rowCount !== 1) {
        throw new CsrError(404, 'CLARIFICATION_NOT_FOUND', 'Open clarification request not found.')
      }
      await client.query(
        `INSERT INTO flowline.audit_events (order_id, actor_auth_user_id, action, details)
         VALUES ($1, $2, 'CLARIFICATION_RESPONDED', jsonb_build_object('clarificationId', $3::text))`,
        [orderId, user.id, clarificationId],
      )
      let notificationId: string | null = null
      if (request.stage === 'R&D') {
        const rdRole = await client.query<{ id: string }>(`SELECT id FROM flowline.roles WHERE code = 'R&D'`)
        await client.query(
          `UPDATE flowline.orders
           SET status = 'R&D Review', stage = 'R&D', owner_role_id = $2,
               owner_auth_user_id = $3, version = version + 1
           WHERE id = $1`,
          [orderId, rdRole.rows[0]?.id ?? null, request.requested_by_auth_user_id],
        )
        await client.query(
          `INSERT INTO flowline.audit_events (
             order_id, actor_auth_user_id, action, previous_status, new_status, details
           ) VALUES ($1, $2, 'ORDER_REASSIGNED_TO_R&D', $3, 'R&D Review',
             jsonb_build_object('reviewerAuthUserId', $4::text))`,
          [orderId, user.id, request.order_status, request.requested_by_auth_user_id],
        )
        const notification = await client.query<{ id: string }>(
          `WITH notification AS (
             INSERT INTO flowline.notifications (order_id, type, title, message)
             VALUES ($1, 'CSR_CLARIFICATION_RESPONDED', 'Clarification response received',
                     'Order ' || $2 || ' has been returned for R&D review.')
             RETURNING id
           )
           INSERT INTO flowline.notification_recipients (notification_id, recipient_auth_user_id)
           SELECT id, $3 FROM notification
           RETURNING notification_id AS id`,
          [orderId, request.order_number, request.requested_by_auth_user_id],
        )
        notificationId = notification.rows[0]?.id ?? null
      }
      await client.query('COMMIT')
      if (notificationId) {
        this.notificationPublisher?.publish(request.requested_by_auth_user_id, {
          id: notificationId,
          orderId,
          orderNumber: request.order_number,
          type: 'CSR_CLARIFICATION_RESPONDED',
          title: 'Clarification response received',
          message: `Order ${request.order_number} has been returned for R&D review.`,
          createdAt: new Date(),
          readAt: null,
        })
      }
      return this.getOrder(user, orderId)
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  async listRdReviewers(user: AuthUser) {
    ensureCsr(user)
    const result = await this.pool.query<{
      auth_user_id: string
      display_name: string
      email: string
    }>(
      `SELECT profile.auth_user_id, profile.display_name, profile.email
       FROM flowline.user_profiles AS profile
       JOIN flowline.user_roles AS user_role ON user_role.user_profile_id = profile.id
       JOIN flowline.roles AS role ON role.id = user_role.role_id
       WHERE profile.status = 'ACTIVE' AND role.code = 'R&D'
       ORDER BY profile.display_name, profile.email`,
    )
    return result.rows.map((reviewer) => ({
      authUserId: reviewer.auth_user_id,
      displayName: reviewer.display_name,
      email: reviewer.email,
    }))
  }

  async assignRdReviewer(user: AuthUser, orderId: string, reviewerAuthUserId: string) {
    ensureCsr(user)
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const order = await client.query<{ status: string }>(
        `SELECT status FROM flowline.orders
         WHERE id = $1 AND created_by_auth_user_id = $2
         FOR UPDATE`,
        [orderId, user.id],
      )
      if (!order.rows[0]) throw new CsrError(404, 'ORDER_NOT_FOUND', 'Order not found.')
      if (!['Draft', 'R&D Review'].includes(order.rows[0].status)) {
        throw new CsrError(409, 'ORDER_NOT_ASSIGNABLE', 'The R&D reviewer cannot be changed at this stage.')
      }

      const reviewer = await client.query<{ auth_user_id: string }>(
        `SELECT profile.auth_user_id
         FROM flowline.user_profiles AS profile
         JOIN flowline.user_roles AS user_role ON user_role.user_profile_id = profile.id
         JOIN flowline.roles AS role ON role.id = user_role.role_id
         WHERE profile.auth_user_id = $1
           AND profile.status = 'ACTIVE'
           AND role.code = 'R&D'`,
        [reviewerAuthUserId],
      )
      if (!reviewer.rows[0]) {
        throw new CsrError(422, 'INVALID_REVIEWER', 'Select an active R&D reviewer.', ['assignedReviewerAuthUserId'])
      }

      const rdRole = await client.query<{ id: string }>(`SELECT id::text FROM flowline.roles WHERE code = 'R&D'`)
      await client.query(
        `UPDATE flowline.orders
         SET owner_auth_user_id = $2, owner_role_id = $3, version = version + 1
         WHERE id = $1`,
        [orderId, reviewerAuthUserId, rdRole.rows[0]?.id ?? null],
      )
      await client.query(
        `INSERT INTO flowline.audit_events (order_id, actor_auth_user_id, action, details)
         VALUES ($1, $2, 'ORDER_ASSIGNED_TO_R&D', jsonb_build_object('reviewerAuthUserId', $3::text))`,
        [orderId, user.id, reviewerAuthUserId],
      )
      await client.query('COMMIT')
      return this.getOrder(user, orderId)
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  private missingSubmissionFields(order: OrderRow) {
    const missing: string[] = []
    if (!order.customer_name) missing.push('customerName')
    if (!order.product_name) missing.push('productName')
    if (!order.packaging_type) missing.push('packagingType')
    if (!order.material) missing.push('material')
    if (!order.requested_quantity || Number(order.requested_quantity) <= 0) missing.push('requestedQuantity')
    if (!order.requested_delivery_date) missing.push('requestedDeliveryDate')
    if (!order.owner_auth_user_id) missing.push('assignedReviewerAuthUserId')
    return missing
  }
}
