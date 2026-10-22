export type PlanningOrderSummary = {
  id: string
  orderNumber: string
  customerName: string | null
  productName: string | null
  status: string
  priority: string | null
  requestedDeliveryDate: string | null
  requestedQuantity: number | null
  updatedAt: string
}

export type PlanningAssessmentInput = {
  materialStatus: 'PENDING' | 'AVAILABLE' | 'SHORTAGE'
  shortageReason: string
  expectedMaterialDate: string
  productionLineId: string
  plannedProductionDate: string
  capacityStatus: 'PENDING' | 'AVAILABLE' | 'UNAVAILABLE'
  readinessStatus: 'PENDING' | 'READY' | 'BLOCKED'
  planningNotes: string
  pressUserAuthUserId: string
}

export type PlanningOrderDetail = PlanningOrderSummary & {
  destination: string | null
  productDescription: string | null
  orderType: string | null
  packagingType: string | null
  dimensions: string | null
  material: string | null
  printColors: string | null
  technicalNotes: string | null
  assessment: (PlanningAssessmentInput & { id: string; updatedAt: string }) | null
  technicalReviews: Array<{
    decision: string
    technicalComments: string
    toolingRequirements: string | null
    materialRecommendation: string | null
    constraintsAndRisks: string | null
    reviewerName: string
    decidedAt: string
  }>
  attachments: Array<{
    id: string
    fileName: string
    mediaType: string
    sizeBytes: number
    createdAt: string
  }>
}

export type PlanningResources = {
  productionLines: Array<{ id: string; code: string; name: string }>
  pressUsers: Array<{ authUserId: string; displayName: string; email: string }>
}

type ErrorBody = { error?: { code?: string; message?: string; fields?: string[] } }

export class PlanningRequestError extends Error {
  readonly status: number
  readonly code: string
  readonly fields: string[]

  constructor(
    status: number,
    code: string,
    message: string,
    fields: string[] = [],
  ) {
    super(message)
    this.name = 'PlanningRequestError'
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
    throw new PlanningRequestError(response.status, body.error?.code ?? 'REQUEST_FAILED', body.error?.message ?? 'The Planning request failed.', body.error?.fields ?? [])
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

export async function listPlanningOrders() {
  return (await request<{ orders: PlanningOrderSummary[] }>('/api/v1/planning/orders')).orders
}

export async function listPlanningResources() {
  return request<PlanningResources>('/api/v1/planning/resources')
}

export async function getPlanningOrder(orderId: string) {
  return (await request<{ order: PlanningOrderDetail }>(`/api/v1/planning/orders/${orderId}`)).order
}

export async function savePlanningAssessment(orderId: string, input: PlanningAssessmentInput) {
  return (await request<{ order: PlanningOrderDetail }>(`/api/v1/planning/orders/${orderId}/assessment`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })).order
}

export async function releasePlanningOrder(orderId: string, input: PlanningAssessmentInput) {
  return (await request<{ order: PlanningOrderDetail }>(`/api/v1/planning/orders/${orderId}/release`, {
    method: 'POST',
    body: JSON.stringify(input),
  })).order
}

export async function downloadPlanningAttachment(orderId: string, attachmentId: string, fileName: string) {
  const response = await fetch(`${apiBase()}/api/v1/planning/orders/${orderId}/attachments/${attachmentId}`, { credentials: 'include' })
  if (!response.ok) await parse(response)
  const url = URL.createObjectURL(await response.blob())
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}
