import { ApiRequestError, requestJson } from '../../shared/api/client'

export type ReportedOrderIssue = {
  id: string
  orderId: string
  orderNumber: string
  message: string
  status: 'OPEN'
  reportedAt: string
  recipientCount: number
}

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

export async function reportOrderIssue(orderId: string, message: string) {
  try {
    const body = await requestJson<{ issue?: ReportedOrderIssue }>(`/api/v1/orders/${orderId}/issues`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    })
    if (!body.issue) throw new IssueRequestError(200, 'REQUEST_FAILED', 'The issue could not be reported.')
    return body.issue
  } catch (error) {
    if (error instanceof ApiRequestError) {
      throw new IssueRequestError(error.status, error.code, error.message || 'The issue could not be reported.')
    }
    throw error
  }
}
