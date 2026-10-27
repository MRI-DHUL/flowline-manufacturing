import { ApiRequestError, requestJson } from '../../shared/api/client'

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
    status: string
    reworkOwnerAuthUserId: string | null
  }>
}

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

async function request<T>(path: string, init?: RequestInit) {
  try {
    return await requestJson<T>(path, init)
  } catch (error) {
    if (error instanceof ApiRequestError) {
      throw new PressRequestError(error.status, error.code, error.message || 'The Press request failed.', error.fields)
    }
    throw error
  }
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
  return (
    await request<{ order: PressOrderDetail }>(`/api/v1/press/orders/${orderId}/${action}`, {
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  ).order
}

export function acceptPressOrder(orderId: string) {
  return orderAction(orderId, 'accept')
}
export function startPressOrder(orderId: string) {
  return orderAction(orderId, 'start')
}
export function pausePressOrder(orderId: string, reason: string) {
  return orderAction(orderId, 'pause', { reason })
}
export function reportProductionIssue(orderId: string, input: { category: string; notes: string; correctiveAction: string }) {
  return orderAction(orderId, 'production-issues', input)
}
export function resolveProductionIssue(orderId: string, input: { action: 'RESUME' | 'REVIEW'; resolution: string }) {
  return orderAction(orderId, 'rework/resolve', input)
}
export function completePressOrder(orderId: string, input: { goodQuantity: number; notes: string }) {
  return orderAction(orderId, 'complete', input)
}
