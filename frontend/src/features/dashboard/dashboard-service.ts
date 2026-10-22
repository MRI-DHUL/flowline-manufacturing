import type { AuthUser } from '../auth/auth-service'

export type DashboardRole =
  | 'CSR'
  | 'R&D'
  | 'PLANNING'
  | 'PRESS'
  | 'SHIPPING'
  | 'MANAGER'

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
  }
  orders: DashboardOrder[]
}

type ApiError = {
  error?: { code?: string; message?: string }
}

export class DashboardRequestError extends Error {
  readonly status: number
  readonly code: string

  constructor(
    status: number,
    code: string,
    message: string,
  ) {
    super(message)
    this.name = 'DashboardRequestError'
    this.status = status
    this.code = code
  }
}

function getApiBaseUrl() {
  const value = import.meta.env.VITE_API_BASE_URL?.trim()
  if (!value) throw new Error('The Flowline API URL is not configured.')
  return value.replace(/\/$/, '')
}

async function parseResponse<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as ApiError
  if (!response.ok) {
    throw new DashboardRequestError(
      response.status,
      body.error?.code ?? 'REQUEST_FAILED',
      body.error?.message ?? 'The dashboard request failed.',
    )
  }
  return body as T
}

export async function getDashboard(): Promise<DashboardData> {
  const response = await fetch(`${getApiBaseUrl()}/api/v1/dashboard`, {
    credentials: 'include',
  })
  return parseResponse<DashboardData>(response)
}

export async function logout() {
  const response = await fetch(`${getApiBaseUrl()}/api/v1/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  })
  if (!response.ok && response.status !== 204) {
    await parseResponse(response)
  }
}