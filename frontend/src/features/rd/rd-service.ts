import { ApiRequestError, requestJson } from '../../shared/api/client'

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

async function request<T>(path: string, init?: RequestInit) {
  try {
    return await requestJson<T>(path, init)
  } catch (error) {
    if (error instanceof ApiRequestError) {
      throw new RdRequestError(error.status, error.code, error.message || 'The R&D request failed.', error.fields)
    }
    throw error
  }
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
  const apiUrl = import.meta.env.VITE_API_BASE_URL?.trim()
  if (!apiUrl) throw new Error('The Flowline API URL is not configured.')
  const response = await fetch(`${apiUrl.replace(/\/$/, '')}/api/v1/rd/orders/${orderId}/attachments/${attachmentId}`, { credentials: 'include' })
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: { code?: string; message?: string; fields?: string[] } }
    throw new RdRequestError(response.status, body.error?.code ?? 'REQUEST_FAILED', body.error?.message ?? 'The R&D request failed.', body.error?.fields ?? [])
  }
  const url = URL.createObjectURL(await response.blob())
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}
