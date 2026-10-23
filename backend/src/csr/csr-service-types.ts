import type { AuthUser } from '../auth/auth-service.js'

export type OrderPatch = {
  customerName?: string | null; destination?: string | null; productName?: string | null; productDescription?: string | null
  orderType?: string | null; packagingType?: string | null; dimensions?: string | null; material?: string | null
  printColors?: string | null; requestedQuantity?: number | null; requestedDeliveryDate?: string | null
  technicalNotes?: string | null; priority?: string | null
}

export type CsrReviewer = { authUserId: string; displayName: string; email: string }
export type CsrAttachment = { fileName: string; mediaType: string; content: Buffer }
export type CsrOrderSummary = {
  id: string; orderNumber: string; customerName: string | null; productName: string | null; status: string; stage: string
  assignedReviewer: CsrReviewer | null; priority: string | null; requestedDeliveryDate: string | null; createdAt: Date; updatedAt: Date; openClarifications: number
}
export type CsrOrderDetail = CsrOrderSummary & {
  destination: string | null; productDescription: string | null; orderType: string | null; packagingType: string | null
  dimensions: string | null; material: string | null; printColors: string | null; requestedQuantity: number | null; technicalNotes: string | null
  assignedReviewer: CsrReviewer | null
  attachments: Array<{ id: string; fileName: string; mediaType: string; sizeBytes: number; createdAt: Date }>
  clarifications: Array<{ id: string; stage: string; question: string; status: string; requestedAt: Date; response: string | null; respondedAt: Date | null }>
  activity: Array<{ id: string; action: string; previousStatus: string | null; newStatus: string | null; reason: string | null; details: Record<string, unknown>; occurredAt: Date }>
}
export type CsrOrderStatusRow = {
  eventId: string; orderId: string; orderNumber: string; orderName: string | null; orderPlacedAt: Date; currentStatus: string; status: string
  completedBy: string; completedAt: Date; transitionDurationSeconds: number | null; statusDurationSeconds: number; current: boolean; comments: string | null; action: string
}
export interface CsrService {
  listOrders(user: AuthUser, filters: { search?: string; status?: string }): Promise<CsrOrderSummary[]>
  listOrderStatuses(user: AuthUser): Promise<CsrOrderStatusRow[]>
  getOrder(user: AuthUser, orderId: string): Promise<CsrOrderDetail>
  createDraft(user: AuthUser, patch: OrderPatch): Promise<CsrOrderDetail>
  updateDraft(user: AuthUser, orderId: string, patch: OrderPatch): Promise<CsrOrderDetail>
  submitOrder(user: AuthUser, orderId: string): Promise<CsrOrderDetail>
  uploadAttachment(user: AuthUser, orderId: string, attachment: CsrAttachment): Promise<CsrOrderDetail>
  downloadAttachment(user: AuthUser, orderId: string, attachmentId: string): Promise<CsrAttachment>
  deleteAttachment(user: AuthUser, orderId: string, attachmentId: string): Promise<CsrOrderDetail>
  respondToClarification(user: AuthUser, orderId: string, clarificationId: string, response: string): Promise<CsrOrderDetail>
  listRdReviewers(user: AuthUser): Promise<CsrReviewer[]>
  assignRdReviewer(user: AuthUser, orderId: string, reviewerAuthUserId: string): Promise<CsrOrderDetail>
}
export class CsrError extends Error {
  constructor(public readonly statusCode: number, public readonly code: string, message: string, public readonly fields?: string[]) {
    super(message)
    this.name = 'CsrError'
  }
}