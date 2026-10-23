import type pg from 'pg'
import type { AuthUser } from '../auth/auth-service.js'
import type { NotificationItem, NotificationPublisher } from '../notifications/notification-service.js'
export type { PressCompletionInput, PressOrderDetail, PressOrderSummary, PressService, ShippingUser } from './press-service-types.js'
import type { PressCompletionInput, PressOrderDetail, PressOrderSummary, PressService, ShippingUser } from './press-service-types.js'

export class PressError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly fields?: string[],
  ) {
    super(message)
    this.name = 'PressError'
  }
}

function ensurePress(user: AuthUser) {
  if (!user.roles.includes('PRESS')) throw new PressError(403, 'FORBIDDEN', 'Press access is required.')
}

function dateOnly(value: string | Date | null) {
  if (!value) return null
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10)
}

type PressRow = {
  id: string
  order_number: string
  customer_name: string | null
  product_name: string | null
  status: string
  priority: string | null
  requested_delivery_date: string | Date | null
  updated_at: Date
  destination: string | null
  packaging_type: string | null
  dimensions: string | null
  material: string | null
  print_colors: string | null
  technical_notes: string | null
  run_id: string
  run_status: string
  planned_quantity: string
  good_quantity: string | null
  waste_quantity: string | null
  started_at: Date | null
  completed_at: Date | null
  run_notes: string | null
  production_line_name: string | null
}

const pressSelect = `
  SELECT orders.id, orders.order_number, orders.customer_name, orders.product_name,
         orders.status, orders.priority, orders.requested_delivery_date, orders.updated_at,
         orders.destination, orders.packaging_type, orders.dimensions, orders.material,
         orders.print_colors, orders.technical_notes,
         run.id AS run_id, run.status AS run_status, run.planned_quantity,
         run.good_quantity, run.waste_quantity, run.started_at, run.completed_at,
         run.notes AS run_notes, line.name AS production_line_name
  FROM flowline.orders AS orders
  JOIN LATERAL (
    SELECT production_run.* FROM flowline.production_runs AS production_run
    WHERE production_run.order_id = orders.id
    ORDER BY production_run.created_at DESC LIMIT 1
  ) AS run ON true
  LEFT JOIN flowline.production_lines AS line ON line.id = run.production_line_id
`

function toSummary(row: PressRow): PressOrderSummary {
  return {
    id: row.id,
    orderNumber: row.order_number,
    customerName: row.customer_name,
    productName: row.product_name,
    status: row.status,
    priority: row.priority,
    requestedDeliveryDate: dateOnly(row.requested_delivery_date),
    plannedQuantity: Number(row.planned_quantity),
    runStatus: row.run_status,
    productionLineName: row.production_line_name,
    updatedAt: row.updated_at,
  }
}

export class PostgresPressService implements PressService {
  constructor(
    private readonly pool: pg.Pool,
    private readonly notificationPublisher?: NotificationPublisher,
  ) {}

  async listQueue(user: AuthUser) {
    ensurePress(user)
    const result = await this.pool.query<PressRow>(
      `${pressSelect}
       WHERE orders.owner_auth_user_id = $1
         AND orders.stage = 'Press'
         AND orders.status IN ('Scheduled', 'In Production', 'On Hold', 'Rework Required')
       ORDER BY CASE orders.priority WHEN 'High' THEN 0 ELSE 1 END,
                orders.requested_delivery_date, orders.updated_at DESC
       LIMIT 100`,
      [user.id],
    )
    return result.rows.map(toSummary)
  }

  async listShippingUsers(user: AuthUser) {
    ensurePress(user)
    const result = await this.pool.query<{
      auth_user_id: string
      display_name: string
      email: string
    }>(
      `SELECT profile.auth_user_id, profile.display_name, profile.email
       FROM flowline.user_profiles AS profile
       JOIN flowline.user_roles AS user_role ON user_role.user_profile_id = profile.id
       JOIN flowline.roles AS role ON role.id = user_role.role_id
       WHERE profile.status = 'ACTIVE' AND role.code = 'SHIPPING'
       ORDER BY profile.display_name, profile.email`,
    )
    return result.rows.map((item) => ({
      authUserId: item.auth_user_id,
      displayName: item.display_name,
      email: item.email,
    }))
  }

  async getOrder(user: AuthUser, orderId: string) {
    ensurePress(user)
    const result = await this.pool.query<PressRow>(
      `${pressSelect}
       WHERE orders.id = $1 AND (
         orders.owner_auth_user_id = $2
         OR run.operator_auth_user_id = $2
       )`,
      [orderId, user.id],
    )
    const row = result.rows[0]
    if (!row) throw new PressError(404, 'ORDER_NOT_FOUND', 'Press order not found.')
    const issues = await this.pool.query<{
      id: string
      category: string
      notes: string
      corrective_action: string | null
      reported_at: Date
      resolved_at: Date | null
      status: string
      rework_owner_auth_user_id: string | null
    }>(
      `SELECT id, category, notes, corrective_action, reported_at, resolved_at,
              status, rework_owner_auth_user_id
       FROM flowline.production_issues WHERE order_id = $1 ORDER BY reported_at DESC`,
      [orderId],
    )
    return {
      ...toSummary(row),
      destination: row.destination,
      packagingType: row.packaging_type,
      dimensions: row.dimensions,
      material: row.material,
      printColors: row.print_colors,
      technicalNotes: row.technical_notes,
      runId: row.run_id,
      goodQuantity: row.good_quantity === null ? null : Number(row.good_quantity),
      wasteQuantity: row.waste_quantity === null ? null : Number(row.waste_quantity),
      startedAt: row.started_at,
      completedAt: row.completed_at,
      notes: row.run_notes,
      issues: issues.rows.map((issue) => ({
        id: issue.id,
        category: issue.category,
        notes: issue.notes,
        correctiveAction: issue.corrective_action,
        reportedAt: issue.reported_at,
        resolvedAt: issue.resolved_at,
        status: issue.status,
        reworkOwnerAuthUserId: issue.rework_owner_auth_user_id,
      })),
    }
  }

  private async lockedRun(client: pg.PoolClient, user: AuthUser, orderId: string, allowedRunStatuses: string[]) {
    const result = await client.query<PressRow>(
      `${pressSelect}
       WHERE orders.id = $1 AND orders.owner_auth_user_id = $2
         AND orders.stage = 'Press' AND run.operator_auth_user_id = $2
         AND run.status = ANY($3::text[])
       FOR UPDATE OF orders, run`,
      [orderId, user.id, allowedRunStatuses],
    )
    const row = result.rows[0]
    if (!row) throw new PressError(404, 'ORDER_NOT_FOUND', 'Press job not found or action is not allowed in its current state.')
    return row
  }

  async accept(user: AuthUser, orderId: string) {
    ensurePress(user)
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const row = await this.lockedRun(client, user, orderId, ['SCHEDULED'])
      await client.query(`UPDATE flowline.production_runs SET status = 'ACCEPTED' WHERE id = $1`, [row.run_id])
      await client.query(
        `INSERT INTO flowline.audit_events (order_id, actor_auth_user_id, action, reason)
         VALUES ($1, $2, 'PRESS_JOB_ACCEPTED', 'Scheduled production job accepted')`,
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

  async start(user: AuthUser, orderId: string) {
    ensurePress(user)
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const row = await this.lockedRun(client, user, orderId, ['ACCEPTED', 'PAUSED', 'ISSUE'])
      await client.query(
        `UPDATE flowline.production_runs
         SET status = 'IN_PRODUCTION', started_at = COALESCE(started_at, clock_timestamp())
         WHERE id = $1`,
        [row.run_id],
      )
      await client.query(`UPDATE flowline.orders SET status = 'In Production', version = version + 1 WHERE id = $1`, [orderId])
      await client.query(
        `INSERT INTO flowline.audit_events (order_id, actor_auth_user_id, action, previous_status, new_status)
         VALUES ($1, $2, 'PRESS_PRODUCTION_STARTED', $3, 'In Production')`,
        [orderId, user.id, row.status],
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

  async pause(user: AuthUser, orderId: string, rawReason: string) {
    ensurePress(user)
    const reason = rawReason.trim()
    if (reason.length < 5) throw new PressError(422, 'PAUSE_REASON_REQUIRED', 'Record a reason for pausing production.', ['reason'])
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const row = await this.lockedRun(client, user, orderId, ['IN_PRODUCTION'])
      await client.query(`UPDATE flowline.production_runs SET status = 'PAUSED', notes = $2 WHERE id = $1`, [row.run_id, reason])
      await client.query(`UPDATE flowline.orders SET status = 'On Hold', version = version + 1 WHERE id = $1`, [orderId])
      await client.query(
        `INSERT INTO flowline.audit_events (order_id, actor_auth_user_id, action, previous_status, new_status, reason)
         VALUES ($1, $2, 'PRESS_PRODUCTION_PAUSED', $3, 'On Hold', $4)`,
        [orderId, user.id, row.status, reason],
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

  async reportProductionIssue(
    user: AuthUser,
    orderId: string,
    input: {
      category: string
      notes: string
      correctiveAction?: string | null
    },
  ) {
    ensurePress(user)
    const category = input.category.trim()
    const notes = input.notes.trim()
    if (!category || notes.length < 10) throw new PressError(422, 'ISSUE_INCOMPLETE', 'Record an issue category and detailed notes.', ['category', 'notes'])
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const row = await this.lockedRun(client, user, orderId, ['IN_PRODUCTION', 'PAUSED'])
      await client.query(
        `INSERT INTO flowline.production_issues (
           order_id, production_run_id, category, notes, corrective_action,
           reported_by_auth_user_id, rework_owner_auth_user_id
         ) VALUES ($1, $2, $3, $4, $5, $6, $6)`,
        [orderId, row.run_id, category, notes, input.correctiveAction?.trim() || null, user.id],
      )
      await client.query(`UPDATE flowline.production_runs SET status = 'ISSUE' WHERE id = $1`, [row.run_id])
      await client.query(`UPDATE flowline.orders SET status = 'Rework Required', version = version + 1 WHERE id = $1`, [orderId])
      await client.query(
        `INSERT INTO flowline.audit_events (order_id, actor_auth_user_id, action, previous_status, new_status, reason)
         VALUES ($1, $2, 'PRESS_PRODUCTION_ISSUE', $3, 'Rework Required', $4)`,
        [orderId, user.id, row.status, `${category}: ${notes}`],
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

  async resolveProductionIssue(user: AuthUser, orderId: string, input: { action: 'RESUME' | 'REVIEW'; resolution: string }) {
    ensurePress(user)
    const resolution = input.resolution.trim()
    if (resolution.length < 10) throw new PressError(422, 'REWORK_RESOLUTION_REQUIRED', 'Record the rework evidence and outcome.', ['resolution'])
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const result = await client.query<
        PressRow & {
          issue_id: string
          issue_status: string
          rework_owner_auth_user_id: string | null
        }
      >(
        `${pressSelect}
         JOIN LATERAL (
           SELECT issue.id AS issue_id, issue.status AS issue_status, issue.rework_owner_auth_user_id
           FROM flowline.production_issues issue
           WHERE issue.order_id = orders.id AND issue.status = 'OPEN'
           ORDER BY issue.reported_at DESC LIMIT 1
         ) open_issue ON true
         WHERE orders.id = $1 AND orders.owner_auth_user_id = $2
           AND orders.stage = 'Press' AND run.operator_auth_user_id = $2
           AND orders.status = 'Rework Required' AND run.status = 'ISSUE'
         FOR UPDATE OF orders, run`,
        [orderId, user.id],
      )
      const row = result.rows[0]
      if (!row) throw new PressError(404, 'REWORK_NOT_FOUND', 'No open rework case is available for this Press job.')
      if (row.rework_owner_auth_user_id !== user.id) throw new PressError(403, 'FORBIDDEN', 'Only the assigned rework owner can resolve this case.')
      const nextStatus = input.action === 'RESUME' ? 'In Production' : 'Scheduled'
      const nextRunStatus = input.action === 'RESUME' ? 'IN_PRODUCTION' : 'ACCEPTED'
      await client.query(`UPDATE flowline.production_issues SET status='RESOLVED', resolved_by_auth_user_id=$2, resolution=$3, resolved_at=clock_timestamp() WHERE id=$1`, [row.issue_id, user.id, resolution])
      await client.query(`UPDATE flowline.production_runs SET status=$2 WHERE id=$1`, [row.run_id, nextRunStatus])
      await client.query(`UPDATE flowline.orders SET status=$2, version=version+1 WHERE id=$1`, [orderId, nextStatus])
      await client.query(`INSERT INTO flowline.audit_events (order_id, actor_auth_user_id, action, previous_status, new_status, reason, details) VALUES ($1,$2,'PRESS_REWORK_RESOLVED',$3,$4,$5,$6)`, [
        orderId,
        user.id,
        'Rework Required',
        nextStatus,
        resolution,
        JSON.stringify({ issueId: row.issue_id, action: input.action }),
      ])
      const creator = await client.query<{
        auth_user_id: string
        order_number: string
      }>(`SELECT created_by_auth_user_id AS auth_user_id, order_number FROM flowline.orders WHERE id=$1`, [orderId])
      const creatorRow = creator.rows[0]
      if (!creatorRow) throw new PressError(404, 'ORDER_NOT_FOUND', 'Order creator was not found.')
      const notification = await client.query<{ id: string; created_at: Date }>(`INSERT INTO flowline.notifications (order_id,type,title,message) VALUES ($1,'PRESS_REWORK_RESOLVED',$2,$3) RETURNING id,created_at`, [
        orderId,
        `Rework update for ${creatorRow.order_number}`,
        `Press recorded rework evidence and ${input.action === 'RESUME' ? 'resumed production' : 'returned the job for Press review'}.`,
      ])
      const recipient = creatorRow.auth_user_id
      if (recipient && recipient !== user.id) await client.query(`INSERT INTO flowline.notification_recipients (notification_id,recipient_auth_user_id) VALUES ($1,$2)`, [notification.rows[0]?.id, recipient])
      await client.query('COMMIT')
      if (recipient && recipient !== user.id && notification.rows[0])
        this.notificationPublisher?.publish(recipient, {
          id: notification.rows[0].id,
          orderId,
          orderNumber: creatorRow.order_number,
          type: 'PRESS_REWORK_RESOLVED',
          title: `Rework update for ${creatorRow.order_number}`,
          message: `Press recorded rework evidence and ${input.action === 'RESUME' ? 'resumed production' : 'returned the job for Press review'}.`,
          createdAt: notification.rows[0].created_at,
          readAt: null,
        })
      return this.getOrder(user, orderId)
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  async complete(user: AuthUser, orderId: string, input: PressCompletionInput) {
    ensurePress(user)
    const fields: string[] = []
    if (!Number.isFinite(input.goodQuantity) || input.goodQuantity <= 0) fields.push('goodQuantity')
    if (!Number.isFinite(input.wasteQuantity) || input.wasteQuantity < 0) fields.push('wasteQuantity')
    if (!input.shippingUserAuthUserId) fields.push('shippingUserAuthUserId')
    if (fields.length) throw new PressError(422, 'COMPLETION_INCOMPLETE', 'Record good quantity, waste quantity, and the Shipping assignee.', fields)

    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const row = await this.lockedRun(client, user, orderId, ['IN_PRODUCTION'])
      if (input.goodQuantity + input.wasteQuantity > Number(row.planned_quantity)) {
        throw new PressError(422, 'QUANTITY_EXCEEDS_PLAN', 'Good and waste quantities cannot exceed the planned quantity.', ['goodQuantity', 'wasteQuantity'])
      }
      const [shippingUser, shippingRole] = await Promise.all([
        client.query<{ auth_user_id: string }>(
          `SELECT profile.auth_user_id
           FROM flowline.user_profiles profile
           JOIN flowline.user_roles user_role ON user_role.user_profile_id = profile.id
           JOIN flowline.roles role ON role.id = user_role.role_id
           WHERE profile.auth_user_id = $1 AND profile.status = 'ACTIVE' AND role.code = 'SHIPPING'`,
          [input.shippingUserAuthUserId],
        ),
        client.query<{ id: string }>(`SELECT id FROM flowline.roles WHERE code = 'SHIPPING'`),
      ])
      if (!shippingUser.rows[0]) throw new PressError(422, 'INVALID_SHIPPING_USER', 'Select an active Shipping user.', ['shippingUserAuthUserId'])

      await client.query(
        `UPDATE flowline.production_runs
         SET status = 'COMPLETED', good_quantity = $2, waste_quantity = $3,
             completed_at = clock_timestamp(), notes = $4
         WHERE id = $1`,
        [row.run_id, input.goodQuantity, input.wasteQuantity, input.notes?.trim() || null],
      )
      await client.query(
        `INSERT INTO flowline.shipments (
           order_id, status, destination, created_by_auth_user_id
         ) VALUES ($1, 'PENDING', $2, $3)`,
        [orderId, row.destination, user.id],
      )
      await client.query(
        `UPDATE flowline.orders
         SET status = 'Ready to Ship', stage = 'Shipping', owner_role_id = $2,
             owner_auth_user_id = $3, version = version + 1
         WHERE id = $1`,
        [orderId, shippingRole.rows[0]?.id ?? null, input.shippingUserAuthUserId],
      )
      await client.query(
        `INSERT INTO flowline.audit_events (
           order_id, actor_auth_user_id, action, previous_status, new_status, reason, details
         ) VALUES ($1, $2, 'PRESS_PRODUCTION_COMPLETED', $3, 'Ready to Ship', $4,
           jsonb_build_object('goodQuantity', $5::numeric, 'wasteQuantity', $6::numeric,
                              'shippingUserAuthUserId', $7::text))`,
        [orderId, user.id, row.status, input.notes?.trim() || null, input.goodQuantity, input.wasteQuantity, input.shippingUserAuthUserId],
      )
      const notificationResult = await client.query<{
        id: string
        created_at: Date
      }>(
        `INSERT INTO flowline.notifications (order_id, type, title, message)
         VALUES ($1, 'PRESS_COMPLETED', $2, $3) RETURNING id, created_at`,
        [orderId, `Order ${row.order_number} ready to ship`, `Production completed with ${input.goodQuantity} good units.`],
      )
      const notification = notificationResult.rows[0]
      if (!notification) throw new Error('Notification insert did not return a row')
      await client.query(
        `INSERT INTO flowline.notification_recipients (notification_id, recipient_auth_user_id)
         VALUES ($1, $2)`,
        [notification.id, input.shippingUserAuthUserId],
      )
      await client.query('COMMIT')

      const item: NotificationItem = {
        id: notification.id,
        orderId,
        orderNumber: row.order_number,
        type: 'PRESS_COMPLETED',
        title: `Order ${row.order_number} ready to ship`,
        message: `Production completed with ${input.goodQuantity} good units.`,
        createdAt: notification.created_at,
        readAt: null,
      }
      this.notificationPublisher?.publish(input.shippingUserAuthUserId!, item)
      return this.getOrder(user, orderId)
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }
}
