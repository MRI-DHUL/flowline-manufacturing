import { ApiRequestError, requestJson } from '../../shared/api/client'

export type HoldOwner = { authUserId: string; displayName: string; email: string }
export type HoldRecord = {
  id: string
  orderId: string
  orderNumber: string
  category: string
  reason: string
  responsibleTeam: string
  ownerAuthUserId: string
  correctiveAction: string | null
  targetResolutionDate: string
  previousStatus: string
  previousStage: string
  status: 'OPEN' | 'RESOLVED' | 'CANCELLED'
  placedAt: string
  resolvedAt: string | null
}

export class HoldRequestError extends Error {
  readonly fields: string[]
  readonly status: number
  readonly code: string
  constructor(status: number, body: { error?: { code?: string; message?: string; fields?: string[] } }) {
    super(body.error?.message ?? 'The hold action could not be completed.')
    this.name = 'HoldRequestError'
    this.code = body.error?.code ?? 'REQUEST_FAILED'
    this.status = status
    this.fields = body.error?.fields ?? []
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    return await requestJson<T>(path, init)
  } catch (error) {
    if (error instanceof ApiRequestError) {
      throw new HoldRequestError(error.status, { error: { code: error.code, message: error.message, fields: error.fields } })
    }
    throw error
  }
}

export async function listHoldOwners(team: string) {
  return (await request<{ users: HoldOwner[] }>(`/api/v1/hold-owners?team=${encodeURIComponent(team)}`)).users
}
export async function listOrderHolds(orderId: string) {
  return (await request<{ holds: HoldRecord[] }>(`/api/v1/orders/${orderId}/holds`)).holds
}
export async function placeOrderHold(
  orderId: string,
  input: {
    category: string
    reason: string
    responsibleTeam: string
    ownerAuthUserId: string
    correctiveAction: string
    targetResolutionDate: string
  },
) {
  return (await request<{ hold: HoldRecord }>(`/api/v1/orders/${orderId}/holds`, { method: 'POST', body: JSON.stringify(input) })).hold
}
export async function resolveOrderHold(holdId: string, input: { action: 'RESUME' | 'REVIEW' | 'CANCEL'; resolution: string; stage?: string; ownerAuthUserId?: string | null }) {
  return (await request<{ hold: HoldRecord }>(`/api/v1/holds/${holdId}/resolve`, { method: 'POST', body: JSON.stringify(input) })).hold
}
