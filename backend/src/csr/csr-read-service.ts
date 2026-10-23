import type pg from 'pg'
import type { AuthUser } from '../auth/auth-service.js'
import { CsrError } from './csr-service-types.js'
import type { CsrOrderDetail, CsrOrderStatusRow, CsrOrderSummary } from './csr-service-types.js'

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

function ensureCsr(user: AuthUser) {
  if (!user.roles.includes('CSR')) throw new CsrError(403, 'FORBIDDEN', 'CSR access is required.')
}

function dateOnly(value: string | Date | null) {
  if (!value) return null
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
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
      ? { authUserId: row.assigned_reviewer_auth_user_id, displayName: row.assigned_reviewer_display_name ?? 'Unnamed reviewer', email: row.assigned_reviewer_email ?? '' }
      : null,
    priority: row.priority,
    requestedDeliveryDate: dateOnly(row.requested_delivery_date),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    openClarifications: Number(row.open_clarifications),
  }
}

const orderSelect = `
  SELECT orders.*,
    MAX(reviewer.auth_user_id) AS assigned_reviewer_auth_user_id,
    MAX(reviewer.display_name) AS assigned_reviewer_display_name,
    MAX(reviewer.email) AS assigned_reviewer_email,
    count(clarification.id) FILTER (WHERE clarification.status = 'OPEN') AS open_clarifications
  FROM flowline.orders AS orders
  LEFT JOIN flowline.user_profiles AS reviewer ON reviewer.auth_user_id = orders.owner_auth_user_id
  LEFT JOIN flowline.clarification_requests AS clarification ON clarification.order_id = orders.id
`

export class PostgresCsrReadService {
  constructor(protected readonly pool: pg.Pool) {}

  async listOrders(user: AuthUser, filters: { search?: string; status?: string }) {
    ensureCsr(user)
    const result = await this.pool.query<OrderRow>(`${orderSelect}
       WHERE orders.created_by_auth_user_id = $1
         AND ($2::text IS NULL OR orders.status = $2)
         AND ($3::text IS NULL OR orders.order_number ILIKE '%' || $3 || '%' OR COALESCE(orders.customer_name, '') ILIKE '%' || $3 || '%' OR COALESCE(orders.product_name, '') ILIKE '%' || $3 || '%')
       GROUP BY orders.id ORDER BY orders.updated_at DESC LIMIT 100`,
      [user.id, filters.status?.trim() || null, filters.search?.trim() || null],
    )
    return result.rows.map(toSummary)
  }

  async listOrderStatuses(user: AuthUser): Promise<CsrOrderStatusRow[]> {
    ensureCsr(user)
    const result = await this.pool.query<{
      event_id: string; order_id: string; order_number: string; order_name: string | null; order_placed_at: Date
      current_status: string; status: string; completed_by: string; completed_at: Date
      transition_duration_seconds: string | null; status_duration_seconds: string; current: boolean; comments: string | null; action: string
    }>(`WITH status_events AS (
         SELECT audit.id::text AS event_id, orders.id AS order_id, orders.order_number,
                orders.product_name AS order_name, orders.created_at AS order_placed_at, orders.status AS current_status,
                audit.new_status AS status, COALESCE(profile.display_name, audit.actor_auth_user_id) AS completed_by,
                audit.occurred_at AS completed_at, audit.reason AS comments, audit.action,
                LAG(audit.occurred_at) OVER (PARTITION BY orders.id ORDER BY audit.occurred_at, audit.id) AS previous_at,
                LEAD(audit.occurred_at) OVER (PARTITION BY orders.id ORDER BY audit.occurred_at, audit.id) AS next_at
         FROM flowline.orders AS orders JOIN flowline.audit_events AS audit ON audit.order_id = orders.id
         LEFT JOIN flowline.user_profiles AS profile ON profile.auth_user_id = audit.actor_auth_user_id
         WHERE orders.created_by_auth_user_id = $1 AND audit.new_status IS NOT NULL)
       SELECT event_id, order_id, order_number, order_name, order_placed_at, current_status, status, completed_by, completed_at,
              EXTRACT(EPOCH FROM (completed_at - previous_at)) AS transition_duration_seconds,
              EXTRACT(EPOCH FROM (COALESCE(next_at, clock_timestamp()) - completed_at)) AS status_duration_seconds,
              next_at IS NULL AS current, comments, action
       FROM status_events ORDER BY completed_at DESC, order_number LIMIT 500`, [user.id])
    return result.rows.map((row) => ({
      eventId: row.event_id, orderId: row.order_id, orderNumber: row.order_number, orderName: row.order_name,
      orderPlacedAt: row.order_placed_at, currentStatus: row.current_status, status: row.status,
      completedBy: row.completed_by, completedAt: row.completed_at,
      transitionDurationSeconds: row.transition_duration_seconds === null ? null : Number(row.transition_duration_seconds),
      statusDurationSeconds: Number(row.status_duration_seconds), current: row.current, comments: row.comments, action: row.action,
    }))
  }

  async getOrder(user: AuthUser, orderId: string): Promise<CsrOrderDetail> {
    ensureCsr(user)
    const order = (await this.pool.query<OrderRow>(`${orderSelect} WHERE orders.id = $1 AND orders.created_by_auth_user_id = $2 GROUP BY orders.id`, [orderId, user.id])).rows[0]
    if (!order) throw new CsrError(404, 'ORDER_NOT_FOUND', 'Order not found.')
    const [attachments, reviewer, clarifications, activity] = await Promise.all([
      this.pool.query<{ id: string; file_name: string; media_type: string; size_bytes: string; created_at: Date }>(`SELECT id, file_name, media_type, size_bytes, created_at FROM flowline.attachments WHERE order_id = $1 ORDER BY created_at DESC`, [orderId]),
      this.pool.query<{ auth_user_id: string; display_name: string; email: string }>(`SELECT auth_user_id, display_name, email FROM flowline.user_profiles WHERE auth_user_id = $1`, [order.owner_auth_user_id]),
      this.pool.query<{ id: string; stage: string; question: string; status: string; requested_at: Date; response: string | null; responded_at: Date | null }>(`SELECT id, stage, question, status, requested_at, response, responded_at FROM flowline.clarification_requests WHERE order_id = $1 ORDER BY requested_at DESC`, [orderId]),
      this.pool.query<{ id: string; action: string; previous_status: string | null; new_status: string | null; reason: string | null; details: Record<string, unknown>; occurred_at: Date }>(`SELECT id::text, action, previous_status, new_status, reason, details, occurred_at FROM flowline.audit_events WHERE order_id = $1 ORDER BY occurred_at DESC`, [orderId]),
    ])
    return {
      ...toSummary(order), destination: order.destination, productDescription: order.product_description, orderType: order.order_type,
      packagingType: order.packaging_type, dimensions: order.dimensions, material: order.material, printColors: order.print_colors,
      requestedQuantity: order.requested_quantity === null ? null : Number(order.requested_quantity), technicalNotes: order.technical_notes,
      assignedReviewer: reviewer.rows[0] ? { authUserId: reviewer.rows[0].auth_user_id, displayName: reviewer.rows[0].display_name, email: reviewer.rows[0].email } : null,
      attachments: attachments.rows.map((item) => ({ id: item.id, fileName: item.file_name, mediaType: item.media_type, sizeBytes: Number(item.size_bytes), createdAt: item.created_at })),
      clarifications: clarifications.rows.map((item) => ({ id: item.id, stage: item.stage, question: item.question, status: item.status, requestedAt: item.requested_at, response: item.response, respondedAt: item.responded_at })),
      activity: activity.rows.map((item) => ({ id: item.id, action: item.action, previousStatus: item.previous_status, newStatus: item.new_status, reason: item.reason, details: item.details, occurredAt: item.occurred_at })),
    }
  }
}