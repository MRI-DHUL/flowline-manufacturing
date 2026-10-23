import type pg from 'pg'
import { describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '../../backend/src/auth/auth-service.js'
import { PostgresShippingService, ShippingError } from '../../backend/src/shipping/shipping-service.js'

const user: AuthUser = {
  id: 'shipping-1',
  email: 'shipping@example.com',
  displayName: 'Shipping User',
  status: 'ACTIVE',
  roles: ['SHIPPING'],
}
function createService() {
  const pool = { connect: vi.fn(), query: vi.fn() } as unknown as pg.Pool
  return { pool, service: new PostgresShippingService(pool) }
}
describe('Shipping service gates', () => {
  it('rejects incomplete dispatch before database access', async () => {
    const { pool, service } = createService()
    await expect(
      service.dispatch(user, 'order-1', {
        carrier: '',
        trackingOrVehicleNumber: '',
        dispatchAt: '',
        shippedQuantity: 0,
        destination: '',
        expectedDeliveryAt: '',
      }),
    ).rejects.toEqual(expect.objectContaining<Partial<ShippingError>>({ code: 'DISPATCH_INCOMPLETE' }))
    expect(pool.connect).not.toHaveBeenCalled()
  })
  it('requires delivery time and recipient before database access', async () => {
    const { pool, service } = createService()
    await expect(service.confirmDelivery(user, 'order-1', { actualDeliveryAt: '', receivedBy: '' })).rejects.toEqual(expect.objectContaining<Partial<ShippingError>>({ code: 'DELIVERY_INCOMPLETE' }))
    expect(pool.connect).not.toHaveBeenCalled()
  })
  it('denies non-Shipping users', async () => {
    const { pool, service } = createService()
    await expect(service.listQueue({ ...user, roles: ['PRESS'] })).rejects.toEqual(expect.objectContaining<Partial<ShippingError>>({ code: 'FORBIDDEN' }))
    expect(pool.query).not.toHaveBeenCalled()
  })
})
