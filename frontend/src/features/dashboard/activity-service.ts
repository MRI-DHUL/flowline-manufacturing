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
type ErrorBody = { error?: { message?: string } }
function apiBase() {
  const value = import.meta.env.VITE_API_BASE_URL?.trim()
  if (!value) throw new Error('The Flowline API URL is not configured.')
  return value.replace(/\/$/, '')
}
export async function listOrderActivity(orderId: string) {
  const response = await fetch(`${apiBase()}/api/v1/orders/${orderId}/activity`, { credentials: 'include' })
  const body = (await response.json().catch(() => ({}))) as {
    activity?: OrderActivity[]
  } & ErrorBody
  if (!response.ok || !body.activity) throw new Error(body.error?.message ?? 'Order activity could not be loaded.')
  return body.activity
}
