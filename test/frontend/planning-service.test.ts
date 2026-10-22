import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  listPlanningOrders,
  listPlanningResources,
  releasePlanningOrder,
} from '../../frontend/src/features/planning/planning-service'

const assessment = {
  materialStatus: 'AVAILABLE' as const,
  shortageReason: '',
  expectedMaterialDate: '',
  productionLineId: '22222222-2222-4222-8222-222222222222',
  plannedProductionDate: '2026-10-28',
  capacityStatus: 'AVAILABLE' as const,
  readinessStatus: 'READY' as const,
  planningNotes: 'Ready for production.',
  pressUserAuthUserId: '33333333-3333-4333-8333-333333333333',
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('Planning service', () => {
  it('loads assigned work and resources, then releases to Press', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example')
    const order = { id: '11111111-1111-4111-8111-111111111111', orderNumber: 'FO-2026-001004' }
    const resources = { productionLines: [], pressUsers: [] }
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ orders: [order] }), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify(resources), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ order: { ...order, status: 'Scheduled' } }), { status: 200, headers: { 'content-type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(listPlanningOrders()).resolves.toEqual([order])
    await expect(listPlanningResources()).resolves.toEqual(resources)
    await releasePlanningOrder(order.id, assessment)

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://api.example/api/v1/planning/orders', expect.objectContaining({ credentials: 'include' }))
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://api.example/api/v1/planning/resources', expect.objectContaining({ credentials: 'include' }))
    expect(fetchMock).toHaveBeenLastCalledWith(
      `https://api.example/api/v1/planning/orders/${order.id}/release`,
      expect.objectContaining({ method: 'POST', body: JSON.stringify(assessment) }),
    )
  })
})
