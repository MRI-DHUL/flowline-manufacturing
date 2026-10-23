import type pg from 'pg'
import type { AuthUser } from '../auth/auth-service.js'

export type OrderActivity = {
  id: string
  action: string
  previousStatus: string | null
  newStatus: string | null
  reason: string | null
  details: Record<string, unknown>
  actorName: string
  occurredAt: Date
}
export class ActivityError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'ActivityError'
  }
}

export class PostgresActivityService {
  constructor(private readonly pool: pg.Pool) {}

  async list(user: AuthUser, orderId: string) {
    if (user.status !== 'ACTIVE') throw new ActivityError(403, 'FORBIDDEN', 'Active account access is required.')
    const result = await this.pool.query<OrderActivity>(
      `SELECT audit.id::text, audit.action, audit.previous_status AS "previousStatus",
              audit.new_status AS "newStatus", audit.reason, audit.details,
              COALESCE(profile.display_name, audit.actor_auth_user_id) AS "actorName",
              audit.occurred_at AS "occurredAt"
       FROM flowline.audit_events audit
       LEFT JOIN flowline.user_profiles profile ON profile.auth_user_id = audit.actor_auth_user_id
       JOIN flowline.orders orders ON orders.id = audit.order_id
       WHERE audit.order_id = $1
         AND ($2 = 'MANAGER' OR $2 = 'SYSTEM_ADMIN'
              OR orders.created_by_auth_user_id = $3
              OR orders.owner_auth_user_id = $3
              OR audit.actor_auth_user_id = $3)
       ORDER BY audit.occurred_at DESC, audit.id DESC`,
      [orderId, user.roles[0] ?? '', user.id],
    )
    if (!result.rows.length) throw new ActivityError(404, 'ORDER_NOT_FOUND', 'Order activity was not found or is not accessible.')
    return result.rows
  }
}
