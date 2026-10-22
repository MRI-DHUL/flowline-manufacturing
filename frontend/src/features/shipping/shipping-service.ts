export type ShippingOrderSummary = {
  id: string
  orderNumber: string
  customerName: string | null
  productName: string | null
  status: string
  priority: string | null
  requestedDeliveryDate: string | null
  destination: string | null
  shipmentStatus: string
  updatedAt: string
}
export type ManagerUser = { authUserId: string; displayName: string; email: string }
export type ShippingOrderDetail = ShippingOrderSummary & {
  shipmentId: string
  carrier: string | null
  trackingOrVehicleNumber: string | null
  dispatchAt: string | null
  shippedQuantity: number | null
  expectedDeliveryAt: string | null
  actualDeliveryAt: string | null
  receivedBy: string | null
  goodQuantity: number | null
  proofAttachments: Array<{ id: string; fileName: string; mediaType: string; sizeBytes: number; createdAt: string }>
  deliveryIssues: Array<{ id: string; category: string; notes: string; reportedAt: string; resolvedAt: string | null }>
}
type ErrorBody = { error?: { code?: string; message?: string; fields?: string[] } }
export class ShippingRequestError extends Error {
  readonly status: number
  readonly code: string
  readonly fields: string[]
  constructor(status: number, code: string, message: string, fields: string[] = []) {
    super(message)
    this.name = 'ShippingRequestError'
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
async function parse<T>(response: Response) {
  const body = (await response.json().catch(() => ({}))) as ErrorBody
  if (!response.ok)
    throw new ShippingRequestError(
      response.status,
      body.error?.code ?? 'REQUEST_FAILED',
      body.error?.message ?? 'The Shipping request failed.',
      body.error?.fields ?? [],
    )
  return body as T
}
async function request<T>(path: string, init?: RequestInit) {
  return parse<T>(
    await fetch(`${apiBase()}${path}`, {
      credentials: 'include',
      ...init,
      headers: { ...(init?.body !== undefined ? { 'content-type': 'application/json' } : {}), ...init?.headers },
    }),
  )
}
export async function listShippingOrders() {
  return (await request<{ orders: ShippingOrderSummary[] }>('/api/v1/shipping/orders')).orders
}
export async function listShippingManagerUsers() {
  return (await request<{ users: ManagerUser[] }>('/api/v1/shipping/manager-users')).users
}
export async function getShippingOrder(orderId: string) {
  return (await request<{ order: ShippingOrderDetail }>(`/api/v1/shipping/orders/${orderId}`)).order
}
async function action(orderId: string, name: string, body?: unknown) {
  return (
    await request<{ order: ShippingOrderDetail }>(`/api/v1/shipping/orders/${orderId}/${name}`, {
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  ).order
}
export function verifyShippingReady(orderId: string) {
  return action(orderId, 'verify-ready')
}
export function dispatchShippingOrder(
  orderId: string,
  input: {
    carrier: string
    trackingOrVehicleNumber: string
    dispatchAt: string
    shippedQuantity: number
    destination: string
    expectedDeliveryAt: string
  },
) {
  return action(orderId, 'dispatch', input)
}
export function reportDeliveryIssue(orderId: string, input: { category: string; notes: string; managerUserAuthUserId: string }) {
  return action(orderId, 'delivery-issues', input)
}
export function confirmShippingDelivery(orderId: string, input: { actualDeliveryAt: string; receivedBy: string }) {
  return action(orderId, 'confirm-delivery', input)
}
export async function uploadDeliveryProof(orderId: string, file: File) {
  const data = new FormData()
  data.append('file', file)
  const response = await fetch(`${apiBase()}/api/v1/shipping/orders/${orderId}/proof`, {
    method: 'POST',
    credentials: 'include',
    body: data,
  })
  return (await parse<{ order: ShippingOrderDetail }>(response)).order
}
