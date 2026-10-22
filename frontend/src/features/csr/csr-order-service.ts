export type OrderPatch = {
  customerName?: string | null
  destination?: string | null
  productName?: string | null
  productDescription?: string | null
  orderType?: string | null
  packagingType?: string | null
  dimensions?: string | null
  material?: string | null
  printColors?: string | null
  requestedQuantity?: number | null
  requestedDeliveryDate?: string | null
  technicalNotes?: string | null
  priority?: 'Normal' | 'High' | null
}

export type CsrOrderSummary = {
  id: string
  orderNumber: string
  customerName: string | null
  productName: string | null
  status: string
  stage: string
  assignedReviewer: CsrReviewer | null
  priority: string | null
  requestedDeliveryDate: string | null
  createdAt: string
  updatedAt: string
  openClarifications: number
}

export type CsrOrderDetail = CsrOrderSummary & {
  destination: string | null
  productDescription: string | null
  orderType: string | null
  packagingType: string | null
  dimensions: string | null
  material: string | null
  printColors: string | null
  requestedQuantity: number | null
  technicalNotes: string | null
  assignedReviewer: CsrReviewer | null
  attachments: Array<{
    id: string
    fileName: string
    mediaType: string
    sizeBytes: number
    createdAt: string
  }>
  clarifications: Array<{
    id: string
    stage: string
    question: string
    status: string
    requestedAt: string
    response: string | null
    respondedAt: string | null
  }>
  activity: Array<{
    id: string
    action: string
    previousStatus: string | null
    newStatus: string | null
    reason: string | null
    details: Record<string, unknown>
    occurredAt: string
  }>
}

type ErrorBody = {
  error?: { code?: string; message?: string; fields?: string[] }
}

export class CsrRequestError extends Error {
  readonly status: number
  readonly code: string
  readonly fields: string[]

  constructor(status: number, code: string, message: string, fields: string[] = []) {
    super(message)
    this.name = 'CsrRequestError'
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

async function parse<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as ErrorBody
  if (!response.ok) {
    throw new CsrRequestError(
      response.status,
      body.error?.code ?? 'REQUEST_FAILED',
      body.error?.message ?? 'The order request failed.',
      body.error?.fields ?? [],
    )
  }
  return body as T
}

async function request<T>(path: string, init?: RequestInit) {
  const response = await fetch(`${apiBase()}${path}`, {
    credentials: 'include',
    ...init,
    headers: init?.body instanceof FormData ? init.headers : { 'content-type': 'application/json', ...init?.headers },
  })
  return parse<T>(response)
}

export async function listCsrOrders(filters: { search?: string; status?: string } = {}) {
  const query = new URLSearchParams()
  if (filters.search) query.set('search', filters.search)
  if (filters.status && filters.status !== 'All') query.set('status', filters.status)
  const suffix = query.size ? `?${query}` : ''
  const result = await request<{ orders: CsrOrderSummary[] }>(`/api/v1/orders${suffix}`)
  return result.orders
}

export async function getCsrOrder(orderId: string) {
  const result = await request<{ order: CsrOrderDetail }>(`/api/v1/orders/${orderId}`)
  return result.order
}

export async function createCsrDraft(patch: OrderPatch) {
  const result = await request<{ order: CsrOrderDetail }>('/api/v1/orders', {
    method: 'POST',
    body: JSON.stringify(patch),
  })
  return result.order
}

export async function updateCsrDraft(orderId: string, patch: OrderPatch) {
  const result = await request<{ order: CsrOrderDetail }>(`/api/v1/orders/${orderId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
  return result.order
}

export async function submitCsrOrder(orderId: string) {
  const result = await request<{ order: CsrOrderDetail }>(`/api/v1/orders/${orderId}/submit`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
  return result.order
}

export async function uploadCsrAttachment(orderId: string, file: File) {
  const body = new FormData()
  body.append('file', file)
  const result = await request<{ order: CsrOrderDetail }>(`/api/v1/orders/${orderId}/attachments`, {
    method: 'POST',
    body,
  })
  return result.order
}

export async function deleteCsrAttachment(orderId: string, attachmentId: string) {
  const result = await request<{ order: CsrOrderDetail }>(`/api/v1/orders/${orderId}/attachments/${attachmentId}`, { method: 'DELETE' })
  return result.order
}

export async function downloadCsrAttachment(orderId: string, attachmentId: string, fileName: string) {
  const response = await fetch(`${apiBase()}/api/v1/orders/${orderId}/attachments/${attachmentId}`, {
    credentials: 'include',
  })
  if (!response.ok) await parse(response)
  const url = URL.createObjectURL(await response.blob())
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

export async function respondToCsrClarification(orderId: string, clarificationId: string, response: string) {
  const result = await request<{ order: CsrOrderDetail }>(`/api/v1/orders/${orderId}/clarifications/${clarificationId}/respond`, {
    method: 'POST',
    body: JSON.stringify({ response }),
  })
  return result.order
}

export type CsrReviewer = {
  authUserId: string
  displayName: string
  email: string
}

export async function listRdReviewers() {
  const result = await request<{ reviewers: CsrReviewer[] }>('/api/v1/reviewers/rd')
  return result.reviewers
}

export async function assignCsrRdReviewer(orderId: string, reviewerAuthUserId: string) {
  const result = await request<{ order: CsrOrderDetail }>(`/api/v1/orders/${orderId}/assign-rd`, {
    method: 'POST',
    body: JSON.stringify({ reviewerAuthUserId }),
  })
  return result.order
}

export type CsrOrderStatusRow = {
  eventId: string
  orderId: string
  orderNumber: string
  orderName: string | null
  orderPlacedAt: string
  currentStatus: string
  status: string
  completedBy: string
  completedAt: string
  transitionDurationSeconds: number | null
  statusDurationSeconds: number
  current: boolean
  comments: string | null
  action: string
}

export async function listCsrOrderStatuses() {
  const result = await request<{ statuses: CsrOrderStatusRow[] }>('/api/v1/csr/order-status')
  return result.statuses
}
