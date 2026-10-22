export type HoldOwner = { authUserId: string; displayName: string; email: string }
export type HoldRecord = { id: string; orderId: string; orderNumber: string; category: string; reason: string; responsibleTeam: string; ownerAuthUserId: string; correctiveAction: string | null; targetResolutionDate: string; previousStatus: string; previousStage: string; status: 'OPEN' | 'RESOLVED' | 'CANCELLED'; placedAt: string; resolvedAt: string | null }

type ErrorBody = { error?: { code?: string; message?: string; fields?: string[] } }

export class HoldRequestError extends Error {
  readonly fields: string[]
  readonly status: number
  constructor(status: number, body: ErrorBody) { super(body.error?.message ?? 'The hold action could not be completed.'); this.name = 'HoldRequestError'; this.status = status; this.fields = body.error?.fields ?? [] }
}

function apiBase() { const value = import.meta.env.VITE_API_BASE_URL?.trim(); if (!value) throw new Error('The Flowline API URL is not configured.'); return value.replace(/\/$/, '') }
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase()}${path}`, { ...init, credentials: 'include', headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) } })
  const body = await response.json().catch(() => ({})) as T & ErrorBody
  if (!response.ok) throw new HoldRequestError(response.status, body)
  return body
}

export async function listHoldOwners(team: string) { return (await request<{ users: HoldOwner[] }>(`/api/v1/hold-owners?team=${encodeURIComponent(team)}`)).users }
export async function listOrderHolds(orderId: string) { return (await request<{ holds: HoldRecord[] }>(`/api/v1/orders/${orderId}/holds`)).holds }
export async function placeOrderHold(orderId: string, input: { category: string; reason: string; responsibleTeam: string; ownerAuthUserId: string; correctiveAction: string; targetResolutionDate: string }) { return (await request<{ hold: HoldRecord }>(`/api/v1/orders/${orderId}/holds`, { method: 'POST', body: JSON.stringify(input) })).hold }
export async function resolveOrderHold(holdId: string, input: { action: 'RESUME' | 'REVIEW' | 'CANCEL'; resolution: string; stage?: string; ownerAuthUserId?: string | null }) { return (await request<{ hold: HoldRecord }>(`/api/v1/holds/${holdId}/resolve`, { method: 'POST', body: JSON.stringify(input) })).hold }