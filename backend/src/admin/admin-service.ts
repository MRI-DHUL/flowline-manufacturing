import type pg from 'pg'
import type { AuthUser } from '../auth/auth-service.js'
export type AdminUser = {
  authUserId: string
  displayName: string
  email: string
  status: 'PENDING' | 'ACTIVE' | 'DISABLED'
  roles: string[]
}

export type AdminOrder = {
  id: string
  orderNumber: string
  customerName: string
  productName: string
  status: string
  stage: string
  priority: string | null
  owner: string
  requestedDeliveryDate: string
  createdAt: string
  updatedAt: string
  shipmentStatus: string | null
  carrier: string | null
  trackingOrVehicleNumber: string | null
  expectedDeliveryAt: string | null
  actualDeliveryAt: string | null
  receivedBy: string | null
}

export interface AdminService {
  listUsers(user: AuthUser): Promise<AdminUser[]>
  listOrders(user: AuthUser): Promise<AdminOrder[]>
  updateUser(user: AuthUser, userId: string, input: { status: 'PENDING' | 'ACTIVE' | 'DISABLED'; role: string }): Promise<AdminUser>
}
export class AdminError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'AdminError'
  }
}
function ensure(user: AuthUser) {
  if (!user.roles.includes('SYSTEM_ADMIN')) throw new AdminError(403, 'FORBIDDEN', 'System administrator access is required.')
}
export class PostgresAdminService implements AdminService {
  constructor(private readonly pool: pg.Pool) {}
  private async row(userId: string) {
    const result = await this.pool.query<AdminUser>(
      `SELECT profile.auth_user_id AS "authUserId",profile.display_name AS "displayName",profile.email,profile.status,COALESCE(array_agg(role.code) FILTER (WHERE role.code IS NOT NULL),'{}') AS roles FROM flowline.user_profiles profile LEFT JOIN flowline.user_roles user_role ON user_role.user_profile_id=profile.id LEFT JOIN flowline.roles role ON role.id=user_role.role_id WHERE profile.auth_user_id=$1 GROUP BY profile.id`,
      [userId],
    )
    return result.rows[0]
  }
  async listUsers(user: AuthUser) {
    ensure(user)
    const result = await this.pool.query<AdminUser>(
      `SELECT profile.auth_user_id AS "authUserId",profile.display_name AS "displayName",profile.email,profile.status,COALESCE(array_agg(role.code) FILTER (WHERE role.code IS NOT NULL),'{}') AS roles FROM flowline.user_profiles profile LEFT JOIN flowline.user_roles user_role ON user_role.user_profile_id=profile.id LEFT JOIN flowline.roles role ON role.id=user_role.role_id GROUP BY profile.id ORDER BY profile.status,profile.display_name`,
    )
    return result.rows
  }

  async listOrders(user: AuthUser) {
    ensure(user)
    const result = await this.pool.query<AdminOrder>(
      `SELECT
         orders.id,
         orders.order_number AS "orderNumber",
         orders.customer_name AS "customerName",
         orders.product_name AS "productName",
         orders.status,
         orders.stage,
         orders.priority,
         COALESCE(owner_profile.display_name, owner_role.name, 'Unassigned') AS owner,
         orders.requested_delivery_date::text AS "requestedDeliveryDate",
         orders.created_at::text AS "createdAt",
         orders.updated_at::text AS "updatedAt",
         shipment.status AS "shipmentStatus",
         shipment.carrier,
         shipment.tracking_or_vehicle_number AS "trackingOrVehicleNumber",
         shipment.expected_delivery_at::text AS "expectedDeliveryAt",
         shipment.actual_delivery_at::text AS "actualDeliveryAt",
         shipment.received_by AS "receivedBy"
       FROM flowline.orders AS orders
       LEFT JOIN flowline.user_profiles AS owner_profile ON owner_profile.auth_user_id = orders.owner_auth_user_id
       LEFT JOIN flowline.roles AS owner_role ON owner_role.id = orders.owner_role_id
       LEFT JOIN LATERAL (
         SELECT item.*
         FROM flowline.shipments AS item
         WHERE item.order_id = orders.id
         ORDER BY item.created_at DESC
         LIMIT 1
       ) AS shipment ON true
       ORDER BY orders.updated_at DESC, orders.order_number DESC`,
    )
    return result.rows
  }

  async updateUser(user: AuthUser, userId: string, input: { status: 'PENDING' | 'ACTIVE' | 'DISABLED'; role: string }) {
    ensure(user)
    if (user.id === userId && input.status !== 'ACTIVE') throw new AdminError(422, 'SELF_LOCKOUT', 'You cannot disable your own active account.')
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const role = await client.query<{ id: string }>(`SELECT id FROM flowline.roles WHERE code=$1`, [input.role])
      if (!role.rows[0]) throw new AdminError(422, 'INVALID_ROLE', 'Select a valid role.')
      await client.query(`UPDATE flowline.user_profiles SET status=$2 WHERE auth_user_id=$1`, [userId, input.status])
      await client.query(`DELETE FROM flowline.user_roles WHERE user_profile_id=(SELECT id FROM flowline.user_profiles WHERE auth_user_id=$1)`, [userId])
      await client.query(`INSERT INTO flowline.user_roles(user_profile_id,role_id,assigned_by_auth_user_id) SELECT id,$2,$3 FROM flowline.user_profiles WHERE auth_user_id=$1`, [userId, role.rows[0].id, user.id])
      await client.query('COMMIT')
      const updated = await this.row(userId)
      if (!updated) throw new AdminError(404, 'USER_NOT_FOUND', 'User not found.')
      return updated
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }
}
