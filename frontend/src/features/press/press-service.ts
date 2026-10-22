export type PressOrderSummary = {
  id: string
  orderNumber: string
  customerName: string | null
  productName: string | null
  status: string
  priority: string | null
  requestedDeliveryDate: string | null
  plannedQuantity: number
  runStatus: string
  productionLineName: string | null
  updatedAt: string
}

export type ShippingUser = { authUserId: string; displayName: string; email: string }

export type PressOrderDetail = PressOrderSummary & {
  destination: string | null
  packagingType: string | null
  dimensions: string | null
  material: string | null
  printColors: string | null
  technicalNotes: string | null
  runId: string
  goodQuantity: number | null
  wasteQuantity: number | null
  startedAt: string | null
  completedAt: string | null
  notes: string | null
  issues: Array<{
    id: string
    category: string
    notes: string
    correctiveAction: string | null
    reportedAt: string
    resolvedAt: string | null
  }>
}

type ErrorBody = { error?: { code?: string; message?: string; fields?: string[] } }

export class PressRequestError extends Error {
  readonly status: number
  readonly code: string
  readonly fields: string[]

  constructor(status: number, code: string, message: string, fields: string[] = []) {
    super(message)
    this.name = 'PressRequestError'
    this.status = status
    this.code = code
    this.fields = fields
  }
}

function apiBase() {
  const value = import.meta.env.VITE_API_BASE_URL?.trim()
  if (!value) throw new Error('The Flowline API URL is not configured.')
  return value.replace(/\/$/, '')
}

async function request<T>(path: string, init?: RequestInit) {
  const response = await fetch(`${apiBase()}${path}`, {
    credentials: 'include',
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  })
  const body = (await response.json().catch(() => ({}))) as ErrorBody
  if (!response.ok) throw new PressRequestError(response.status, body.error?.code ?? 'REQUEST_FAILED', body.error?.message ?? 'The Press request failed.', body.error?.fields ?? [])
  return body as T
}

export async function listPressOrders() {
  return (await request<{ orders: PressOrderSummary[] }>('/api/v1/press/orders')).orders
}

export async function listShippingUsers() {
  return (await request<{ users: ShippingUser[] }>('/api/v1/press/shipping-users')).users
}

export async function getPressOrder(orderId: string) {
  return (await request<{ order: PressOrderDetail }>(`/api/v1/press/orders/${orderId}`)).order
}

async function orderAction(orderId: string, action: string, body?: unknown) {
  return (await request<{ order: PressOrderDetail }>(`/api/v1/press/orders/${orderId}/${action}`, {
    method: 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
  })).order
}

export function acceptPressOrder(orderId: string) { return orderAction(orderId, 'accept') }
export function startPressOrder(orderId: string) { return orderAction(orderId, 'start') }
export function pausePressOrder(orderId: string, reason: string) { return orderAction(orderId, 'pause', { reason }) }
export function reportProductionIssue(orderId: string, input: { category: string; notes: string; correctiveAction: string }) { return orderAction(orderId, 'production-issues', input) }
export function completePressOrder(orderId: string, input: { goodQuantity: number; wasteQuantity: number; notes: string; shippingUserAuthUserId: string }) { return orderAction(orderId, 'complete', input) }
