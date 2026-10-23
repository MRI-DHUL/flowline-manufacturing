import { requestJson } from '../../shared/api/client'

export type OrderActivity = {
  id: string
  action: string
  previousStatus: string | null
  newStatus: string | null
  reason: string | null
  details: Record<string, unknown>
  actorName: string
  occurredAt: string
}

export async function listOrderActivity(orderId: string) {
  return (await requestJson<{ activity: OrderActivity[] }>(`/api/v1/orders/${orderId}/activity`)).activity
}
