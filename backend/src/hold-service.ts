import type pg from 'pg'
import type { AuthUser } from './auth-service.js'
import type { NotificationItem, NotificationPublisher } from './notification-service.js'

export type HoldInput = {
  category: string
  reason: string
  responsibleTeam: string
  ownerAuthUserId: string
  correctiveAction?: string | null
  targetResolutionDate: string
}

export type HoldResolutionInput = {
  action: 'RESUME' | 'REVIEW' | 'CANCEL'
  resolution: string
  stage?: string | null
  ownerAuthUserId?: string | null
}

export type HoldRecord = {
  id: string
  orderId: string
  orderNumber: string
  category: string
  reason: string
  responsibleTeam: string
  ownerAuthUserId: string
  correctiveAction: string | null
  targetResolutionDate: string
  previousStatus: string
  previousStage: string
  status: 'OPEN' | 'RESOLVED' | 'CANCELLED'
  placedAt: Date
  resolvedAt: Date | null
}

export type HoldOwner = { authUserId: string; displayName: string; email: string }

export interface HoldService {
  place(user: AuthUser, orderId: string, input: HoldInput): Promise<HoldRecord>
  reassign(user: AuthUser, holdId: string, ownerAuthUserId: string, responsibleTeam: string): Promise<HoldRecord>
  resolve(user: AuthUser, holdId: string, input: HoldResolutionInput): Promise<HoldRecord>
  listForOrder(user: AuthUser, orderId: string): Promise<HoldRecord[]>
  listOwners(user: AuthUser, responsibleTeam: string): Promise<HoldOwner[]>
}

export class HoldError extends Error {
  constructor(public readonly statusCode: number, public readonly code: string, message: string, public readonly fields?: string[]) {
    super(message)
    this.name = 'HoldError'
  }
}

type HoldRow = {
  id: string; order_id: string; order_number: string; category: string; reason: string
  responsible_team: string; owner_auth_user_id: string; corrective_action: string | null
  target_resolution_date: string | Date; previous_status: string; previous_stage: string
  status: 'OPEN' | 'RESOLVED' | 'CANCELLED'; placed_at: Date; resolved_at: Date | null
}

function ensureActive(user: AuthUser) {
  if (user.status !== 'ACTIVE') throw new HoldError(403, 'FORBIDDEN', 'Active account access is required.')
}

function mapHold(row: HoldRow): HoldRecord {
  const date = row.target_resolution_date instanceof Date ? row.target_resolution_date.toISOString().slice(0, 10) : row.target_resolution_date
  return { id: row.id, orderId: row.order_id, orderNumber: row.order_number, category: row.category, reason: row.reason,
    responsibleTeam: row.responsible_team, ownerAuthUserId: row.owner_auth_user_id, correctiveAction: row.corrective_action,
    targetResolutionDate: date, previousStatus: row.previous_status, previousStage: row.previous_stage,
    status: row.status, placedAt: row.placed_at, resolvedAt: row.resolved_at }
}

export class PostgresHoldService implements HoldService {
  constructor(private readonly pool: pg.Pool, private readonly notificationPublisher?: NotificationPublisher) {}

  private async assertOrderAccess(client: pg.PoolClient, user: AuthUser, orderId: string) {
    const result = await client.query<{ id: string; order_number: string; status: string; stage: string; owner_auth_user_id: string | null; created_by_auth_user_id: string }>(
      `SELECT id, order_number, status, stage, owner_auth_user_id, created_by_auth_user_id
       FROM flowline.orders WHERE id = $1 FOR UPDATE`, [orderId])
    const order = result.rows[0]
    if (!order) throw new HoldError(404, 'ORDER_NOT_FOUND', 'Order not found.')
    if (!user.roles.includes('MANAGER') && order.owner_auth_user_id !== user.id && order.created_by_auth_user_id !== user.id) {
      throw new HoldError(403, 'FORBIDDEN', 'You can manage holds only for orders assigned to or created by you.')
    }
    return order
  }

  private async validateOwner(client: pg.PoolClient, ownerAuthUserId: string, responsibleTeam: string) {
    const result = await client.query<{ auth_user_id: string }>(
      `SELECT profile.auth_user_id FROM flowline.user_profiles profile
       JOIN flowline.user_roles user_role ON user_role.user_profile_id = profile.id
       JOIN flowline.roles role ON role.id = user_role.role_id
       WHERE profile.auth_user_id = $1 AND profile.status = 'ACTIVE' AND role.code = $2`,
      [ownerAuthUserId, responsibleTeam])
    if (!result.rows[0]) throw new HoldError(422, 'INVALID_HOLD_OWNER', 'Select an active user from the responsible team.', ['ownerAuthUserId', 'responsibleTeam'])
  }

  private async notify(client: pg.PoolClient, orderId: string, orderNumber: string, actor: AuthUser, ownerAuthUserId: string, type: string, message: string) {
    const managers = await client.query<{ auth_user_id: string }>(
      `SELECT profile.auth_user_id FROM flowline.user_profiles profile
       JOIN flowline.user_roles user_role ON user_role.user_profile_id = profile.id
       JOIN flowline.roles role ON role.id = user_role.role_id
      WHERE profile.status = 'ACTIVE' AND role.code = 'MANAGER' AND profile.auth_user_id <> $1`, [actor.id])
    const recipientIds = [...new Set([ownerAuthUserId, ...managers.rows.map((row) => row.auth_user_id)])].filter((id) => id !== actor.id)
    const notificationResult = await client.query<{ id: string; created_at: Date }>(
      `INSERT INTO flowline.notifications (order_id, type, title, message)
       VALUES ($1, $2, $3, $4) RETURNING id, created_at`, [orderId, type, `Hold requires attention for ${orderNumber}`, message])
    const notification = notificationResult.rows[0]
    if (!notification) throw new Error('Hold notification insert did not return a row')
    for (const recipientId of recipientIds) await client.query(`INSERT INTO flowline.notification_recipients (notification_id, recipient_auth_user_id) VALUES ($1, $2)`, [notification.id, recipientId])
    const item: NotificationItem = { id: notification.id, orderId, orderNumber, type, title: `Hold requires attention for ${orderNumber}`, message, createdAt: notification.created_at, readAt: null }
    for (const recipientId of recipientIds) this.notificationPublisher?.publish(recipientId, item)
  }

  async place(user: AuthUser, orderId: string, input: HoldInput) {
    ensureActive(user)
    if (!input.category.trim() || input.reason.trim().length < 10 || !input.responsibleTeam.trim() || !input.ownerAuthUserId || !input.targetResolutionDate) {
      throw new HoldError(422, 'HOLD_INCOMPLETE', 'Category, reason, responsible team, owner, and target date are required.')
    }
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const order = await this.assertOrderAccess(client, user, orderId)
      if (order.status === 'Delivered' || order.status === 'Cancelled' || order.status === 'On Hold') throw new HoldError(422, 'HOLD_NOT_ALLOWED', 'This order cannot be placed on hold in its current status.')
      await this.validateOwner(client, input.ownerAuthUserId, input.responsibleTeam)
      const result = await client.query<HoldRow>(
        `INSERT INTO flowline.order_holds (order_id, category, reason, responsible_team, owner_auth_user_id, corrective_action, target_resolution_date, previous_status, previous_stage, placed_by_auth_user_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [orderId, input.category.trim(), input.reason.trim(), input.responsibleTeam.trim(), input.ownerAuthUserId, input.correctiveAction?.trim() || null, input.targetResolutionDate, order.status, order.stage, user.id])
      const hold = result.rows[0]
      if (!hold) throw new Error('Hold insert did not return a row')
      await client.query(`UPDATE flowline.orders SET status='On Hold', version=version+1 WHERE id=$1`, [orderId])
      await client.query(`INSERT INTO flowline.order_hold_events (hold_id, order_id, action, actor_auth_user_id, details) VALUES ($1,$2,'PLACED',$3,$4)`, [hold.id, orderId, user.id, JSON.stringify({ category: input.category.trim(), ownerAuthUserId: input.ownerAuthUserId })])
      await client.query(`INSERT INTO flowline.audit_events (order_id, actor_auth_user_id, action, previous_status, new_status, reason, details) VALUES ($1,$2,'ORDER_HOLD_PLACED',$3,'On Hold',$4,$5)`, [orderId, user.id, order.status, input.reason.trim(), JSON.stringify({ holdId: hold.id, targetResolutionDate: input.targetResolutionDate })])
      await this.notify(client, orderId, order.order_number, user, input.ownerAuthUserId, 'ORDER_HOLD_PLACED', `Hold: ${input.category.trim()}. ${input.reason.trim()}`)
      await client.query('COMMIT')
      return mapHold(hold)
    } catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
  }

  async reassign(user: AuthUser, holdId: string, ownerAuthUserId: string, responsibleTeam: string) {
    ensureActive(user)
    if (!ownerAuthUserId || !responsibleTeam.trim()) throw new HoldError(422, 'ASSIGNMENT_INCOMPLETE', 'Select a responsible team and owner.')
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const result = await client.query<HoldRow>(`SELECT hold.*, orders.order_number FROM flowline.order_holds hold JOIN flowline.orders orders ON orders.id=hold.order_id WHERE hold.id=$1 AND hold.status='OPEN' FOR UPDATE`, [holdId])
      const hold = result.rows[0]
      if (!hold) throw new HoldError(404, 'HOLD_NOT_FOUND', 'Open hold not found.')
      if (!user.roles.includes('MANAGER') && hold.owner_auth_user_id !== user.id) throw new HoldError(403, 'FORBIDDEN', 'Only the hold owner or a Manager can reassign this hold.')
      await this.validateOwner(client, ownerAuthUserId, responsibleTeam)
      await client.query(`UPDATE flowline.order_holds SET owner_auth_user_id=$2, responsible_team=$3 WHERE id=$1`, [holdId, ownerAuthUserId, responsibleTeam.trim()])
      await client.query(`INSERT INTO flowline.order_hold_events (hold_id, order_id, action, actor_auth_user_id, details) VALUES ($1,$2,'REASSIGNED',$3,$4)`, [holdId, hold.order_id, user.id, JSON.stringify({ ownerAuthUserId, responsibleTeam })])
      await this.notify(client, hold.order_id, hold.order_number, user, ownerAuthUserId, 'ORDER_HOLD_REASSIGNED', `Hold ownership moved to ${responsibleTeam}.`)
      await client.query('COMMIT')
      return mapHold({ ...hold, owner_auth_user_id: ownerAuthUserId, responsible_team: responsibleTeam.trim() })
    } catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
  }

  async resolve(user: AuthUser, holdId: string, input: HoldResolutionInput) {
    ensureActive(user)
    if (input.resolution.trim().length < 10) throw new HoldError(422, 'RESOLUTION_INCOMPLETE', 'Describe the resolution in at least 10 characters.', ['resolution'])
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const result = await client.query<HoldRow>(`SELECT hold.*, orders.order_number FROM flowline.order_holds hold JOIN flowline.orders orders ON orders.id=hold.order_id WHERE hold.id=$1 AND hold.status='OPEN' FOR UPDATE`, [holdId])
      const hold = result.rows[0]
      if (!hold) throw new HoldError(404, 'HOLD_NOT_FOUND', 'Open hold not found.')
      if (!user.roles.includes('MANAGER') && hold.owner_auth_user_id !== user.id) throw new HoldError(403, 'FORBIDDEN', 'Only the hold owner or a Manager can resolve this hold.')
      const nextStage = input.action === 'REVIEW' ? (input.stage?.trim() || hold.previous_stage) : hold.previous_stage
      const nextStatus = input.action === 'CANCEL' ? 'Cancelled' : input.action === 'REVIEW' ? `${nextStage} Review` : hold.previous_status
      if (input.action === 'REVIEW' && !input.stage?.trim()) throw new HoldError(422, 'REVIEW_STAGE_REQUIRED', 'Select the stage for re-review.', ['stage'])
      const nextOwner = input.ownerAuthUserId ?? null
      if (input.action === 'REVIEW' && !nextOwner) throw new HoldError(422, 'REVIEW_OWNER_REQUIRED', 'Select the owner for re-review.', ['ownerAuthUserId'])
      if (nextOwner) {
        const role = nextStage === 'R&D' ? 'R&D' : nextStage.toUpperCase()
        await this.validateOwner(client, nextOwner, role)
      }
      await client.query(`UPDATE flowline.order_holds SET status=$2, resolved_by_auth_user_id=$3, resolution=$4, resolved_at=clock_timestamp() WHERE id=$1`, [holdId, input.action === 'CANCEL' ? 'CANCELLED' : 'RESOLVED', user.id, input.resolution.trim()])
      await client.query(`UPDATE flowline.orders SET status=$2, stage=$3, owner_auth_user_id=COALESCE($4, owner_auth_user_id), version=version+1 WHERE id=$1`, [hold.order_id, nextStatus, nextStage, nextOwner])
      await client.query(`INSERT INTO flowline.order_hold_events (hold_id, order_id, action, actor_auth_user_id, details) VALUES ($1,$2,$3,$4,$5)`, [holdId, hold.order_id, input.action === 'CANCEL' ? 'CANCELLED' : 'RESOLVED', user.id, JSON.stringify({ resolution: input.resolution.trim(), stage: nextStage })])
      await client.query(`INSERT INTO flowline.audit_events (order_id, actor_auth_user_id, action, previous_status, new_status, reason, details) VALUES ($1,$2,'ORDER_HOLD_RESOLVED',$3,$4,$5,$6)`, [hold.order_id, user.id, 'On Hold', nextStatus, input.resolution.trim(), JSON.stringify({ holdId, action: input.action, stage: nextStage })])
      await client.query('COMMIT')
      return mapHold({ ...hold, status: input.action === 'CANCEL' ? 'CANCELLED' : 'RESOLVED', resolved_at: new Date() })
    } catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
  }

  async listForOrder(user: AuthUser, orderId: string) {
    ensureActive(user)
    const result = await this.pool.query<HoldRow>(`SELECT hold.*, orders.order_number FROM flowline.order_holds hold JOIN flowline.orders orders ON orders.id=hold.order_id WHERE hold.order_id=$1 AND ($2='MANAGER' OR orders.owner_auth_user_id=$3 OR orders.created_by_auth_user_id=$3 OR hold.owner_auth_user_id=$3) ORDER BY hold.placed_at DESC`, [orderId, user.roles.includes('MANAGER') ? 'MANAGER' : '', user.id])
    return result.rows.map(mapHold)
  }

  async listOwners(user: AuthUser, responsibleTeam: string) {
    ensureActive(user)
    const result = await this.pool.query<HoldOwner>(
      `SELECT profile.auth_user_id AS "authUserId", profile.display_name AS "displayName", profile.email
       FROM flowline.user_profiles profile
       JOIN flowline.user_roles user_role ON user_role.user_profile_id = profile.id
       JOIN flowline.roles role ON role.id = user_role.role_id
       WHERE profile.status = 'ACTIVE' AND role.code = $1
       ORDER BY profile.display_name`, [responsibleTeam.trim()])
    return result.rows
  }
}