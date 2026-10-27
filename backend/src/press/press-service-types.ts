import type { AuthUser } from '../auth/auth-service.js'

export type PressOrderSummary = {
  id: string
  orderNumber: string
  customerName: string | null
  productName: string | null
  status: string
  priority: string | null
  requestedDeliveryDate: string | null
  plannedQuantity: number
  runStatus: string
  productionLineName: string | null
  updatedAt: Date
}

export type ShippingUser = { authUserId: string; displayName: string; email: string }

export type PressOrderDetail = PressOrderSummary & {
  destination: string | null
  packagingType: string | null
  dimensions: string | null
  material: string | null
  printColors: string | null
  technicalNotes: string | null
  runId: string
  goodQuantity: number | null
  wasteQuantity: number | null
  startedAt: Date | null
  completedAt: Date | null
  notes: string | null
  issues: Array<{
    id: string
    category: string
    notes: string
    correctiveAction: string | null
    reportedAt: Date
    resolvedAt: Date | null
  }>
}

export type PressCompletionInput = {
  goodQuantity: number
  wasteQuantity?: number
  notes?: string | null
}

export interface PressService {
  listQueue(user: AuthUser): Promise<PressOrderSummary[]>
  listShippingUsers(user: AuthUser): Promise<ShippingUser[]>
  getOrder(user: AuthUser, orderId: string): Promise<PressOrderDetail>
  accept(user: AuthUser, orderId: string): Promise<PressOrderDetail>
  start(user: AuthUser, orderId: string): Promise<PressOrderDetail>
  pause(user: AuthUser, orderId: string, reason: string): Promise<PressOrderDetail>
  reportProductionIssue(user: AuthUser, orderId: string, input: { category: string; notes: string; correctiveAction?: string | null }): Promise<PressOrderDetail>
  resolveProductionIssue(user: AuthUser, orderId: string, input: { action: 'RESUME' | 'REVIEW'; resolution: string }): Promise<PressOrderDetail>
  complete(user: AuthUser, orderId: string, input: PressCompletionInput): Promise<PressOrderDetail>
}