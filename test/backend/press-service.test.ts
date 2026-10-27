import type pg from 'pg'
import { describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '../../backend/src/auth/auth-service.js'
import { PostgresPressService, PressError } from '../../backend/src/press/press-service.js'

const pressUser: AuthUser = {
  id: 'press-user-1',
  email: 'press@example.com',
  displayName: 'Press Operator',
  status: 'ACTIVE',
  roles: ['PRESS'],
}

function createService() {
  const pool = { connect: vi.fn(), query: vi.fn() } as unknown as pg.Pool
  return { pool, service: new PostgresPressService(pool) }
}

describe('Press service gates', () => {
  it('requires production quantities and a Shipping assignee before completion', async () => {
    const { pool, service } = createService()

    await expect(
      service.complete(pressUser, 'order-1', {
        goodQuantity: 0,
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<PressError>>({
        code: 'COMPLETION_INCOMPLETE',
        fields: ['goodQuantity'],
      }),
    )
    expect(pool.connect).not.toHaveBeenCalled()
  })

  it('requires a meaningful pause reason before database access', async () => {
    const { pool, service } = createService()

    await expect(service.pause(pressUser, 'order-1', 'No')).rejects.toEqual(expect.objectContaining<Partial<PressError>>({ code: 'PAUSE_REASON_REQUIRED' }))
    expect(pool.connect).not.toHaveBeenCalled()
  })

  it('denies non-Press users before querying the queue', async () => {
    const { pool, service } = createService()

    await expect(service.listQueue({ ...pressUser, roles: ['SHIPPING'] })).rejects.toEqual(expect.objectContaining<Partial<PressError>>({ code: 'FORBIDDEN', statusCode: 403 }))
    expect(pool.query).not.toHaveBeenCalled()
  })
})
