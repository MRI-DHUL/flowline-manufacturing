import { ApiRequestError, requestJson } from '../../shared/api/client'

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

export class PlanningRequestError extends Error {
  readonly status: number
  readonly code: string
  readonly fields: string[]

  constructor(status: number, code: string, message: string, fields: string[] = []) {
    super(message)
    this.name = 'PlanningRequestError'
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
      throw new PlanningRequestError(error.status, error.code, error.message || 'The Planning request failed.', error.fields)
    }
    throw error
  }
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
  return (
    await request<{ order: PlanningOrderDetail }>(`/api/v1/planning/orders/${orderId}/assessment`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    })
  ).order
}

export async function releasePlanningOrder(orderId: string, input: PlanningAssessmentInput) {
  return (
    await request<{ order: PlanningOrderDetail }>(`/api/v1/planning/orders/${orderId}/release`, {
      method: 'POST',
      body: JSON.stringify(input),
    })
  ).order
}

export async function downloadPlanningAttachment(orderId: string, attachmentId: string, fileName: string) {
  const apiUrl = import.meta.env.VITE_API_BASE_URL?.trim()
  if (!apiUrl) throw new Error('The Flowline API URL is not configured.')
  const response = await fetch(`${apiUrl.replace(/\/$/, '')}/api/v1/planning/orders/${orderId}/attachments/${attachmentId}`, { credentials: 'include' })
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: { code?: string; message?: string; fields?: string[] } }
    throw new PlanningRequestError(response.status, body.error?.code ?? 'REQUEST_FAILED', body.error?.message ?? 'The Planning request failed.', body.error?.fields ?? [])
  }
  const url = URL.createObjectURL(await response.blob())
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}
