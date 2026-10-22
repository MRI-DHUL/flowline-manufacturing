export type RdOrderSummary = {
  id: string
  orderNumber: string
  customerName: string | null
  productName: string | null
  status: string
  stage: string
  priority: string | null
  requestedDeliveryDate: string | null
  createdAt: string
  updatedAt: string
  openClarifications: number
}

export type RdOrderDetail = RdOrderSummary & {
  destination: string | null
  productDescription: string | null
  orderType: string | null
  packagingType: string | null
  dimensions: string | null
  material: string | null
  printColors: string | null
  requestedQuantity: number | null
  technicalNotes: string | null
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
  technicalReviews: Array<{
    id: string
    decision: string
    technicalComments: string
    toolingRequirements: string | null
    materialRecommendation: string | null
    constraintsAndRisks: string | null
    reviewerAuthUserId: string
    reviewerName: string
    decidedAt: string
  }>
  activity: Array<{
    id: string
    action: string
    previousStatus: string | null
    newStatus: string | null
    reason: string | null
    occurredAt: string
  }>
}

export type RdDecisionInput = {
  decision: 'APPROVED' | 'CLARIFICATION_REQUESTED' | 'REJECTED' | 'ON_HOLD'
  planningUserAuthUserId: string
  technicalComments: string
  toolingRequirements: string
  materialRecommendation: string
  constraintsAndRisks: string
  clarificationQuestion: string
}

export type PlanningUser = {
  authUserId: string
  displayName: string
  email: string
}

type ErrorBody = { error?: { code?: string; message?: string; fields?: string[] } }

export class RdRequestError extends Error {
  readonly status: number
  readonly code: string
  readonly fields: string[]

  constructor(status: number, code: string, message: string, fields: string[] = []) {
    super(message)
    this.name = 'RdRequestError'
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
    throw new RdRequestError(
      response.status,
      body.error?.code ?? 'REQUEST_FAILED',
      body.error?.message ?? 'The R&D request failed.',
      body.error?.fields ?? [],
    )
  }
  return body as T
}

async function request<T>(path: string, init?: RequestInit) {
  const response = await fetch(`${apiBase()}${path}`, {
    credentials: 'include',
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  })
  return parse<T>(response)
}

export async function listRdOrders() {
  const result = await request<{ orders: RdOrderSummary[] }>('/api/v1/rd/orders')
  return result.orders
}

export async function listPlanningUsers() {
  const result = await request<{ planners: PlanningUser[] }>('/api/v1/rd/planners')
  return result.planners
}

export async function getRdOrder(orderId: string) {
  const result = await request<{ order: RdOrderDetail }>(`/api/v1/rd/orders/${orderId}`)
  return result.order
}

export async function submitRdDecision(orderId: string, input: RdDecisionInput) {
  const result = await request<{ order: RdOrderDetail }>(`/api/v1/rd/orders/${orderId}/decision`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return result.order
}

export async function downloadRdAttachment(orderId: string, attachmentId: string, fileName: string) {
  const response = await fetch(`${apiBase()}/api/v1/rd/orders/${orderId}/attachments/${attachmentId}`, { credentials: 'include' })
  if (!response.ok) await parse(response)
  const url = URL.createObjectURL(await response.blob())
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}
