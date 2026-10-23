import { describe, expect, it, vi } from 'vitest'
import { apps, createAppOptions, createAuthService, createCsrService, createDashboardService, createIssueService, createNotificationService, createPlanningService, createPressService, createRdService, createShippingService, testOrder } from './app-test-fixtures.js'
import { buildApp } from '../../backend/src/app.js'

describe('R&D routes', () => {
  it('lists the authenticated R&D reviewer queue', async () => {
    const authService = createAuthService()
    authService.getSession = vi.fn(async () => ({
      id: 'rd-user-1',
      email: 'rd@example.com',
      displayName: 'R&D Reviewer',
      status: 'ACTIVE' as const,
      roles: ['R&D'],
    }))
    const rdService = createRdService()
    rdService.listQueue = vi.fn(async () => [])
    const app = buildApp({ ...createAppOptions(authService), rdService })
    apps.push(app)

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/rd/orders',
      cookies: { flowline_session: 'opaque-token' },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ orders: [] })
    expect(rdService.listQueue).toHaveBeenCalledWith(expect.objectContaining({ id: 'rd-user-1', roles: ['R&D'] }))
  })

  it('rejects incomplete technical decisions at the route boundary', async () => {
    const authService = createAuthService()
    authService.getSession = vi.fn(async () => ({
      id: 'rd-user-1',
      email: 'rd@example.com',
      displayName: 'R&D Reviewer',
      status: 'ACTIVE' as const,
      roles: ['R&D'],
    }))
    const rdService = createRdService()
    const app = buildApp({ ...createAppOptions(authService), rdService })
    apps.push(app)

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/rd/orders/${testOrder.id}/decision`,
      cookies: { flowline_session: 'opaque-token' },
      payload: { decision: 'APPROVED' },
    })

    expect(response.statusCode).toBe(400)
    expect(rdService.decide).not.toHaveBeenCalled()
  })

  it('accepts clarification decisions without a Planning assignment', async () => {
    const authService = createAuthService()
    authService.getSession = vi.fn(async () => ({
      id: 'rd-user-1',
      email: 'rd@example.com',
      displayName: 'R&D Reviewer',
      status: 'ACTIVE' as const,
      roles: ['R&D'],
    }))
    const rdService = createRdService()
    rdService.decide = vi.fn(async () => null as never)
    const app = buildApp({ ...createAppOptions(authService), rdService })
    apps.push(app)

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/rd/orders/${testOrder.id}/decision`,
      cookies: { flowline_session: 'opaque-token' },
      payload: {
        decision: 'CLARIFICATION_REQUESTED',
        planningUserAuthUserId: '',
        technicalComments: 'Need more details.',
        clarificationQuestion: 'Please confirm the material specification.',
      },
    })

    expect(response.statusCode).toBe(200)
    expect(rdService.decide).toHaveBeenCalledWith(expect.objectContaining({ id: 'rd-user-1' }), testOrder.id, expect.objectContaining({ planningUserAuthUserId: null }))
  })
})

describe('Planning routes', () => {
  it('lists the authenticated planner queue', async () => {
    const authService = createAuthService()
    authService.getSession = vi.fn(async () => ({
      id: 'planner-1',
      email: 'planner@example.com',
      displayName: 'Planner',
      status: 'ACTIVE' as const,
      roles: ['PLANNING'],
    }))
    const planningService = createPlanningService()
    const app = buildApp({ ...createAppOptions(authService), planningService })
    apps.push(app)

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/planning/orders',
      cookies: { flowline_session: 'opaque-token' },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ orders: [] })
    expect(planningService.listQueue).toHaveBeenCalledWith(expect.objectContaining({ id: 'planner-1', roles: ['PLANNING'] }))
  })

  it('forwards complete release checks and Press assignment', async () => {
    const authService = createAuthService()
    authService.getSession = vi.fn(async () => ({
      id: 'planner-1',
      email: 'planner@example.com',
      displayName: 'Planner',
      status: 'ACTIVE' as const,
      roles: ['PLANNING'],
    }))
    const planningService = createPlanningService()
    planningService.release = vi.fn(async () => null as never)
    const app = buildApp({ ...createAppOptions(authService), planningService })
    apps.push(app)
    const productionLineId = '22222222-2222-4222-8222-222222222222'
    const pressUserId = '33333333-3333-4333-8333-333333333333'

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/planning/orders/${testOrder.id}/release`,
      cookies: { flowline_session: 'opaque-token' },
      payload: {
        materialStatus: 'AVAILABLE',
        productionLineId,
        plannedProductionDate: '2026-10-28',
        capacityStatus: 'AVAILABLE',
        readinessStatus: 'READY',
        planningNotes: 'Ready for production.',
        pressUserAuthUserId: pressUserId,
      },
    })

    expect(response.statusCode).toBe(200)
    expect(planningService.release).toHaveBeenCalledWith(expect.objectContaining({ id: 'planner-1' }), testOrder.id, expect.objectContaining({ productionLineId, pressUserAuthUserId: pressUserId }))
  })
})

describe('Issue escalation routes', () => {
  it('reports an order issue for an authenticated operational user', async () => {
    const authService = createAuthService()
    authService.getSession = vi.fn(async () => ({
      id: 'press-user-1',
      email: 'press@example.com',
      displayName: 'Press Operator',
      status: 'ACTIVE' as const,
      roles: ['PRESS'],
    }))
    const issueService = createIssueService()
    const app = buildApp({ ...createAppOptions(authService), issueService })
    apps.push(app)

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/orders/${testOrder.id}/issues`,
      cookies: { flowline_session: 'opaque-token' },
      payload: { message: 'The approved material is not available at the press.' },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().issue).toEqual(expect.objectContaining({ recipientCount: 2, status: 'OPEN' }))
    expect(issueService.report).toHaveBeenCalledWith(expect.objectContaining({ id: 'press-user-1', roles: ['PRESS'] }), testOrder.id, 'The approved material is not available at the press.')
  })

  it('rejects an issue message that is too short', async () => {
    const authService = createAuthService()
    authService.getSession = vi.fn(async () => ({
      id: 'planner-1',
      email: 'planner@example.com',
      displayName: 'Planner',
      status: 'ACTIVE' as const,
      roles: ['PLANNING'],
    }))
    const issueService = createIssueService()
    const app = buildApp({ ...createAppOptions(authService), issueService })
    apps.push(app)

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/orders/${testOrder.id}/issues`,
      cookies: { flowline_session: 'opaque-token' },
      payload: { message: 'Short' },
    })

    expect(response.statusCode).toBe(400)
    expect(issueService.report).not.toHaveBeenCalled()
  })
})

describe('Press routes', () => {
  it('lists the authenticated Press user queue', async () => {
    const authService = createAuthService()
    authService.getSession = vi.fn(async () => ({
      id: 'press-user-1',
      email: 'press@example.com',
      displayName: 'Press Operator',
      status: 'ACTIVE' as const,
      roles: ['PRESS'],
    }))
    const pressService = createPressService()
    const app = buildApp({ ...createAppOptions(authService), pressService })
    apps.push(app)

    const response = await app.inject({ method: 'GET', url: '/api/v1/press/orders', cookies: { flowline_session: 'opaque-token' } })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ orders: [] })
    expect(pressService.listQueue).toHaveBeenCalledWith(expect.objectContaining({ id: 'press-user-1', roles: ['PRESS'] }))
  })

  it('forwards completed quantities and the selected Shipping user', async () => {
    const authService = createAuthService()
    authService.getSession = vi.fn(async () => ({
      id: 'press-user-1',
      email: 'press@example.com',
      displayName: 'Press Operator',
      status: 'ACTIVE' as const,
      roles: ['PRESS'],
    }))
    const pressService = createPressService()
    pressService.complete = vi.fn(async () => null as never)
    const app = buildApp({ ...createAppOptions(authService), pressService })
    apps.push(app)
    const shippingUserAuthUserId = '66666666-6666-4666-8666-666666666666'

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/press/orders/${testOrder.id}/complete`,
      cookies: { flowline_session: 'opaque-token' },
      payload: { goodQuantity: 950, wasteQuantity: 50, notes: 'Production completed.', shippingUserAuthUserId },
    })

    expect(response.statusCode).toBe(200)
    expect(pressService.complete).toHaveBeenCalledWith(expect.objectContaining({ id: 'press-user-1' }), testOrder.id, expect.objectContaining({ goodQuantity: 950, wasteQuantity: 50, shippingUserAuthUserId }))
  })
})

describe('Shipping routes', () => {
  it('lists the authenticated Shipping user queue', async () => {
    const authService = createAuthService()
    authService.getSession = vi.fn(async () => ({
      id: 'shipping-1',
      email: 'shipping@example.com',
      displayName: 'Shipping User',
      status: 'ACTIVE' as const,
      roles: ['SHIPPING'],
    }))
    const shippingService = createShippingService()
    const app = buildApp({ ...createAppOptions(authService), shippingService })
    apps.push(app)
    const response = await app.inject({ method: 'GET', url: '/api/v1/shipping/orders', cookies: { flowline_session: 'opaque-token' } })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ orders: [] })
    expect(shippingService.listQueue).toHaveBeenCalledWith(expect.objectContaining({ id: 'shipping-1' }))
  })

  it('forwards complete dispatch details', async () => {
    const authService = createAuthService()
    authService.getSession = vi.fn(async () => ({
      id: 'shipping-1',
      email: 'shipping@example.com',
      displayName: 'Shipping User',
      status: 'ACTIVE' as const,
      roles: ['SHIPPING'],
    }))
    const shippingService = createShippingService()
    shippingService.dispatch = vi.fn(async () => null as never)
    const app = buildApp({ ...createAppOptions(authService), shippingService })
    apps.push(app)
    const payload = {
      carrier: 'Flowline Logistics',
      trackingOrVehicleNumber: 'TN-01-AB-1234',
      dispatchAt: '2026-10-22T12:00:00.000Z',
      shippedQuantity: 950,
      destination: 'Chennai',
      expectedDeliveryAt: '2026-10-23T12:00:00.000Z',
    }
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/shipping/orders/${testOrder.id}/dispatch`,
      cookies: { flowline_session: 'opaque-token' },
      payload,
    })
    expect(response.statusCode).toBe(200)
    expect(shippingService.dispatch).toHaveBeenCalledWith(expect.objectContaining({ id: 'shipping-1' }), testOrder.id, payload)
  })
})
