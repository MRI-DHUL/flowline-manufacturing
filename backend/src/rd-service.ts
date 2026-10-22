import type pg from 'pg'
import type { AuthUser } from './auth-service.js'
import type { NotificationPublisher } from './notification-service.js'

export type RdOrderSummary = {
  id: string
  orderNumber: string
  customerName: string | null
  productName: string | null
  status: string
  stage: string
  priority: string | null
  requestedDeliveryDate: string | null
  createdAt: Date
  updatedAt: Date
  openClarifications: number
}

export type RdOrderDetail = RdOrderSummary & {
  destination: string | null
  productDescription: string | null
  orderType: string | null
  packagingType: string | null
  dimensions: string | null
  material: string | null
  printColors: string | null
  requestedQuantity: number | null
  technicalNotes: string | null
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
  technicalReviews: Array<{
    id: string
    decision: string
    technicalComments: string
    toolingRequirements: string | null
    materialRecommendation: string | null
    constraintsAndRisks: string | null
    reviewerAuthUserId: string
    reviewerName: string
    decidedAt: Date
  }>
  activity: Array<{
    id: string
    action: string
    previousStatus: string | null
    newStatus: string | null
    reason: string | null
    occurredAt: Date
  }>
}

export type RdDecisionInput = {
  decision: 'APPROVED' | 'CLARIFICATION_REQUESTED' | 'REJECTED' | 'ON_HOLD'
  planningUserAuthUserId?: string | null
  technicalComments: string
  toolingRequirements?: string | null
  materialRecommendation?: string | null
  constraintsAndRisks?: string | null
  clarificationQuestion?: string | null
}

export type PlanningUser = {
  authUserId: string
  displayName: string
  email: string
}


export type RdAttachment = {
  fileName: string
  mediaType: string
  content: Buffer
}

export interface RdService {
  listQueue(user: AuthUser): Promise<RdOrderSummary[]>
  listPlanningUsers(user: AuthUser): Promise<PlanningUser[]>
  getOrder(user: AuthUser, orderId: string): Promise<RdOrderDetail>
  decide(user: AuthUser, orderId: string, input: RdDecisionInput): Promise<RdOrderDetail>
  downloadAttachment(user: AuthUser, orderId: string, attachmentId: string): Promise<RdAttachment>
}

export class RdError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly fields?: string[],
  ) {
    super(message)
    this.name = 'RdError'
  }
}

function ensureRd(user: AuthUser) {
  if (!user.roles.includes('R&D')) {
    throw new RdError(403, 'FORBIDDEN', 'R&D access is required.')
  }
}

function dateOnly(value: string | Date | null) {
  if (!value) return null
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
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
  priority: string | null
  created_at: Date
  updated_at: Date
  open_clarifications: string
  created_by_auth_user_id: string
  owner_auth_user_id: string | null
}

const orderSelect = `
  SELECT orders.*,
    count(clarification.id) FILTER (WHERE clarification.status = 'OPEN') AS open_clarifications
  FROM flowline.orders AS orders
  LEFT JOIN flowline.clarification_requests AS clarification ON clarification.order_id = orders.id
`

function toSummary(row: OrderRow): RdOrderSummary {
  return {
    id: row.id,
    orderNumber: row.order_number,
    customerName: row.customer_name,
    productName: row.product_name,
    status: row.status,
    stage: row.stage,
    priority: row.priority,
    requestedDeliveryDate: dateOnly(row.requested_delivery_date),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    openClarifications: Number(row.open_clarifications),
  }
}

export class PostgresRdService implements RdService {
  constructor(
    private readonly pool: pg.Pool,
    private readonly notificationPublisher?: NotificationPublisher,
  ) {}

  async listQueue(user: AuthUser) {
    ensureRd(user)
    const result = await this.pool.query<OrderRow>(
      `${orderSelect}
       WHERE orders.owner_auth_user_id = $1
         AND orders.stage = 'R&D'
         AND orders.status IN ('R&D Review', 'On Hold')
       GROUP BY orders.id
       ORDER BY CASE orders.priority WHEN 'High' THEN 0 ELSE 1 END,
                orders.updated_at DESC
       LIMIT 100`,
      [user.id],
    )
    return result.rows.map(toSummary)
  }

  async listPlanningUsers(user: AuthUser) {
    ensureRd(user)
    const result = await this.pool.query<{
      auth_user_id: string
      display_name: string
      email: string
    }>(
      `SELECT profile.auth_user_id, profile.display_name, profile.email
       FROM flowline.user_profiles AS profile
       JOIN flowline.user_roles AS user_role ON user_role.user_profile_id = profile.id
       JOIN flowline.roles AS role ON role.id = user_role.role_id
       WHERE profile.status = 'ACTIVE' AND role.code = 'PLANNING'
       ORDER BY profile.display_name, profile.email`,
    )
    return result.rows.map((planner) => ({
      authUserId: planner.auth_user_id,
      displayName: planner.display_name,
      email: planner.email,
    }))
  }

  async listCsrUsers(user: AuthUser) {
    ensureRd(user)
    const result = await this.pool.query<{
      auth_user_id: string
      display_name: string
      email: string
    }>(
      `SELECT profile.auth_user_id, profile.display_name, profile.email
       FROM flowline.user_profiles AS profile
       JOIN flowline.user_roles AS user_role ON user_role.user_profile_id = profile.id
       JOIN flowline.roles AS role ON role.id = user_role.role_id
       WHERE profile.status = 'ACTIVE' AND role.code = 'CSR'
       ORDER BY profile.display_name, profile.email`,
    )
    return result.rows.map((csr) => ({
      authUserId: csr.auth_user_id,
      displayName: csr.display_name,
      email: csr.email,
    }))
  }

  async getOrder(user: AuthUser, orderId: string) {
    ensureRd(user)
    const orderResult = await this.pool.query<OrderRow>(
      `${orderSelect}
       WHERE orders.id = $1
         AND (
           orders.owner_auth_user_id = $2
           OR EXISTS (
             SELECT 1 FROM flowline.technical_reviews AS prior_review
             WHERE prior_review.order_id = orders.id
               AND prior_review.reviewer_auth_user_id = $2
           )
         )
       GROUP BY orders.id`,
      [orderId, user.id],
    )
    const order = orderResult.rows[0]
    if (!order) throw new RdError(404, 'ORDER_NOT_FOUND', 'R&D order not found.')

    const [attachments, clarifications, reviews, activity] = await Promise.all([
      this.pool.query<{ id: string; file_name: string; media_type: string; size_bytes: string; created_at: Date }>(
        `SELECT id, file_name, media_type, size_bytes, created_at
         FROM flowline.attachments WHERE order_id = $1 ORDER BY created_at DESC`,
        [orderId],
      ),
      this.pool.query<{
        id: string; stage: string; question: string; status: string; requested_at: Date
        response: string | null; responded_at: Date | null
      }>(
        `SELECT id, stage, question, status, requested_at, response, responded_at
         FROM flowline.clarification_requests WHERE order_id = $1 ORDER BY requested_at DESC`,
        [orderId],
      ),
      this.pool.query<{
        id: string; decision: string; technical_comments: string; tooling_requirements: string | null
        material_recommendation: string | null; constraints_and_risks: string | null
        reviewer_auth_user_id: string; reviewer_name: string; decided_at: Date
      }>(
        `SELECT review.id, review.decision, review.technical_comments,
                review.tooling_requirements, review.material_recommendation,
                review.constraints_and_risks, review.reviewer_auth_user_id,
                COALESCE(profile.display_name, review.reviewer_auth_user_id) AS reviewer_name,
                review.decided_at
         FROM flowline.technical_reviews AS review
         LEFT JOIN flowline.user_profiles AS profile ON profile.auth_user_id = review.reviewer_auth_user_id
         WHERE review.order_id = $1 ORDER BY review.decided_at DESC`,
        [orderId],
      ),
      this.pool.query<{
        id: string; action: string; previous_status: string | null; new_status: string | null
        reason: string | null; occurred_at: Date
      }>(
        `SELECT id::text, action, previous_status, new_status, reason, occurred_at
         FROM flowline.audit_events WHERE order_id = $1 ORDER BY occurred_at DESC`,
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
      technicalReviews: reviews.rows.map((item) => ({
        id: item.id,
        decision: item.decision,
        technicalComments: item.technical_comments,
        toolingRequirements: item.tooling_requirements,
        materialRecommendation: item.material_recommendation,
        constraintsAndRisks: item.constraints_and_risks,
        reviewerAuthUserId: item.reviewer_auth_user_id,
        reviewerName: item.reviewer_name,
        decidedAt: item.decided_at,
      })),
      activity: activity.rows.map((item) => ({
        id: item.id,
        action: item.action,
        previousStatus: item.previous_status,
        newStatus: item.new_status,
        reason: item.reason,
        occurredAt: item.occurred_at,
      })),
    }
  }

  async decide(user: AuthUser, orderId: string, input: RdDecisionInput) {
    ensureRd(user)
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const orderResult = await client.query<OrderRow>(
        `SELECT orders.*, '0'::text AS open_clarifications
         FROM flowline.orders
         WHERE orders.id = $1 AND orders.owner_auth_user_id = $2
           AND orders.stage = 'R&D' AND orders.status = 'R&D Review'
         FOR UPDATE`,
        [orderId, user.id],
      )
      const order = orderResult.rows[0]
      if (!order) throw new RdError(404, 'ORDER_NOT_FOUND', 'R&D order not found or already decided.')

      const comments = input.technicalComments.trim()
      if (!comments) throw new RdError(422, 'DECISION_INCOMPLETE', 'Technical comments are required.', ['technicalComments'])
      if (input.decision === 'CLARIFICATION_REQUESTED' && !input.clarificationQuestion?.trim()) {
        throw new RdError(422, 'DECISION_INCOMPLETE', 'A clarification question is required.', ['clarificationQuestion'])
      }
      if (input.decision === 'APPROVED' && !input.planningUserAuthUserId) {
        throw new RdError(422, 'DECISION_INCOMPLETE', 'Select an active Planning user.', ['planningUserAuthUserId'])
      }

      const nextStatus = input.decision === 'APPROVED'
        ? 'Planning Review'
        : input.decision === 'REJECTED'
          ? 'Cancelled'
          : input.decision === 'ON_HOLD' ? 'On Hold' : 'R&D Review'
      const nextStage = input.decision === 'APPROVED' ? 'Planning' : 'CSR'
      const planningRole = input.decision === 'APPROVED'
        ? await client.query<{ id: string }>(`SELECT id FROM flowline.roles WHERE code = 'PLANNING'`)
        : null
      const csrRole = input.decision !== 'APPROVED'
        ? await client.query<{ id: string }>(`SELECT id FROM flowline.roles WHERE code = 'CSR'`)
        : null
      if (input.decision === 'APPROVED') {
        const planner = await client.query<{ auth_user_id: string }>(
          `SELECT profile.auth_user_id
           FROM flowline.user_profiles AS profile
           JOIN flowline.user_roles AS user_role ON user_role.user_profile_id = profile.id
           JOIN flowline.roles AS role ON role.id = user_role.role_id
           WHERE profile.auth_user_id = $1
             AND profile.status = 'ACTIVE'
             AND role.code = 'PLANNING'`,
          [input.planningUserAuthUserId],
        )
        if (!planner.rows[0]) throw new RdError(422, 'INVALID_PLANNER', 'Select an active Planning user.', ['planningUserAuthUserId'])
      }
      await client.query(
        `INSERT INTO flowline.technical_reviews (
           order_id, reviewer_auth_user_id, decision, technical_comments,
           tooling_requirements, material_recommendation, constraints_and_risks
         ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [orderId, user.id, input.decision, comments, input.toolingRequirements?.trim() || null,
          input.materialRecommendation?.trim() || null, input.constraintsAndRisks?.trim() || null],
      )
      await client.query(
        `UPDATE flowline.orders
         SET status = $2, stage = $3,
             owner_role_id = $4, owner_auth_user_id = $5, version = version + 1
         WHERE id = $1`,
        [orderId, nextStatus, nextStage, planningRole?.rows[0]?.id ?? csrRole?.rows[0]?.id ?? null,
          input.decision === 'APPROVED' ? input.planningUserAuthUserId : order.created_by_auth_user_id],
      )
      if (input.decision === 'CLARIFICATION_REQUESTED') {
        await client.query(
          `INSERT INTO flowline.clarification_requests (
             order_id, stage, question, requested_by_auth_user_id
           ) VALUES ($1, 'R&D', $2, $3)`,
          [orderId, input.clarificationQuestion?.trim(), user.id],
        )
      }
      await client.query(
        `INSERT INTO flowline.audit_events (
           order_id, actor_auth_user_id, action, previous_status, new_status, reason, details
         ) VALUES ($1, $2, $3, $4, $5, $6, jsonb_build_object('decision', $7::text))`,
        [orderId, user.id, `RD_${input.decision}`, order.status, nextStatus, comments, input.decision],
      )

      const recipientUserId = input.decision === 'APPROVED' ? input.planningUserAuthUserId ?? null : order.created_by_auth_user_id
      const recipientRoleId = null
      const notificationResult = await client.query<{ id: string }>(
        `WITH notification AS (
           INSERT INTO flowline.notifications (order_id, type, title, message)
           VALUES ($1, $2, $3, $4) RETURNING id
         )
         INSERT INTO flowline.notification_recipients (
           notification_id, recipient_auth_user_id, recipient_role_id
         )
         SELECT notification.id, $5, $6 FROM notification
         RETURNING notification_id AS id`,
        [orderId, `RD_${input.decision}`, `R&D decision recorded for ${order.order_number}`,
          input.decision === 'APPROVED'
            ? `Order ${order.order_number} is approved and assigned to Planning.`
            : `Order ${order.order_number} requires CSR follow-up: ${nextStatus}.`,
          recipientUserId, recipientRoleId],
      )
      await client.query('COMMIT')
      const notificationId = notificationResult.rows[0]?.id
      const notification = notificationId ? {
        id: notificationId,
        orderId,
        orderNumber: order.order_number,
        type: `RD_${input.decision}`,
        title: `R&D decision recorded for ${order.order_number}`,
        message: input.decision === 'APPROVED'
          ? `Order ${order.order_number} is approved and assigned to Planning.`
          : `Order ${order.order_number} requires CSR follow-up: ${nextStatus}.`,
        createdAt: new Date(),
        readAt: null,
      } : null
      if (notification) {
        if (recipientUserId) this.notificationPublisher?.publish(recipientUserId, notification)
        if (recipientRoleId) {
          const planningUsers = await this.pool.query<{ auth_user_id: string }>(
            `SELECT profile.auth_user_id
             FROM flowline.user_profiles AS profile
             JOIN flowline.user_roles AS user_role ON user_role.user_profile_id = profile.id
             WHERE user_role.role_id = $1 AND profile.status = 'ACTIVE'`,
            [recipientRoleId],
          )
          for (const planningUser of planningUsers.rows) this.notificationPublisher?.publish(planningUser.auth_user_id, notification)
        }
      }
      return this.getOrder(user, orderId)
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  async downloadAttachment(user: AuthUser, orderId: string, attachmentId: string) {
    ensureRd(user)
    const result = await this.pool.query<{
      file_name: string
      media_type: string
      content: Buffer | null
    }>(
      `SELECT attachment.file_name, attachment.media_type, attachment.content
       FROM flowline.attachments AS attachment
       JOIN flowline.orders AS orders ON orders.id = attachment.order_id
       WHERE attachment.id = $1 AND orders.id = $2
         AND orders.owner_auth_user_id = $3 AND orders.stage = 'R&D'`,
      [attachmentId, orderId, user.id],
    )
    const attachment = result.rows[0]
    if (!attachment?.content) throw new RdError(404, 'ATTACHMENT_NOT_FOUND', 'Attachment not found.')
    return { fileName: attachment.file_name, mediaType: attachment.media_type, content: attachment.content }
  }
}
