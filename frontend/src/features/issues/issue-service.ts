export type ReportedOrderIssue = {
  id: string
  orderId: string
  orderNumber: string
  message: string
  status: 'OPEN'
  reportedAt: string
  recipientCount: number
}

type ErrorBody = { error?: { code?: string; message?: string } }

export class IssueRequestError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'IssueRequestError'
    this.status = status
    this.code = code
  }
}

function apiBase() {
  const value = import.meta.env.VITE_API_BASE_URL?.trim()
  if (!value) throw new Error('The Flowline API URL is not configured.')
  return value.replace(/\/$/, '')
}

export async function reportOrderIssue(orderId: string, message: string) {
  const response = await fetch(`${apiBase()}/api/v1/orders/${orderId}/issues`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message }),
  })
  const body = (await response.json().catch(() => ({}))) as ErrorBody & { issue?: ReportedOrderIssue }
  if (!response.ok || !body.issue) {
    throw new IssueRequestError(
      response.status,
      body.error?.code ?? 'REQUEST_FAILED',
      body.error?.message ?? 'The issue could not be reported.',
    )
  }
  return body.issue
}
