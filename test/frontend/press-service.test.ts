import { afterEach, describe, expect, it, vi } from 'vitest'
import { completePressOrder, listPressOrders, listShippingUsers } from '../../frontend/src/features/press/press-service'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('Press service', () => {
  it('loads assigned jobs and Shipping users, then completes production', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example')
    const order = { id: '11111111-1111-4111-8111-111111111111', orderNumber: 'FO-2026-001004' }
    const shippingUser = { authUserId: '66666666-6666-4666-8666-666666666666', displayName: 'Shipping User', email: 'shipping@example.com' }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ orders: [order] }), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ users: [shippingUser] }), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ order: { ...order, status: 'Ready to Ship' } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
    vi.stubGlobal('fetch', fetchMock)

    await expect(listPressOrders()).resolves.toEqual([order])
    await expect(listShippingUsers()).resolves.toEqual([shippingUser])
    const completion = { goodQuantity: 950, wasteQuantity: 50, notes: 'Complete', shippingUserAuthUserId: shippingUser.authUserId }
    await completePressOrder(order.id, completion)

    expect(fetchMock).toHaveBeenLastCalledWith(`https://api.example/api/v1/press/orders/${order.id}/complete`, expect.objectContaining({ method: 'POST', body: JSON.stringify(completion) }))
  })
})
