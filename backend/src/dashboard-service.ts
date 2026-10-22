import type pg from 'pg'
import type { AuthUser } from './auth-service.js'

const supportedRoles = ['CSR', 'R&D', 'PLANNING', 'PRESS', 'SHIPPING', 'MANAGER', 'SYSTEM_ADMIN'] as const

export type DashboardRole = (typeof supportedRoles)[number]

type DashboardMetrics = {
  total: number
  active: number
  attention: number
  aging: number
  completed: number
  inProduction: number
}

type AnalyticsPoint = {
  label: string
  count: number
}

type TrendPoint = {
  date: string
  count: number
}

type DashboardOrder = {
  id: string
  orderNumber: string
  customer: string
  product: string
  status: string
  stage: string
  owner: string
  priority: string | null
  requestedDate: string
  ageDays: number
  slaRisk: boolean
}

export type DashboardData = {
  user: AuthUser
  role: DashboardRole
  metrics: DashboardMetrics
  analytics: {
    stages: AnalyticsPoint[]
    statuses: AnalyticsPoint[]
    trend: TrendPoint[]
  }
  orders: DashboardOrder[]
}

export interface DashboardService {
  getDashboard(user: AuthUser): Promise<DashboardData>
}

type MetricsRow = {
  total: string
  active: string
  attention: string
  aging: string
  completed: string
  in_production: string
}

type CountRow = {
  label: string
  count: string
}

type TrendRow = {
  date: string
  count: string
}

type OrderRow = {
  id: string
  order_number: string
  customer_name: string
  product_name: string
  status: string
  stage: string
  owner: string | null
  priority: string | null
  requested_delivery_date: string
  age_days: number
  sla_risk: boolean
}

const stageByRole: Record<Exclude<DashboardRole, 'CSR' | 'MANAGER' | 'SYSTEM_ADMIN'>, string> = {
  'R&D': 'R&D',
  PLANNING: 'Planning',
  PRESS: 'Press',
  SHIPPING: 'Shipping',
}

export class DashboardAccessError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DashboardAccessError'
  }
}

function selectRole(roles: string[]): DashboardRole {
  const role = roles.find((candidate): candidate is DashboardRole => supportedRoles.includes(candidate as DashboardRole))
  if (!role) {
    throw new DashboardAccessError('Your account is awaiting administrator role assignment.')
  }
  return role
}

export class PostgresDashboardService implements DashboardService {
  constructor(private readonly pool: pg.Pool) {}

  async getDashboard(user: AuthUser): Promise<DashboardData> {
    if (user.status !== 'ACTIVE') {
      throw new DashboardAccessError('Your account is awaiting administrator activation.')
    }

    const role = selectRole(user.roles)
    const stage = role === 'CSR' || role === 'MANAGER' || role === 'SYSTEM_ADMIN' ? null : stageByRole[role]
    const visibility = `
      (($1 = 'MANAGER' AND orders.status = 'Manager Review' AND orders.owner_auth_user_id = $2)
      OR $1 = 'SYSTEM_ADMIN')
      OR ($1 = 'CSR' AND orders.created_by_auth_user_id = $2)
      OR ($3::text IS NOT NULL AND orders.stage = $3 AND orders.owner_auth_user_id = $2)
    `

    const [metricsResult, ordersResult, stagesResult, statusesResult, trendResult] = await Promise.all([
      this.pool.query<MetricsRow>(
        `
          SELECT
            count(*) AS total,
            count(*) FILTER (WHERE status <> 'Delivered') AS active,
            count(*) FILTER (WHERE status IN ('On Hold', 'Rework Required')) AS attention,
            count(*) FILTER (
              WHERE status <> 'Delivered'
                AND CASE stage WHEN 'R&D' THEN clock_timestamp()::date - created_at::date >= 2 WHEN 'Planning' THEN clock_timestamp()::date - created_at::date >= 2 WHEN 'Press' THEN clock_timestamp()::date - created_at::date >= 3 WHEN 'Shipping' THEN clock_timestamp()::date - created_at::date >= 2 WHEN 'Delivered' THEN false ELSE clock_timestamp()::date - created_at::date >= 1 END
            ) AS aging,
            count(*) FILTER (WHERE status = 'Delivered') AS completed,
            count(*) FILTER (WHERE status = 'In Production') AS in_production
          FROM flowline.orders
          WHERE ${visibility}
        `,
        [role, user.id, stage],
      ),
      this.pool.query<OrderRow>(
        `
          SELECT
            orders.id,
            orders.order_number,
            orders.customer_name,
            orders.product_name,
            orders.status,
            orders.stage,
            COALESCE(owner_role.name, orders.owner_auth_user_id, 'Unassigned') AS owner,
            orders.priority,
            orders.requested_delivery_date::text,
            (clock_timestamp()::date - orders.created_at::date)::integer AS age_days,
            CASE orders.stage WHEN 'R&D' THEN clock_timestamp()::date - orders.created_at::date >= 2 WHEN 'Planning' THEN clock_timestamp()::date - orders.created_at::date >= 2 WHEN 'Press' THEN clock_timestamp()::date - orders.created_at::date >= 3 WHEN 'Shipping' THEN clock_timestamp()::date - orders.created_at::date >= 2 WHEN 'Delivered' THEN false ELSE clock_timestamp()::date - orders.created_at::date >= 1 END AS sla_risk
          FROM flowline.orders
          LEFT JOIN flowline.roles AS owner_role ON owner_role.id = orders.owner_role_id
          WHERE ${visibility}
          ORDER BY
            CASE orders.priority WHEN 'High' THEN 0 ELSE 1 END,
            orders.requested_delivery_date,
            orders.updated_at DESC
          LIMIT 20
        `,
        [role, user.id, stage],
      ),
      this.pool.query<CountRow>(
        `
          SELECT orders.stage AS label, count(*) AS count
          FROM flowline.orders AS orders
          WHERE ${visibility}
          GROUP BY orders.stage
          ORDER BY min(CASE orders.stage
            WHEN 'R&D' THEN 1
            WHEN 'Planning' THEN 2
            WHEN 'Press' THEN 3
            WHEN 'Shipping' THEN 4
            WHEN 'Delivered' THEN 5
            ELSE 6
          END)
        `,
        [role, user.id, stage],
      ),
      this.pool.query<CountRow>(
        `
          SELECT orders.status AS label, count(*) AS count
          FROM flowline.orders AS orders
          WHERE ${visibility}
          GROUP BY orders.status
          ORDER BY count(*) DESC, orders.status
        `,
        [role, user.id, stage],
      ),
      this.pool.query<TrendRow>(
        `
          WITH days AS (
            SELECT generate_series(
              clock_timestamp()::date - interval '6 days',
              clock_timestamp()::date,
              interval '1 day'
            )::date AS date
          ),
          visible_orders AS (
            SELECT orders.created_at::date AS created_date
            FROM flowline.orders AS orders
            WHERE ${visibility}
              AND orders.created_at >= clock_timestamp()::date - interval '6 days'
          )
          SELECT
            to_char(days.date, 'YYYY-MM-DD') AS date,
            count(visible_orders.created_date) AS count
          FROM days
          LEFT JOIN visible_orders ON visible_orders.created_date = days.date
          GROUP BY days.date
          ORDER BY days.date
        `,
        [role, user.id, stage],
      ),
    ])
    const metrics = metricsResult.rows[0]
    if (!metrics) throw new Error('Dashboard metrics query returned no row')

    return {
      user,
      role,
      metrics: {
        total: Number(metrics.total),
        active: Number(metrics.active),
        attention: Number(metrics.attention),
        aging: Number(metrics.aging),
        completed: Number(metrics.completed),
        inProduction: Number(metrics.in_production),
      },
      analytics: {
        stages: stagesResult.rows.map((point) => ({
          label: point.label,
          count: Number(point.count),
        })),
        statuses: statusesResult.rows.map((point) => ({
          label: point.label,
          count: Number(point.count),
        })),
        trend: trendResult.rows.map((point) => ({
          date: point.date,
          count: Number(point.count),
        })),
      },
      orders: ordersResult.rows.map((order) => ({
        id: order.id,
        orderNumber: order.order_number,
        customer: order.customer_name,
        product: order.product_name,
        status: order.status,
        stage: order.stage,
        owner: order.owner ?? 'Unassigned',
        priority: order.priority,
        requestedDate: order.requested_delivery_date,
        ageDays: order.age_days,
        slaRisk: order.sla_risk,
      })),
    }
  }
}
