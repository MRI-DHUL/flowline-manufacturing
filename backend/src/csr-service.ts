import { randomUUID } from 'node:crypto'
import type pg from 'pg'
import type { AuthUser } from './auth-service.js'
import type { NotificationPublisher } from './notification-service.js'

export type OrderPatch = {
  customerName?: string | null
  destination?: string | null
  productName?: string | null
  productDescription?: string | null
  orderType?: string | null
  packagingType?: string | null
  dimensions?: string | null
  material?: string | null
  printColors?: string | null
  requestedQuantity?: number | null
  requestedDeliveryDate?: string | null
  technicalNotes?: string | null
  priority?: string | null
}

export type CsrOrderSummary = {
  id: string
  orderNumber: string
  customerName: string | null
  productName: string | null
  status: string
  stage: string
  assignedReviewer: CsrReviewer | null
  priority: string | null
  requestedDeliveryDate: string | null
  createdAt: Date
  updatedAt: Date
  openClarifications: number
}

export type CsrOrderDetail = CsrOrderSummary & {
  destination: string | null
  productDescription: string | null
  orderType: string | null
  packagingType: string | null
  dimensions: string | null
  material: string | null
  printColors: string | null
  requestedQuantity: number | null
  technicalNotes: string | null
  assignedReviewer: CsrReviewer | null
  attachments: Array<{
    id: string
    fileName: string
    mediaType: string
    sizeBytes: number
    createdAt: Date
  }>
  clarifications: Array<{
    id: string
    stage: string
    question: string
    status: string
    requestedAt: Date
    response: string | null
    respondedAt: Date | null
  }>
  activity: Array<{
    id: string
    action: string
    previousStatus: string | null
    newStatus: string | null
    reason: string | null
    details: Record<string, unknown>
    occurredAt: Date
  }>
}

export type CsrReviewer = {
  authUserId: string
  displayName: string
  email: string
}

export type CsrAttachment = {
  fileName: string
  mediaType: string
  content: Buffer
}

export interface CsrService {
  listOrders(user: AuthUser, filters: { search?: string; status?: string }): Promise<CsrOrderSummary[]>
  getOrder(user: AuthUser, orderId: string): Promise<CsrOrderDetail>
  createDraft(user: AuthUser, patch: OrderPatch): Promise<CsrOrderDetail>
  updateDraft(user: AuthUser, orderId: string, patch: OrderPatch): Promise<CsrOrderDetail>
  submitOrder(user: AuthUser, orderId: string): Promise<CsrOrderDetail>
  uploadAttachment(user: AuthUser, orderId: string, attachment: CsrAttachment): Promise<CsrOrderDetail>
  downloadAttachment(user: AuthUser, orderId: string, attachmentId: string): Promise<CsrAttachment>
  deleteAttachment(user: AuthUser, orderId: string, attachmentId: string): Promise<CsrOrderDetail>
  respondToClarification(user: AuthUser, orderId: string, clarificationId: string, response: string): Promise<CsrOrderDetail>
  listRdReviewers(user: AuthUser): Promise<CsrReviewer[]>
  assignRdReviewer(user: AuthUser, orderId: string, reviewerAuthUserId: string): Promise<CsrOrderDetail>
}

export class CsrError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly fields?: string[],
  ) {
    super(message)
    this.name = 'CsrError'
  }
}

type OrderRow = {
  id: string
  order_number: string
  customer_name: string | null
  destination: string | null
  product_name: string | null
  product_description: string | null
  order_type: string | null
  packaging_type: string | null
  dimensions: string | null
  material: string | null
  print_colors: string | null
  requested_quantity: string | null
  requested_delivery_date: string | Date | null
  technical_notes: string | null
  status: string
  stage: string
  assigned_reviewer_auth_user_id: string | null
  assigned_reviewer_display_name: string | null
  assigned_reviewer_email: string | null
  priority: string | null
  created_at: Date
  updated_at: Date
  open_clarifications: string
  owner_auth_user_id: string | null
}

const fieldsByProperty: Record<keyof OrderPatch, string> = {
  customerName: 'customer_name',
  destination: 'destination',
  productName: 'product_name',
  productDescription: 'product_description',
  orderType: 'order_type',
  packagingType: 'packaging_type',
  dimensions: 'dimensions',
  material: 'material',
  printColors: 'print_colors',
  requestedQuantity: 'requested_quantity',
  requestedDeliveryDate: 'requested_delivery_date',
  technicalNotes: 'technical_notes',
  priority: 'priority',
}

function ensureCsr(user: AuthUser) {
  if (!user.roles.includes('CSR')) {
    throw new CsrError(403, 'FORBIDDEN', 'CSR access is required.')
  }
}

function cleanValue(value: OrderPatch[keyof OrderPatch]) {
  return typeof value === 'string' ? value.trim() || null : value
}

function dateOnly(value: string | Date | null) {
  if (!value) return null
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function toSummary(row: OrderRow): CsrOrderSummary {
  return {
    id: row.id,
    orderNumber: row.order_number,
    customerName: row.customer_name,
    productName: row.product_name,
    status: row.status,
    stage: row.stage,
    assignedReviewer: row.assigned_reviewer_auth_user_id
      ? {
          authUserId: row.assigned_reviewer_auth_user_id,
          displayName: row.assigned_reviewer_display_name ?? 'Unnamed reviewer',
          email: row.assigned_reviewer_email ?? '',
        }
      : null,
    priority: row.priority,
    requestedDeliveryDate: dateOnly(row.requested_delivery_date),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    openClarifications: Number(row.open_clarifications),
  }
}

const orderSelect = `
  SELECT
    orders.*,
    MAX(reviewer.auth_user_id) AS assigned_reviewer_auth_user_id,
    MAX(reviewer.display_name) AS assigned_reviewer_display_name,
    MAX(reviewer.email) AS assigned_reviewer_email,
    count(clarification.id) FILTER (WHERE clarification.status = 'OPEN') AS open_clarifications
  FROM flowline.orders AS orders
  LEFT JOIN flowline.user_profiles AS reviewer
    ON reviewer.auth_user_id = orders.owner_auth_user_id
  LEFT JOIN flowline.clarification_requests AS clarification
    ON clarification.order_id = orders.id
`

export class PostgresCsrService implements CsrService {
  constructor(
    private readonly pool: pg.Pool,
    private readonly notificationPublisher?: NotificationPublisher,
  ) {}

  async listOrders(user: AuthUser, filters: { search?: string; status?: string }) {
    ensureCsr(user)
    const search = filters.search?.trim() || null
    const status = filters.status?.trim() || null
    const result = await this.pool.query<OrderRow>(
      `${orderSelect}
       WHERE orders.created_by_auth_user_id = $1
         AND ($2::text IS NULL OR orders.status = $2)
         AND (
           $3::text IS NULL
           OR orders.order_number ILIKE '%' || $3 || '%'
           OR COALESCE(orders.customer_name, '') ILIKE '%' || $3 || '%'
           OR COALESCE(orders.product_name, '') ILIKE '%' || $3 || '%'
         )
       GROUP BY orders.id
       ORDER BY orders.updated_at DESC
       LIMIT 100`,
      [user.id, status, search],
    )
    return result.rows.map(toSummary)
  }

  async getOrder(user: AuthUser, orderId: string): Promise<CsrOrderDetail> {
    ensureCsr(user)
    const orderResult = await this.pool.query<OrderRow>(
      `${orderSelect}
       WHERE orders.id = $1 AND orders.created_by_auth_user_id = $2
       GROUP BY orders.id`,
      [orderId, user.id],
    )
    const order = orderResult.rows[0]
    if (!order) throw new CsrError(404, 'ORDER_NOT_FOUND', 'Order not found.')

    const [attachments, reviewer, clarifications, activity] = await Promise.all([
      this.pool.query<{
        id: string
        file_name: string
        media_type: string
        size_bytes: string
        created_at: Date
      }>(
        `SELECT id, file_name, media_type, size_bytes, created_at
         FROM flowline.attachments
         WHERE order_id = $1
         ORDER BY created_at DESC`,
        [orderId],
      ),
      this.pool.query<{
        auth_user_id: string
        display_name: string
        email: string
      }>(
        `SELECT auth_user_id, display_name, email
         FROM flowline.user_profiles
         WHERE auth_user_id = $1`,
        [order.owner_auth_user_id],
      ),
      this.pool.query<{
        id: string
        stage: string
        question: string
        status: string
        requested_at: Date
        response: string | null
        responded_at: Date | null
      }>(
        `SELECT id, stage, question, status, requested_at, response, responded_at
         FROM flowline.clarification_requests
         WHERE order_id = $1
         ORDER BY requested_at DESC`,
        [orderId],
      ),
      this.pool.query<{
        id: string
        action: string
        previous_status: string | null
        new_status: string | null
        reason: string | null
        details: Record<string, unknown>
        occurred_at: Date
      }>(
        `SELECT id::text, action, previous_status, new_status, reason, details, occurred_at
         FROM flowline.audit_events
         WHERE order_id = $1
         ORDER BY occurred_at DESC`,
        [orderId],
      ),
    ])

    return {
      ...toSummary(order),
      destination: order.destination,
      productDescription: order.product_description,
      orderType: order.order_type,
      packagingType: order.packaging_type,
      dimensions: order.dimensions,
      material: order.material,
      printColors: order.print_colors,
      requestedQuantity: order.requested_quantity === null ? null : Number(order.requested_quantity),
      technicalNotes: order.technical_notes,
      assignedReviewer: reviewer.rows[0]
        ? {
            authUserId: reviewer.rows[0].auth_user_id,
            displayName: reviewer.rows[0].display_name,
            email: reviewer.rows[0].email,
          }
        : null,
      attachments: attachments.rows.map((item) => ({
        id: item.id,
        fileName: item.file_name,
        mediaType: item.media_type,
        sizeBytes: Number(item.size_bytes),
        createdAt: item.created_at,
      })),
      clarifications: clarifications.rows.map((item) => ({
        id: item.id,
        stage: item.stage,
        question: item.question,
        status: item.status,
        requestedAt: item.requested_at,
        response: item.response,
        respondedAt: item.responded_at,
      })),
      activity: activity.rows.map((item) => ({
        id: item.id,
        action: item.action,
        previousStatus: item.previous_status,
        newStatus: item.new_status,
        reason: item.reason,
        details: item.details,
        occurredAt: item.occurred_at,
      })),
    }
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
      await this.applyPatch(client, orderId, patch)
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
      if (order.status !== 'Draft' && Number(order.open_clarifications) === 0) {
        throw new CsrError(409, 'ORDER_NOT_EDITABLE', 'Only drafts or orders awaiting clarification can be edited.')
      }
      await this.applyPatch(client, orderId, patch)
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
      if (!['Draft', 'R&D Review'].includes(order.status)) {
        throw new CsrError(409, 'ORDER_NOT_SUBMITTABLE', 'This order cannot be submitted from its current status.')
      }
      if (Number(order.open_clarifications) > 0) {
        throw new CsrError(409, 'CLARIFICATION_OPEN', 'Respond to all clarification requests before resubmitting.')
      }
      const missing = this.missingSubmissionFields(order)
      if (missing.length) {
        throw new CsrError(422, 'SUBMISSION_INCOMPLETE', 'Complete all required fields before submission.', missing)
      }

      const rdRole = await client.query<{ id: string }>(
        `SELECT id FROM flowline.roles WHERE code = 'R&D'`,
      )
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
        const rdRole = await client.query<{ id: string }>(
          `SELECT id FROM flowline.roles WHERE code = 'R&D'`,
        )
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
        throw new CsrError(
          422,
          'INVALID_REVIEWER',
          'Select an active R&D reviewer.',
          ['assignedReviewerAuthUserId'],
        )
      }

      const rdRole = await client.query<{ id: string }>(
        `SELECT id::text FROM flowline.roles WHERE code = 'R&D'`,
      )
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

  private async applyPatch(client: pg.PoolClient, orderId: string, patch: OrderPatch) {
    const entries = Object.entries(patch) as Array<[keyof OrderPatch, OrderPatch[keyof OrderPatch]]>
    if (!entries.length) return
    const assignments: string[] = []
    const values: unknown[] = [orderId]
    for (const [property, value] of entries) {
      values.push(cleanValue(value))
      assignments.push(`${fieldsByProperty[property]} = $${values.length}`)
    }
    await client.query(
      `UPDATE flowline.orders SET ${assignments.join(', ')}, version = version + 1 WHERE id = $1`,
      values,
    )
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