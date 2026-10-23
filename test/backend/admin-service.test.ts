import type pg from 'pg'
import { describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '../../backend/src/auth/auth-service.js'
import { AdminError, PostgresAdminService } from '../../backend/src/admin/admin-service.js'

const administrator: AuthUser = {
  id: 'admin-user-1',
  email: 'admin@flowline.com',
  displayName: 'System Administrator',
  status: 'ACTIVE',
  roles: ['SYSTEM_ADMIN'],
}

function createService() {
  const pool = { query: vi.fn() } as unknown as pg.Pool
  return { pool, service: new PostgresAdminService(pool) }
}

describe('Admin order monitor service', () => {
  it('denies order monitoring to non-administrators before querying PostgreSQL', async () => {
    const { pool, service } = createService()

    await expect(service.listOrders({ ...administrator, roles: ['CSR'] })).rejects.toEqual(expect.objectContaining<Partial<AdminError>>({ code: 'FORBIDDEN' }))
    expect(pool.query).not.toHaveBeenCalled()
  })

  it('loads all orders with their latest shipment details for an administrator', async () => {
    const { pool, service } = createService()
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [
        {
          id: 'order-1',
          orderNumber: 'FO-2026-001006',
          customerName: 'UI Acceptance Client',
          productName: 'UI Acceptance Pouch',
          status: 'Delivered',
          stage: 'Delivered',
          priority: 'Normal',
          owner: 'Devendra Rao',
          requestedDeliveryDate: '2026-11-15',
          createdAt: '2026-10-22T10:00:00.000Z',
          updatedAt: '2026-10-23T10:00:00.000Z',
          shipmentStatus: 'DELIVERED',
          carrier: 'Flowline Logistics',
          trackingOrVehicleNumber: 'TRK-UI-1006',
          expectedDeliveryAt: '2026-11-14T12:00:00.000Z',
          actualDeliveryAt: '2026-11-15T12:00:00.000Z',
          receivedBy: 'Client representative',
        },
      ],
    } as never)

    await expect(service.listOrders(administrator)).resolves.toEqual([expect.objectContaining({ orderNumber: 'FO-2026-001006', shipmentStatus: 'DELIVERED' })])
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('LEFT JOIN LATERAL'))
    expect(vi.mocked(pool.query).mock.calls[0]?.[0]).toContain('ORDER BY orders.updated_at DESC')
  })
})