import { afterEach, describe, expect, it, vi } from 'vitest'
import { assignCsrRdReviewer, createCsrDraft, listRdReviewers, CsrRequestError, listCsrOrders, submitCsrOrder, uploadCsrAttachment } from '../../frontend/src/features/csr/csr-order-service'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

const order = {
  id: '11111111-1111-4111-8111-111111111111',
  orderNumber: 'FO-2026-001001',
  status: 'Draft',
}

describe('CSR order service', () => {
  it('sends search and status filters to the owned-order endpoint', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example')
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ orders: [order] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(listCsrOrders({ search: 'pouch', status: 'Draft' })).resolves.toEqual([order])
    expect(fetchMock).toHaveBeenCalledWith('https://api.example/api/v1/orders?search=pouch&status=Draft', expect.objectContaining({ credentials: 'include' }))
  })

  it('creates an incomplete draft through JSON', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example')
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ order }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(createCsrDraft({ customerName: null })).resolves.toEqual(order)
    expect(fetchMock).toHaveBeenCalledWith('https://api.example/api/v1/orders', expect.objectContaining({ method: 'POST', body: JSON.stringify({ customerName: null }) }))
  })

  it('preserves submission field errors', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: 'SUBMISSION_INCOMPLETE',
              message: 'Complete all required fields.',
              fields: ['productName'],
            },
          }),
          { status: 422, headers: { 'content-type': 'application/json' } },
        ),
      ),
    )

    await expect(submitCsrOrder(order.id)).rejects.toEqual(
      expect.objectContaining<Partial<CsrRequestError>>({
        status: 422,
        code: 'SUBMISSION_INCOMPLETE',
        fields: ['productName'],
      }),
    )
  })

  it('uploads attachments as multipart form data', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example')
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ order }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const file = new File(['content'], 'artwork.txt', { type: 'text/plain' })

    await uploadCsrAttachment(order.id, file)

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit
    expect(init.body).toBeInstanceOf(FormData)
    expect(init.headers).toBeUndefined()
  })

  it('lists and assigns an active R&D reviewer', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example')
    const reviewer = {
      authUserId: '22222222-2222-4222-8222-222222222222',
      displayName: 'Dr. Ravi Shah',
      email: 'ravi@example.com',
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ reviewers: [reviewer] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ order: { ...order, assignedReviewer: reviewer } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
    vi.stubGlobal('fetch', fetchMock)

    await expect(listRdReviewers()).resolves.toEqual([reviewer])
    await assignCsrRdReviewer(order.id, reviewer.authUserId)

    expect(fetchMock).toHaveBeenLastCalledWith(
      `https://api.example/api/v1/orders/${order.id}/assign-rd`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ reviewerAuthUserId: reviewer.authUserId }),
      }),
    )
  })
})
