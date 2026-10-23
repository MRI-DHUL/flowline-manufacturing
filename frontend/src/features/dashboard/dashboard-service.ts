import type { AuthUser } from '../auth/auth-service'
import { ApiRequestError, requestJson } from '../../shared/api/client'

export type DashboardRole = 'CSR' | 'R&D' | 'PLANNING' | 'PRESS' | 'SHIPPING' | 'MANAGER' | 'SYSTEM_ADMIN'

export type DashboardOrder = {
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
  metrics: {
    total: number
    active: number
    attention: number
    aging: number
    completed: number
    inProduction: number
  }
  analytics: {
    stages: Array<{ label: string; count: number }>
    statuses: Array<{ label: string; count: number }>
    trend: Array<{ date: string; count: number }>
    delivery: { delivered: number; onHold: number; openIssues: number; weekStart: string; weekEnd: string }
  }
  orders: DashboardOrder[]
}

export class DashboardRequestError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'DashboardRequestError'
    this.status = status
    this.code = code
  }
}

async function dashboardRequest<T>(path: string, init?: RequestInit) {
  try {
    return await requestJson<T>(path, init)
  } catch (error) {
    if (error instanceof ApiRequestError) {
      throw new DashboardRequestError(error.status, error.code, error.message || 'The dashboard request failed.')
    }
    throw error
  }
}

export async function getDashboard(): Promise<DashboardData> {
  return dashboardRequest<DashboardData>('/api/v1/dashboard')
}

export async function logout() {
  await dashboardRequest('/api/v1/auth/logout', { method: 'POST' })
}
