export type ManagerOrder = {
  id: string
  orderNumber: string
  customerName: string | null
  productName: string | null
  status: string
  destination: string | null
  shipmentStatus: string
  carrier: string | null
  trackingOrVehicleNumber: string | null
  expectedDeliveryAt: string | null
  actualDeliveryAt: string | null
  receivedBy: string | null
  proofAttachments: Array<{ id: string; fileName: string; mediaType: string; sizeBytes: number; createdAt: string }>
}
type ErrorBody = { error?: { code?: string; message?: string; fields?: string[] } }
export class ManagerRequestError extends Error {
  readonly fields: string[]
  readonly status: number
  constructor(status: number, body: ErrorBody) {
    super(body.error?.message ?? 'The Manager request failed.')
    this.name = 'ManagerRequestError'
    this.status = status
    this.fields = body.error?.fields ?? []
  }
}
function base() {
  const value = import.meta.env.VITE_API_BASE_URL?.trim()
  if (!value) throw new Error('The Flowline API URL is not configured.')
  return value.replace(/\/$/, '')
}
async function request<T>(path: string, init?: RequestInit) {
  const response = await fetch(`${base()}${path}`, {
    credentials: 'include',
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  })
  const body = (await response.json().catch(() => ({}))) as T & ErrorBody
  if (!response.ok) throw new ManagerRequestError(response.status, body)
  return body
}
export async function listManagerOrders() {
  return (await request<{ orders: ManagerOrder[] }>('/api/v1/manager/orders')).orders
}
export async function uploadManagerProof(orderId: string, file: File) {
  const data = new FormData()
  data.append('file', file)
  const response = await fetch(`${base()}/api/v1/manager/orders/${orderId}/proof`, { method: 'POST', credentials: 'include', body: data })
  const body = (await response.json().catch(() => ({}))) as { order?: ManagerOrder } & ErrorBody
  if (!response.ok || !body.order) throw new ManagerRequestError(response.status, body)
  return body.order
}
export async function confirmManagerDelivery(orderId: string, input: { actualDeliveryAt: string; receivedBy: string }) {
  return (
    await request<{ order: ManagerOrder }>(`/api/v1/manager/orders/${orderId}/confirm-delivery`, {
      method: 'POST',
      body: JSON.stringify(input),
    })
  ).order
}
