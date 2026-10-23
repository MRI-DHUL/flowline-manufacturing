import { afterEach, describe, expect, it, vi } from 'vitest'
import { dispatchShippingOrder, listShippingOrders } from '../../frontend/src/features/shipping/shipping-service'
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})
describe('Shipping service', () => {
  it('loads assigned shipments and sends dispatch details', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example')
    const order = { id: '11111111-1111-4111-8111-111111111111' }
    const payload = {
      carrier: 'Carrier',
      trackingOrVehicleNumber: 'TRK-1',
      dispatchAt: '2026-10-22T12:00:00.000Z',
      shippedQuantity: 950,
      destination: 'Chennai',
      expectedDeliveryAt: '2026-10-23T12:00:00.000Z',
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ orders: [order] }), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ order: { ...order, status: 'Dispatched' } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
    vi.stubGlobal('fetch', fetchMock)
    await expect(listShippingOrders()).resolves.toEqual([order])
    await dispatchShippingOrder(order.id, payload)
    expect(fetchMock).toHaveBeenLastCalledWith(`https://api.example/api/v1/shipping/orders/${order.id}/dispatch`, expect.objectContaining({ method: 'POST', body: JSON.stringify(payload) }))
  })
})
