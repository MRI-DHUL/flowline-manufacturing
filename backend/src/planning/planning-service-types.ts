import type { AuthUser } from '../auth/auth-service.js'

export type PlanningOrderSummary = {
  id: string
  orderNumber: string
  customerName: string | null
  productName: string | null
  status: string
  priority: string | null
  requestedDeliveryDate: string | null
  requestedQuantity: number | null
  updatedAt: Date
}

export type PlanningResource = { id: string; code: string; name: string }
export type PressUser = { authUserId: string; displayName: string; email: string }

export type PlanningAssessment = {
  id: string
  materialStatus: 'PENDING' | 'AVAILABLE' | 'SHORTAGE'
  shortageReason: string | null
  expectedMaterialDate: string | null
  productionLineId: string | null
  plannedProductionDate: string | null
  capacityStatus: 'PENDING' | 'AVAILABLE' | 'UNAVAILABLE'
  readinessStatus: 'PENDING' | 'READY' | 'BLOCKED'
  planningNotes: string | null
  updatedAt: Date
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
  assessment: PlanningAssessment | null
  technicalReviews: Array<{
    decision: string
    technicalComments: string
    toolingRequirements: string | null
    materialRecommendation: string | null
    constraintsAndRisks: string | null
    reviewerName: string
    decidedAt: Date
  }>
  attachments: Array<{ id: string; fileName: string; mediaType: string; sizeBytes: number; createdAt: Date }>
}

export type PlanningAssessmentInput = {
  materialStatus: 'PENDING' | 'AVAILABLE' | 'SHORTAGE'
  shortageReason?: string | null
  expectedMaterialDate?: string | null
  productionLineId?: string | null
  plannedProductionDate?: string | null
  capacityStatus: 'PENDING' | 'AVAILABLE' | 'UNAVAILABLE'
  readinessStatus: 'PENDING' | 'READY' | 'BLOCKED'
  planningNotes?: string | null
}

export interface PlanningService {
  listQueue(user: AuthUser): Promise<PlanningOrderSummary[]>
  listResources(user: AuthUser): Promise<{ productionLines: PlanningResource[]; pressUsers: PressUser[] }>
  getOrder(user: AuthUser, orderId: string): Promise<PlanningOrderDetail>
  saveAssessment(user: AuthUser, orderId: string, input: PlanningAssessmentInput): Promise<PlanningOrderDetail>
  release(user: AuthUser, orderId: string, input: PlanningAssessmentInput): Promise<PlanningOrderDetail>
  downloadAttachment(user: AuthUser, orderId: string, attachmentId: string): Promise<{ fileName: string; mediaType: string; content: Buffer }>
}