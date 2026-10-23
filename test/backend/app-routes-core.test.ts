import { describe, expect, it, vi } from 'vitest'
import { apps, createAppOptions, createAuthService, createCsrService, createDashboardService, createIssueService, createNotificationService, createPlanningService, createPressService, createRdService, createShippingService, testOrder } from './app-test-fixtures.js'
import { buildApp } from '../../backend/src/app.js'
import { AuthError } from '../../backend/src/auth/auth-service.js'
import { DashboardAccessError } from '../../backend/src/dashboard/dashboard-service.js'
import { CsrError } from '../../backend/src/csr/csr-service.js'
describe('health routes', () => {
  it('reports API process health', async () => {
    const app = buildApp({
      ...createAppOptions(),
      databaseCheck: async () => ({
        database: 'neondb',
        serverTime: new Date(),
        schemaReady: true,
        latestMigration: '001_flowline_foundation.sql',
      }),
    })
    apps.push(app)

    const response = await app.inject({ method: 'GET', url: '/health' })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      status: 'ok',
      service: 'flowline-backend',
    })
  })

  it('reports database readiness', async () => {
    const app = buildApp({
      ...createAppOptions(),
      databaseCheck: async () => ({
        database: 'neondb',
        serverTime: new Date('2026-10-20T00:00:00.000Z'),
        schemaReady: true,
        latestMigration: '001_flowline_foundation.sql',
      }),
    })
    apps.push(app)
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/health/database',
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      status: 'ok',
      database: {
        database: 'neondb',
        schemaReady: true,
        latestMigration: '001_flowline_foundation.sql',
      },
    })
  })

  it('does not expose connection failures', async () => {
    const app = buildApp({
      ...createAppOptions(),
      databaseCheck: async () => {
        throw new Error('SENSITIVE_DATABASE_DETAIL')
      },
    })
    apps.push(app)
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/health/database',
    })

    expect(response.statusCode).toBe(503)
    expect(response.body).not.toContain('SENSITIVE_DATABASE_DETAIL')
  })
})

describe('authentication routes', () => {
  it('registers an account without accepting role assignment', async () => {
    const authService = createAuthService()
    const app = buildApp(createAppOptions(authService))
    apps.push(app)

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        fullName: 'Asha Menon',
        email: 'asha@flowline.com',
        password: 'secure-pass',
        role: 'SYSTEM_ADMIN',
      },
    })

    expect(response.statusCode).toBe(201)
    expect(response.json()).toMatchObject({
      user: { email: 'asha@flowline.com', status: 'PENDING' },
    })
    expect(authService.register).toHaveBeenCalledWith({
      fullName: 'Asha Menon',
      email: 'asha@flowline.com',
      password: 'secure-pass',
    })
  })

  it('sets an HTTP-only session cookie without returning the token', async () => {
    const app = buildApp(createAppOptions())
    apps.push(app)

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'asha@example.com', password: 'secure-pass' },
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['set-cookie']).toContain('flowline_session=')
    expect(response.headers['set-cookie']).toContain('HttpOnly')
    expect(response.body).not.toContain('opaque-session-token')
  })

  it('rejects invalid request payloads before calling the auth service', async () => {
    const authService = createAuthService()
    const app = buildApp(createAppOptions(authService))
    apps.push(app)

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { fullName: '', email: 'invalid', password: 'short' },
    })

    expect(response.statusCode).toBe(400)
    expect(authService.register).not.toHaveBeenCalled()
  })

  it('returns controlled authentication errors', async () => {
    const authService = createAuthService()
    authService.login = vi.fn(async () => {
      throw new AuthError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.')
    })
    const app = buildApp(createAppOptions(authService))
    apps.push(app)

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'asha@example.com', password: 'wrong-pass' },
    })

    expect(response.statusCode).toBe(401)
    expect(response.json()).toEqual({
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.',
      },
    })
  })
})

describe('dashboard route', () => {
  it('requires an authenticated session', async () => {
    const app = buildApp(createAppOptions())
    apps.push(app)

    const response = await app.inject({ method: 'GET', url: '/api/v1/dashboard' })

    expect(response.statusCode).toBe(401)
  })

  it('returns role-aware dashboard data for an authenticated user', async () => {
    const authService = createAuthService()
    authService.getSession = vi.fn(async () => ({
      id: 'user-1',
      email: 'asha@example.com',
      displayName: 'Asha Menon',
      status: 'ACTIVE' as const,
      roles: ['CSR'],
    }))
    const dashboardService = createDashboardService()
    const app = buildApp({
      ...createAppOptions(authService),
      dashboardService,
    })
    apps.push(app)

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/dashboard',
      cookies: { flowline_session: 'opaque-token' },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      role: 'CSR',
      metrics: { total: 5, active: 3, attention: 1, aging: 0, completed: 2, inProduction: 1 },
    })
  })

  it('returns a controlled pending-access response', async () => {
    const authService = createAuthService()
    authService.getSession = vi.fn(async () => ({
      id: 'user-1',
      email: 'asha@example.com',
      displayName: 'Asha Menon',
      status: 'PENDING' as const,
      roles: [],
    }))
    const dashboardService = createDashboardService()
    dashboardService.getDashboard = vi.fn(async () => {
      throw new DashboardAccessError('Awaiting role assignment.')
    })
    const app = buildApp({
      ...createAppOptions(authService),
      dashboardService,
    })
    apps.push(app)

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/dashboard',
      cookies: { flowline_session: 'opaque-token' },
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({
      error: { code: 'ACCESS_PENDING', message: 'Awaiting role assignment.' },
    })
  })
})

describe('CSR order routes', () => {
  it('allows CSR mutation methods in CORS preflight responses', async () => {
    const app = buildApp(createAppOptions())
    apps.push(app)

    const response = await app.inject({
      method: 'OPTIONS',
      url: `/api/v1/orders/${testOrder.id}`,
      headers: {
        origin: 'http://127.0.0.1:5173',
        'access-control-request-method': 'PATCH',
      },
    })

    expect(response.statusCode).toBe(204)
    expect(response.headers['access-control-allow-methods']).toContain('PATCH')
    expect(response.headers['access-control-allow-methods']).toContain('DELETE')
  })

  it('requires authentication', async () => {
    const app = buildApp(createAppOptions())
    apps.push(app)

    const response = await app.inject({ method: 'GET', url: '/api/v1/orders' })

    expect(response.statusCode).toBe(401)
  })

  it('lists orders for an authenticated CSR', async () => {
    const authService = createAuthService()
    authService.getSession = vi.fn(async () => ({
      id: 'user-1',
      email: 'asha@example.com',
      displayName: 'Asha Menon',
      status: 'ACTIVE' as const,
      roles: ['CSR'],
    }))
    const csrService = createCsrService()
    csrService.listOrders = vi.fn(async () => [testOrder])
    const app = buildApp({ ...createAppOptions(authService), csrService })
    apps.push(app)

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/orders?status=Draft',
      cookies: { flowline_session: 'opaque-token' },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({ orders: [{ orderNumber: 'FO-2026-001001' }] })
    expect(csrService.listOrders).toHaveBeenCalledWith(expect.objectContaining({ id: 'user-1' }), { status: 'Draft' })
  })

  it('creates an owned draft', async () => {
    const authService = createAuthService()
    authService.getSession = vi.fn(async () => ({
      id: 'user-1',
      email: 'asha@example.com',
      displayName: 'Asha Menon',
      status: 'ACTIVE' as const,
      roles: ['CSR'],
    }))
    const csrService = createCsrService()
    const app = buildApp({ ...createAppOptions(authService), csrService })
    apps.push(app)

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/orders',
      cookies: { flowline_session: 'opaque-token' },
      payload: { customerName: 'GreenBite Foods' },
    })

    expect(response.statusCode).toBe(201)
    expect(csrService.createDraft).toHaveBeenCalledWith(expect.objectContaining({ id: 'user-1' }), { customerName: 'GreenBite Foods' })
  })

  it('accepts an incomplete draft with empty date and nullable quantity', async () => {
    const authService = createAuthService()
    authService.getSession = vi.fn(async () => ({
      id: 'user-1',
      email: 'asha@example.com',
      displayName: 'Asha Menon',
      status: 'ACTIVE' as const,
      roles: ['CSR'],
    }))
    const csrService = createCsrService()
    const app = buildApp({ ...createAppOptions(authService), csrService })
    apps.push(app)

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/orders',
      cookies: { flowline_session: 'opaque-token' },
      payload: {
        customerName: '',
        productName: '',
        requestedQuantity: null,
        requestedDeliveryDate: '',
      },
    })

    expect(response.statusCode).toBe(201)
    expect(csrService.createDraft).toHaveBeenCalledWith(expect.objectContaining({ id: 'user-1' }), expect.objectContaining({ requestedQuantity: null, requestedDeliveryDate: null }))
  })

  it('returns controlled submission field errors', async () => {
    const authService = createAuthService()
    authService.getSession = vi.fn(async () => ({
      id: 'user-1',
      email: 'asha@example.com',
      displayName: 'Asha Menon',
      status: 'ACTIVE' as const,
      roles: ['CSR'],
    }))
    const csrService = createCsrService()
    csrService.submitOrder = vi.fn(async () => {
      throw new CsrError(422, 'SUBMISSION_INCOMPLETE', 'Complete all required fields.', ['productName'])
    })
    const app = buildApp({ ...createAppOptions(authService), csrService })
    apps.push(app)

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/orders/${testOrder.id}/submit`,
      cookies: { flowline_session: 'opaque-token' },
    })

    expect(response.statusCode).toBe(422)
    expect(response.json()).toEqual({
      error: {
        code: 'SUBMISSION_INCOMPLETE',
        message: 'Complete all required fields.',
        fields: ['productName'],
      },
    })
  })

  it('lists active R&D reviewers and assigns a selected reviewer', async () => {
    const authService = createAuthService()
    authService.getSession = vi.fn(async () => ({
      id: 'user-1',
      email: 'asha@example.com',
      displayName: 'Asha Menon',
      status: 'ACTIVE' as const,
      roles: ['CSR'],
    }))
    const csrService = createCsrService()
    const reviewer = {
      authUserId: '22222222-2222-4222-8222-222222222222',
      displayName: 'Dr. Ravi Shah',
      email: 'ravi@example.com',
    }
    csrService.listRdReviewers = vi.fn(async () => [reviewer])
    csrService.assignRdReviewer = vi.fn(async () => ({
      ...testOrder,
      assignedReviewer: reviewer,
    }))
    const app = buildApp({ ...createAppOptions(authService), csrService })
    apps.push(app)

    const listResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/reviewers/rd',
      cookies: { flowline_session: 'opaque-token' },
    })
    const assignResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/orders/${testOrder.id}/assign-rd`,
      cookies: { flowline_session: 'opaque-token' },
      payload: { reviewerAuthUserId: reviewer.authUserId },
    })

    expect(listResponse.statusCode).toBe(200)
    expect(listResponse.json()).toEqual({ reviewers: [reviewer] })
    expect(assignResponse.statusCode).toBe(200)
    expect(csrService.assignRdReviewer).toHaveBeenCalledWith(expect.objectContaining({ id: 'user-1' }), testOrder.id, reviewer.authUserId)
  })
})

describe('notification routes', () => {
  it('accepts an authenticated live notification connection', async () => {
    const authService = createAuthService()
    authService.getSession = vi.fn(async () => ({
      id: 'user-1',
      email: 'asha@example.com',
      displayName: 'Asha Menon',
      status: 'ACTIVE' as const,
      roles: ['CSR'],
    }))
    const app = buildApp(createAppOptions(authService))
    apps.push(app)
    await app.ready()

    let readyMessage: Promise<string> | undefined
    const socket = await app.injectWS(
      '/api/v1/notifications/live',
      {
        headers: { cookie: 'flowline_session=opaque-token' },
      },
      {
        onOpen: (openSocket) => {
          readyMessage = new Promise((resolve) => openSocket.once('message', (value) => resolve(value.toString())))
        },
      },
    )
    const message = await readyMessage

    expect(JSON.parse(message)).toEqual({ type: 'ready' })
    socket.close()
  })

  it('lists notifications for an authenticated user', async () => {
    const authService = createAuthService()
    authService.getSession = vi.fn(async () => ({
      id: 'user-1',
      email: 'asha@example.com',
      displayName: 'Asha Menon',
      status: 'ACTIVE' as const,
      roles: ['CSR'],
    }))
    const notificationService = createNotificationService()
    notificationService.listForUser = vi.fn(async () => [
      {
        id: '33333333-3333-4333-8333-333333333333',
        orderId: testOrder.id,
        orderNumber: testOrder.orderNumber,
        type: 'ORDER_SUBMITTED',
        title: 'New order ready for R&D review',
        message: 'Order FO-2026-001001 has been submitted for technical review.',
        createdAt: new Date('2026-10-22T08:00:00.000Z'),
        readAt: null,
      },
    ])
    const app = buildApp({ ...createAppOptions(authService), notificationService })
    apps.push(app)

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications',
      cookies: { flowline_session: 'opaque-token' },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({ notifications: [{ type: 'ORDER_SUBMITTED', readAt: null }] })
    expect(notificationService.listForUser).toHaveBeenCalledWith(expect.objectContaining({ id: 'user-1' }))
  })

  it('marks an owned notification as read', async () => {
    const authService = createAuthService()
    authService.getSession = vi.fn(async () => ({
      id: 'user-1',
      email: 'asha@example.com',
      displayName: 'Asha Menon',
      status: 'ACTIVE' as const,
      roles: ['CSR'],
    }))
    const notificationService = createNotificationService()
    const app = buildApp({ ...createAppOptions(authService), notificationService })
    apps.push(app)

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/notifications/33333333-3333-4333-8333-333333333333/read',
      cookies: { flowline_session: 'opaque-token' },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ ok: true })
    expect(notificationService.markRead).toHaveBeenCalledWith(expect.objectContaining({ id: 'user-1' }), '33333333-3333-4333-8333-333333333333')
  })
})

