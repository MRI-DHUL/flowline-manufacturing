import { ApiRequestError, requestFormData, requestJson } from '../../shared/api/client'

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
async function request<T>(path: string, init?: RequestInit) {
  try {
    return await requestJson<T>(path, init)
  } catch (error) {
    if (error instanceof ApiRequestError) {
      throw new ShippingRequestError(error.status, error.code, error.message || 'The Shipping request failed.', error.fields)
    }
    throw error
  }
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
export function handoffToManager(orderId: string, managerUserAuthUserId: string) {
  return action(orderId, 'manager-handoff', { managerUserAuthUserId })
}
export function confirmShippingDelivery(orderId: string, input: { actualDeliveryAt: string; receivedBy: string }) {
  return action(orderId, 'confirm-delivery', input)
}
export async function uploadDeliveryProof(orderId: string, file: File) {
  const data = new FormData()
  data.append('file', file)
  return (await requestFormData<{ order: ShippingOrderDetail }>(`/api/v1/shipping/orders/${orderId}/proof`, data)).order
}
