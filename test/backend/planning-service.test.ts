import type pg from 'pg'
import { describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '../../backend/src/auth-service.js'
import { PlanningError, PostgresPlanningService } from '../../backend/src/planning-service.js'

const planner: AuthUser = {
  id: 'planner-1',
  email: 'planner@example.com',
  displayName: 'Planner',
  status: 'ACTIVE',
  roles: ['PLANNING'],
}

function createService() {
  const pool = {
    connect: vi.fn(),
    query: vi.fn(),
  } as unknown as pg.Pool
  return { pool, service: new PostgresPlanningService(pool) }
}

describe('Planning service gates', () => {
  it('rejects incomplete shortage details before persistence', async () => {
    const { pool, service } = createService()

    await expect(service.saveAssessment(planner, 'order-1', {
      materialStatus: 'SHORTAGE',
      shortageReason: '',
      expectedMaterialDate: null,
      capacityStatus: 'PENDING',
      readinessStatus: 'BLOCKED',
    })).rejects.toEqual(expect.objectContaining<Partial<PlanningError>>({
      code: 'ASSESSMENT_INCOMPLETE',
      fields: ['shortageReason', 'expectedMaterialDate'],
    }))
    expect(pool.connect).not.toHaveBeenCalled()
  })

  it('blocks release until all Planning and Press handoff checks pass', async () => {
    const { pool, service } = createService()

    await expect(service.release(planner, 'order-1', {
      materialStatus: 'SHORTAGE',
      shortageReason: 'Film unavailable',
      expectedMaterialDate: '2026-11-01',
      productionLineId: null,
      plannedProductionDate: null,
      capacityStatus: 'UNAVAILABLE',
      readinessStatus: 'BLOCKED',
      pressUserAuthUserId: null,
    })).rejects.toEqual(expect.objectContaining<Partial<PlanningError>>({
      code: 'RELEASE_BLOCKED',
      fields: expect.arrayContaining([
        'materialStatus',
        'productionLineId',
        'plannedProductionDate',
        'capacityStatus',
        'readinessStatus',
        'pressUserAuthUserId',
      ]),
    }))
    expect(pool.connect).not.toHaveBeenCalled()
  })

  it('denies non-Planning users before querying assigned work', async () => {
    const { pool, service } = createService()

    await expect(service.listQueue({ ...planner, roles: ['CSR'] })).rejects.toEqual(
      expect.objectContaining<Partial<PlanningError>>({ code: 'FORBIDDEN', statusCode: 403 }),
    )
    expect(pool.query).not.toHaveBeenCalled()
  })
})
