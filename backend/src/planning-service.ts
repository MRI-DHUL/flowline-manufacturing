import type pg from 'pg'
import type { AuthUser } from './auth-service.js'
import type { NotificationItem, NotificationPublisher } from './notification-service.js'

export type PlanningOrderSummary = {
  id: string
  orderNumber: string
  customerName: string | null
  productName: string | null
  status: string
  priority: string | null
  requestedDeliveryDate: string | null
  requestedQuantity: number | null
  updatedAt: Date
}

export type PlanningResource = {
  id: string
  code: string
  name: string
}

export type PressUser = {
  authUserId: string
  displayName: string
  email: string
}

export type PlanningAssessment = {
  id: string
  materialStatus: 'PENDING' | 'AVAILABLE' | 'SHORTAGE'
  shortageReason: string | null
  expectedMaterialDate: string | null
  productionLineId: string | null
  plannedProductionDate: string | null
  capacityStatus: 'PENDING' | 'AVAILABLE' | 'UNAVAILABLE'
  readinessStatus: 'PENDING' | 'READY' | 'BLOCKED'
  planningNotes: string | null
  pressUserAuthUserId: string | null
  updatedAt: Date
}

export type PlanningOrderDetail = PlanningOrderSummary & {
  destination: string | null
  productDescription: string | null
  orderType: string | null
  packagingType: string | null
  dimensions: string | null
  material: string | null
  printColors: string | null
  technicalNotes: string | null
  assessment: PlanningAssessment | null
  technicalReviews: Array<{
    decision: string
    technicalComments: string
    toolingRequirements: string | null
    materialRecommendation: string | null
    constraintsAndRisks: string | null
    reviewerName: string
    decidedAt: Date
  }>
  attachments: Array<{
    id: string
    fileName: string
    mediaType: string
    sizeBytes: number
    createdAt: Date
  }>
}

export type PlanningAssessmentInput = {
  materialStatus: 'PENDING' | 'AVAILABLE' | 'SHORTAGE'
  shortageReason?: string | null
  expectedMaterialDate?: string | null
  productionLineId?: string | null
  plannedProductionDate?: string | null
  capacityStatus: 'PENDING' | 'AVAILABLE' | 'UNAVAILABLE'
  readinessStatus: 'PENDING' | 'READY' | 'BLOCKED'
  planningNotes?: string | null
  pressUserAuthUserId?: string | null
}

export interface PlanningService {
  listQueue(user: AuthUser): Promise<PlanningOrderSummary[]>
  listResources(user: AuthUser): Promise<{ productionLines: PlanningResource[]; pressUsers: PressUser[] }>
  getOrder(user: AuthUser, orderId: string): Promise<PlanningOrderDetail>
  saveAssessment(user: AuthUser, orderId: string, input: PlanningAssessmentInput): Promise<PlanningOrderDetail>
  release(user: AuthUser, orderId: string, input: PlanningAssessmentInput): Promise<PlanningOrderDetail>
  downloadAttachment(
    user: AuthUser,
    orderId: string,
    attachmentId: string,
  ): Promise<{ fileName: string; mediaType: string; content: Buffer }>
}

export class PlanningError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly fields?: string[],
  ) {
    super(message)
    this.name = 'PlanningError'
  }
}

function ensurePlanning(user: AuthUser) {
  if (!user.roles.includes('PLANNING')) throw new PlanningError(403, 'FORBIDDEN', 'Planning access is required.')
}

function dateOnly(value: string | Date | null) {
  if (!value) return null
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().slice(0, 10)
}

type OrderRow = {
  id: string
  order_number: string
  customer_name: string | null
  product_name: string | null
  status: string
  priority: string | null
  requested_delivery_date: string | Date | null
  requested_quantity: string | null
  updated_at: Date
  destination: string | null
  product_description: string | null
  order_type: string | null
  packaging_type: string | null
  dimensions: string | null
  material: string | null
  print_colors: string | null
  technical_notes: string | null
  owner_auth_user_id: string | null
}

function toSummary(row: OrderRow): PlanningOrderSummary {
  return {
    id: row.id,
    orderNumber: row.order_number,
    customerName: row.customer_name,
    productName: row.product_name,
    status: row.status,
    priority: row.priority,
    requestedDeliveryDate: dateOnly(row.requested_delivery_date),
    requestedQuantity: row.requested_quantity === null ? null : Number(row.requested_quantity),
    updatedAt: row.updated_at,
  }
}

export class PostgresPlanningService implements PlanningService {
  constructor(
    private readonly pool: pg.Pool,
    private readonly notificationPublisher?: NotificationPublisher,
  ) {}

  async listQueue(user: AuthUser) {
    ensurePlanning(user)
    const result = await this.pool.query<OrderRow>(
      `SELECT * FROM flowline.orders
       WHERE owner_auth_user_id = $1 AND stage = 'Planning' AND status = 'Planning Review'
       ORDER BY CASE priority WHEN 'High' THEN 0 ELSE 1 END, requested_delivery_date, updated_at DESC
       LIMIT 100`,
      [user.id],
    )
    return result.rows.map(toSummary)
  }

  async listResources(user: AuthUser) {
    ensurePlanning(user)
    const [lines, pressUsers] = await Promise.all([
      this.pool.query<{ id: string; code: string; name: string }>(
        `SELECT id, code, name FROM flowline.production_lines WHERE active = true ORDER BY name, code`,
      ),
      this.pool.query<{ auth_user_id: string; display_name: string; email: string }>(
        `SELECT profile.auth_user_id, profile.display_name, profile.email
         FROM flowline.user_profiles AS profile
         JOIN flowline.user_roles AS user_role ON user_role.user_profile_id = profile.id
         JOIN flowline.roles AS role ON role.id = user_role.role_id
         WHERE profile.status = 'ACTIVE' AND role.code = 'PRESS'
         ORDER BY profile.display_name, profile.email`,
      ),
    ])
    return {
      productionLines: lines.rows,
      pressUsers: pressUsers.rows.map((pressUser) => ({
        authUserId: pressUser.auth_user_id,
        displayName: pressUser.display_name,
        email: pressUser.email,
      })),
    }
  }

  async getOrder(user: AuthUser, orderId: string) {
    ensurePlanning(user)
    const orderResult = await this.pool.query<OrderRow>(
      `SELECT * FROM flowline.orders
       WHERE id = $1 AND (
         owner_auth_user_id = $2
         OR EXISTS (
           SELECT 1 FROM flowline.planning_reviews
           WHERE order_id = flowline.orders.id AND planner_auth_user_id = $2
         )
       )`,
      [orderId, user.id],
    )
    const order = orderResult.rows[0]
    if (!order) throw new PlanningError(404, 'ORDER_NOT_FOUND', 'Planning order not found.')

    const [assessment, reviews, attachments] = await Promise.all([
      this.pool.query<{
        id: string
        material_status: PlanningAssessment['materialStatus']
        shortage_reason: string | null
        expected_material_date: string | Date | null
        production_line_id: string | null
        planned_production_date: string | Date | null
        capacity_status: PlanningAssessment['capacityStatus']
        readiness_status: PlanningAssessment['readinessStatus']
        planning_notes: string | null
        press_operator_auth_user_id: string | null
        updated_at: Date
      }>(
        `SELECT id, material_status, shortage_reason, expected_material_date, production_line_id,
          planned_production_date, capacity_status, readiness_status, planning_notes,
          press_operator_auth_user_id, updated_at
         FROM flowline.planning_reviews
         WHERE order_id = $1 AND planner_auth_user_id = $2
         ORDER BY updated_at DESC LIMIT 1`,
        [orderId, user.id],
      ),
      this.pool.query<{
        decision: string
        technical_comments: string
        tooling_requirements: string | null
        material_recommendation: string | null
        constraints_and_risks: string | null
        reviewer_name: string
        decided_at: Date
      }>(
        `SELECT review.decision, review.technical_comments, review.tooling_requirements,
                review.material_recommendation, review.constraints_and_risks,
                COALESCE(profile.display_name, review.reviewer_auth_user_id) AS reviewer_name,
                review.decided_at
         FROM flowline.technical_reviews AS review
         LEFT JOIN flowline.user_profiles AS profile ON profile.auth_user_id = review.reviewer_auth_user_id
         WHERE review.order_id = $1 ORDER BY review.decided_at DESC`,
        [orderId],
      ),
      this.pool.query<{ id: string; file_name: string; media_type: string; size_bytes: string; created_at: Date }>(
        `SELECT id, file_name, media_type, size_bytes, created_at
         FROM flowline.attachments WHERE order_id = $1 ORDER BY created_at DESC`,
        [orderId],
      ),
    ])
    const currentAssessment = assessment.rows[0]
    return {
      ...toSummary(order),
      destination: order.destination,
      productDescription: order.product_description,
      orderType: order.order_type,
      packagingType: order.packaging_type,
      dimensions: order.dimensions,
      material: order.material,
      printColors: order.print_colors,
      technicalNotes: order.technical_notes,
      assessment: currentAssessment
        ? {
            id: currentAssessment.id,
            materialStatus: currentAssessment.material_status,
            shortageReason: currentAssessment.shortage_reason,
            expectedMaterialDate: dateOnly(currentAssessment.expected_material_date),
            productionLineId: currentAssessment.production_line_id,
            plannedProductionDate: dateOnly(currentAssessment.planned_production_date),
            capacityStatus: currentAssessment.capacity_status,
            readinessStatus: currentAssessment.readiness_status,
            planningNotes: currentAssessment.planning_notes,
            pressUserAuthUserId: currentAssessment.press_operator_auth_user_id,
            updatedAt: currentAssessment.updated_at,
          }
        : null,
      technicalReviews: reviews.rows.map((review) => ({
        decision: review.decision,
        technicalComments: review.technical_comments,
        toolingRequirements: review.tooling_requirements,
        materialRecommendation: review.material_recommendation,
        constraintsAndRisks: review.constraints_and_risks,
        reviewerName: review.reviewer_name,
        decidedAt: review.decided_at,
      })),
      attachments: attachments.rows.map((attachment) => ({
        id: attachment.id,
        fileName: attachment.file_name,
        mediaType: attachment.media_type,
        sizeBytes: Number(attachment.size_bytes),
        createdAt: attachment.created_at,
      })),
    }
  }

  private validateAssessment(input: PlanningAssessmentInput, release: boolean) {
    const fields: string[] = []
    if (input.materialStatus === 'SHORTAGE') {
      if (!input.shortageReason?.trim()) fields.push('shortageReason')
      if (!input.expectedMaterialDate) fields.push('expectedMaterialDate')
    }
    if (release) {
      if (input.materialStatus !== 'AVAILABLE') fields.push('materialStatus')
      if (!input.productionLineId) fields.push('productionLineId')
      if (!input.plannedProductionDate) fields.push('plannedProductionDate')
      if (input.capacityStatus !== 'AVAILABLE') fields.push('capacityStatus')
      if (input.readinessStatus !== 'READY') fields.push('readinessStatus')
      if (!input.pressUserAuthUserId) fields.push('pressUserAuthUserId')
    }
    if (fields.length) {
      throw new PlanningError(
        422,
        release ? 'RELEASE_BLOCKED' : 'ASSESSMENT_INCOMPLETE',
        release
          ? 'Complete all material, capacity, line, schedule, readiness, and Press assignment checks before release.'
          : 'Record the shortage reason and expected material date.',
        fields,
      )
    }
  }

  private async persistAssessment(client: pg.PoolClient, user: AuthUser, orderId: string, input: PlanningAssessmentInput) {
    const existing = await client.query<{ id: string }>(
      `SELECT id FROM flowline.planning_reviews
       WHERE order_id = $1 AND planner_auth_user_id = $2
       ORDER BY updated_at DESC LIMIT 1 FOR UPDATE`,
      [orderId, user.id],
    )
    const values = [
      orderId,
      user.id,
      input.materialStatus,
      input.shortageReason?.trim() || null,
      input.expectedMaterialDate || null,
      input.productionLineId || null,
      input.plannedProductionDate || null,
      input.capacityStatus,
      input.readinessStatus,
      input.planningNotes?.trim() || null,
      input.pressUserAuthUserId || null,
    ]
    if (existing.rows[0]) {
      await client.query(
        `UPDATE flowline.planning_reviews
         SET material_status = $3, shortage_reason = $4, expected_material_date = $5,
             production_line_id = $6, planned_production_date = $7, capacity_status = $8,
             readiness_status = $9, planning_notes = $10, press_operator_auth_user_id = $11
           WHERE id = $12`,
        [...values, existing.rows[0].id],
      )
    } else {
      await client.query(
        `INSERT INTO flowline.planning_reviews (
           order_id, planner_auth_user_id, material_status, shortage_reason, expected_material_date,
           production_line_id, planned_production_date, capacity_status, readiness_status, planning_notes,
           press_operator_auth_user_id
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        values,
      )
    }
  }

  async saveAssessment(user: AuthUser, orderId: string, input: PlanningAssessmentInput) {
    ensurePlanning(user)
    this.validateAssessment(input, false)
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const liveNotifications: Array<{ userId: string; item: NotificationItem }> = []
      const order = await client.query<{ id: string; order_number: string; created_by_auth_user_id: string }>(
        `SELECT id, order_number, created_by_auth_user_id FROM flowline.orders
         WHERE id = $1 AND owner_auth_user_id = $2 AND stage = 'Planning' AND status = 'Planning Review'
         FOR UPDATE`,
        [orderId, user.id],
      )
      if (!order.rows[0]) throw new PlanningError(404, 'ORDER_NOT_FOUND', 'Planning order not found or already released.')
      await this.persistAssessment(client, user, orderId, input)
      await client.query(
        `INSERT INTO flowline.audit_events (order_id, actor_auth_user_id, action, reason)
         VALUES ($1, $2, 'PLANNING_ASSESSMENT_SAVED', $3)`,
        [orderId, user.id, input.planningNotes?.trim() || null],
      )
      if (input.materialStatus === 'SHORTAGE') {
        const recipients = await client.query<{ auth_user_id: string }>(
          `SELECT profile.auth_user_id
           FROM flowline.user_profiles profile
           JOIN flowline.user_roles user_role ON user_role.user_profile_id = profile.id
           JOIN flowline.roles role ON role.id = user_role.role_id
           WHERE profile.status = 'ACTIVE' AND role.code = 'MANAGER'
           UNION
           SELECT $2`,
          [orderId, order.rows[0].created_by_auth_user_id],
        )
        const notification = await client.query<{ id: string; created_at: Date }>(
          `INSERT INTO flowline.notifications (order_id, type, title, message)
           VALUES ($1, 'MATERIAL_SHORTAGE', $2, $3) RETURNING id, created_at`,
          [
            orderId,
            `Material shortage for ${order.rows[0].order_number}`,
            `${input.shortageReason?.trim()}. Expected availability: ${input.expectedMaterialDate}.`,
          ],
        )
        for (const recipient of recipients.rows) {
          if (recipient.auth_user_id === user.id) continue
          await client.query(`INSERT INTO flowline.notification_recipients (notification_id, recipient_auth_user_id) VALUES ($1,$2)`, [
            notification.rows[0]?.id,
            recipient.auth_user_id,
          ])
          if (notification.rows[0])
            liveNotifications.push({
              userId: recipient.auth_user_id,
              item: {
                id: notification.rows[0].id,
                orderId,
                orderNumber: order.rows[0].order_number,
                type: 'MATERIAL_SHORTAGE',
                title: `Material shortage for ${order.rows[0].order_number}`,
                message: `${input.shortageReason?.trim()}. Expected availability: ${input.expectedMaterialDate}.`,
                createdAt: notification.rows[0].created_at,
                readAt: null,
              },
            })
        }
        await client.query(
          `INSERT INTO flowline.audit_events (order_id, actor_auth_user_id, action, reason, details) VALUES ($1,$2,'MATERIAL_SHORTAGE_ALERTED',$3,$4)`,
          [orderId, user.id, input.shortageReason?.trim(), JSON.stringify({ expectedMaterialDate: input.expectedMaterialDate })],
        )
      }
      await client.query('COMMIT')
      for (const notification of liveNotifications) this.notificationPublisher?.publish(notification.userId, notification.item)
      return this.getOrder(user, orderId)
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  async release(user: AuthUser, orderId: string, input: PlanningAssessmentInput) {
    ensurePlanning(user)
    this.validateAssessment(input, true)
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const orderResult = await client.query<OrderRow>(
        `SELECT * FROM flowline.orders
         WHERE id = $1 AND owner_auth_user_id = $2 AND stage = 'Planning' AND status = 'Planning Review'
         FOR UPDATE`,
        [orderId, user.id],
      )
      const order = orderResult.rows[0]
      if (!order) throw new PlanningError(404, 'ORDER_NOT_FOUND', 'Planning order not found or already released.')

      const [line, pressUser, pressRole] = await Promise.all([
        client.query<{ id: string }>(`SELECT id FROM flowline.production_lines WHERE id = $1 AND active = true`, [input.productionLineId]),
        client.query<{ auth_user_id: string }>(
          `SELECT profile.auth_user_id
           FROM flowline.user_profiles AS profile
           JOIN flowline.user_roles AS user_role ON user_role.user_profile_id = profile.id
           JOIN flowline.roles AS role ON role.id = user_role.role_id
           WHERE profile.auth_user_id = $1 AND profile.status = 'ACTIVE' AND role.code = 'PRESS'`,
          [input.pressUserAuthUserId],
        ),
        client.query<{ id: string }>(`SELECT id FROM flowline.roles WHERE code = 'PRESS'`),
      ])
      if (!line.rows[0]) throw new PlanningError(422, 'INVALID_LINE', 'Select an active production line.', ['productionLineId'])
      if (!pressUser.rows[0]) throw new PlanningError(422, 'INVALID_PRESS_USER', 'Select an active Press user.', ['pressUserAuthUserId'])
      await this.persistAssessment(client, user, orderId, input)
      await client.query(
        `INSERT INTO flowline.production_runs (
           order_id, production_line_id, operator_auth_user_id, status, planned_quantity
         ) VALUES ($1, $2, $3, 'SCHEDULED', $4)`,
        [orderId, input.productionLineId, input.pressUserAuthUserId, order.requested_quantity],
      )
      await client.query(
        `UPDATE flowline.orders
         SET status = 'Scheduled', stage = 'Press', owner_role_id = $2,
             owner_auth_user_id = $3, version = version + 1
         WHERE id = $1`,
        [orderId, pressRole.rows[0]?.id ?? null, input.pressUserAuthUserId],
      )
      await client.query(
        `INSERT INTO flowline.audit_events (
           order_id, actor_auth_user_id, action, previous_status, new_status, reason, details
         ) VALUES ($1, $2, 'PLANNING_RELEASED', 'Planning Review', 'Scheduled', $3,
           jsonb_build_object('productionLineId', $4::text, 'pressUserAuthUserId', $5::text))`,
        [orderId, user.id, input.planningNotes?.trim() || null, input.productionLineId, input.pressUserAuthUserId],
      )
      const notification = await client.query<{ id: string }>(
        `INSERT INTO flowline.notifications (order_id, type, title, message)
         VALUES ($1, 'PLANNING_RELEASED', $2, $3) RETURNING id`,
        [orderId, `Order ${order.order_number} released to Press`, `Production is scheduled for ${input.plannedProductionDate}.`],
      )
      await client.query(
        `INSERT INTO flowline.notification_recipients (notification_id, recipient_auth_user_id)
         VALUES ($1, $2)`,
        [notification.rows[0]?.id, input.pressUserAuthUserId],
      )
      await client.query('COMMIT')
      if (notification.rows[0]) {
        this.notificationPublisher?.publish(input.pressUserAuthUserId!, {
          id: notification.rows[0].id,
          orderId,
          orderNumber: order.order_number,
          type: 'PLANNING_RELEASED',
          title: `Order ${order.order_number} released to Press`,
          message: `Production is scheduled for ${input.plannedProductionDate}.`,
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

  async downloadAttachment(user: AuthUser, orderId: string, attachmentId: string) {
    ensurePlanning(user)
    const result = await this.pool.query<{ file_name: string; media_type: string; storage_key: string }>(
      `SELECT attachment.file_name, attachment.media_type, attachment.storage_key
       FROM flowline.attachments AS attachment
       JOIN flowline.orders AS orders ON orders.id = attachment.order_id
       WHERE attachment.id = $1 AND attachment.order_id = $2 AND (
         orders.owner_auth_user_id = $3
         OR EXISTS (
           SELECT 1 FROM flowline.planning_reviews
           WHERE order_id = orders.id AND planner_auth_user_id = $3
         )
       )`,
      [attachmentId, orderId, user.id],
    )
    const attachment = result.rows[0]
    if (!attachment) throw new PlanningError(404, 'ATTACHMENT_NOT_FOUND', 'Attachment not found.')
    return { fileName: attachment.file_name, mediaType: attachment.media_type, content: Buffer.from(attachment.storage_key, 'base64') }
  }
}
