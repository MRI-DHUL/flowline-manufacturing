import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildApp } from '../../backend/src/app.js'
import { AuthError } from '../../backend/src/auth-service.js'
import type { AuthService } from '../../backend/src/auth-service.js'
import { DashboardAccessError } from '../../backend/src/dashboard-service.js'
import type { DashboardService } from '../../backend/src/dashboard-service.js'
import { CsrError } from '../../backend/src/csr-service.js'
import type { CsrOrderDetail, CsrService } from '../../backend/src/csr-service.js'
import { NotificationHub } from '../../backend/src/notification-service.js'
import type { NotificationService } from '../../backend/src/notification-service.js'
import type { RdService } from '../../backend/src/rd-service.js'
import type { PlanningService } from '../../backend/src/planning-service.js'
import type { IssueService } from '../../backend/src/issue-service.js'
import type { PressService } from '../../backend/src/press-service.js'
import type { ShippingService } from '../../backend/src/shipping-service.js'

const apps: ReturnType<typeof buildApp>[] = []

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()))
})

function createAuthService(): AuthService {
  return {
    register: vi.fn(async (input) => ({
      id: 'user-1',
      email: input.email,
      displayName: input.fullName,
      status: 'PENDING' as const,
      roles: [],
    })),
    login: vi.fn(async (input) => ({
      user: {
        id: 'user-1',
        email: input.email,
        displayName: 'Asha Menon',
        status: 'ACTIVE' as const,
        roles: ['CSR'],
      },
      sessionToken: 'opaque-session-token',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    })),
    getSession: vi.fn(async () => null),
    logout: vi.fn(async () => undefined),
  }
}

function createDashboardService(): DashboardService {
  return {
    getDashboard: vi.fn(async (user) => ({
      user,
      role: 'CSR' as const,
      metrics: { total: 5, active: 3, attention: 1, aging: 0, completed: 2, inProduction: 1 },
      analytics: { stages: [], statuses: [], trend: [] },
      orders: [],
    })),
  }
}

const testOrder: CsrOrderDetail = {
  id: '11111111-1111-4111-8111-111111111111',
  orderNumber: 'FO-2026-001001',
  customerName: 'GreenBite Foods',
  productName: 'Snack pouch',
  status: 'Draft',
  stage: 'CSR',
  assignedReviewer: null,
  priority: 'Normal',
  requestedDeliveryDate: '2026-10-28',
  createdAt: new Date('2026-10-19T00:00:00.000Z'),
  updatedAt: new Date('2026-10-20T00:00:00.000Z'),
  openClarifications: 0,
  destination: null,
  productDescription: null,
  orderType: null,
  packagingType: 'Stand-up pouch',
  dimensions: null,
  material: 'PET / PE',
  printColors: null,
  requestedQuantity: 50000,
  technicalNotes: null,
  attachments: [],
  clarifications: [],
  activity: [],
}

function createCsrService(): CsrService {
  return {
    listOrders: vi.fn(async () => []),
    listOrderStatuses: vi.fn(async () => []),
    getOrder: vi.fn(async () => testOrder),
    createDraft: vi.fn(async () => testOrder),
    updateDraft: vi.fn(async () => testOrder),
    submitOrder: vi.fn(async () => ({ ...testOrder, status: 'R&D Review', stage: 'R&D' })),
    uploadAttachment: vi.fn(async () => testOrder),
    downloadAttachment: vi.fn(async () => ({
      fileName: 'artwork.pdf',
      mediaType: 'application/pdf',
      content: Buffer.from('content'),
    })),
    deleteAttachment: vi.fn(async () => testOrder),
    respondToClarification: vi.fn(async () => testOrder),
    listRdReviewers: vi.fn(async () => []),
    assignRdReviewer: vi.fn(async () => testOrder),
  }
}

function createNotificationService(): NotificationService {
  return {
    listForUser: vi.fn(async () => []),
    markRead: vi.fn(async () => undefined),
    deleteForUser: vi.fn(async () => undefined),
  }
}

function createRdService(): RdService {
  return {
    listQueue: vi.fn(async () => []),
    listPlanningUsers: vi.fn(async () => []),
    getOrder: vi.fn(async () => { throw new Error('Not configured in route tests') }),
    decide: vi.fn(async () => { throw new Error('Not configured in route tests') }),
    downloadAttachment: vi.fn(async () => ({
      fileName: 'specification.pdf',
      mediaType: 'application/pdf',
      content: Buffer.from('content'),
    })),
  }
}

function createPlanningService(): PlanningService {
  return {
    listQueue: vi.fn(async () => []),
    listResources: vi.fn(async () => ({ productionLines: [], pressUsers: [] })),
    getOrder: vi.fn(async () => { throw new Error('Not configured in route tests') }),
    saveAssessment: vi.fn(async () => { throw new Error('Not configured in route tests') }),
    release: vi.fn(async () => { throw new Error('Not configured in route tests') }),
    downloadAttachment: vi.fn(async () => ({
      fileName: 'specification.pdf',
      mediaType: 'application/pdf',
      content: Buffer.from('content'),
    })),
  }
}

function createIssueService(): IssueService {
  return {
    report: vi.fn(async (_user, orderId, message) => ({
      id: '55555555-5555-4555-8555-555555555555',
      orderId,
      orderNumber: testOrder.orderNumber,
      message,
      status: 'OPEN' as const,
      reportedAt: new Date('2026-10-22T12:00:00.000Z'),
      recipientCount: 2,
    })),
  }
}

function createPressService(): PressService {
  const unavailable = async () => { throw new Error('Not configured in route tests') }
  return {
    listQueue: vi.fn(async () => []),
    listShippingUsers: vi.fn(async () => []),
    getOrder: vi.fn(unavailable),
    accept: vi.fn(unavailable),
    start: vi.fn(unavailable),
    pause: vi.fn(unavailable),
    reportProductionIssue: vi.fn(unavailable),
    complete: vi.fn(unavailable),
  }
}

function createShippingService(): ShippingService {
  const unavailable = async () => { throw new Error('Not configured in route tests') }
  return {
    listQueue: vi.fn(async () => []),
    getOrder: vi.fn(unavailable),
    verifyReady: vi.fn(unavailable),
    dispatch: vi.fn(unavailable),
    uploadProof: vi.fn(unavailable),
    reportDeliveryIssue: vi.fn(unavailable),
    confirmDelivery: vi.fn(unavailable),
  }
}

function createAppOptions(authService = createAuthService()) {
  return {
    frontendOrigin: 'http://127.0.0.1:5173',
    secureCookies: false,
    authService,
    dashboardService: createDashboardService(),
    csrService: createCsrService(),
    notificationService: createNotificationService(),
    notificationHub: new NotificationHub(),
    rdService: createRdService(),
    planningService: createPlanningService(),
    issueService: createIssueService(),
    pressService: createPressService(),
    shippingService: createShippingService(),
    databaseCheck: async () => ({
      database: 'neondb',
      serverTime: new Date(),
      schemaReady: true,
      latestMigration: '002_postgresql_auth.sql',
    }),
  }
}

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
        email: 'asha@example.com',
        password: 'secure-pass',
        role: 'SYSTEM_ADMIN',
      },
    })

    expect(response.statusCode).toBe(201)
    expect(response.json()).toMatchObject({
      user: { email: 'asha@example.com', status: 'PENDING' },
    })
    expect(authService.register).toHaveBeenCalledWith({
      fullName: 'Asha Menon',
      email: 'asha@example.com',
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
    expect(csrService.listOrders).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-1' }),
      { status: 'Draft' },
    )
  })

  it('creates an owned draft', async () => {
    const authService = createAuthService()
    authService.getSession = vi.fn(async () => ({
      id: 'user-1', email: 'asha@example.com', displayName: 'Asha Menon', status: 'ACTIVE' as const, roles: ['CSR'],
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
    expect(csrService.createDraft).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-1' }),
      { customerName: 'GreenBite Foods' },
    )
  })

  it('accepts an incomplete draft with empty date and nullable quantity', async () => {
    const authService = createAuthService()
    authService.getSession = vi.fn(async () => ({
      id: 'user-1', email: 'asha@example.com', displayName: 'Asha Menon', status: 'ACTIVE' as const, roles: ['CSR'],
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
    expect(csrService.createDraft).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-1' }),
      expect.objectContaining({ requestedQuantity: null, requestedDeliveryDate: null }),
    )
  })

  it('returns controlled submission field errors', async () => {
    const authService = createAuthService()
    authService.getSession = vi.fn(async () => ({
      id: 'user-1', email: 'asha@example.com', displayName: 'Asha Menon', status: 'ACTIVE' as const, roles: ['CSR'],
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
      id: 'user-1', email: 'asha@example.com', displayName: 'Asha Menon', status: 'ACTIVE' as const, roles: ['CSR'],
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
    expect(csrService.assignRdReviewer).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-1' }),
      testOrder.id,
      reviewer.authUserId,
    )
  })
})

describe('notification routes', () => {
  it('accepts an authenticated live notification connection', async () => {
    const authService = createAuthService()
    authService.getSession = vi.fn(async () => ({
      id: 'user-1', email: 'asha@example.com', displayName: 'Asha Menon', status: 'ACTIVE' as const, roles: ['CSR'],
    }))
    const app = buildApp(createAppOptions(authService))
    apps.push(app)
    await app.ready()

    let readyMessage: Promise<string> | undefined
    const socket = await app.injectWS('/api/v1/notifications/live', {
      headers: { cookie: 'flowline_session=opaque-token' },
    }, {
      onOpen: (openSocket) => {
        readyMessage = new Promise((resolve) => openSocket.once('message', (value) => resolve(value.toString())))
      },
    })
    const message = await readyMessage

    expect(JSON.parse(message)).toEqual({ type: 'ready' })
    socket.close()
  })

  it('lists notifications for an authenticated user', async () => {
    const authService = createAuthService()
    authService.getSession = vi.fn(async () => ({
      id: 'user-1', email: 'asha@example.com', displayName: 'Asha Menon', status: 'ACTIVE' as const, roles: ['CSR'],
    }))
    const notificationService = createNotificationService()
    notificationService.listForUser = vi.fn(async () => [{
      id: '33333333-3333-4333-8333-333333333333',
      orderId: testOrder.id,
      orderNumber: testOrder.orderNumber,
      type: 'ORDER_SUBMITTED',
      title: 'New order ready for R&D review',
      message: 'Order FO-2026-001001 has been submitted for technical review.',
      createdAt: new Date('2026-10-22T08:00:00.000Z'),
      readAt: null,
    }])
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
      id: 'user-1', email: 'asha@example.com', displayName: 'Asha Menon', status: 'ACTIVE' as const, roles: ['CSR'],
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
    expect(notificationService.markRead).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-1' }),
      '33333333-3333-4333-8333-333333333333',
    )
  })
})

describe('R&D routes', () => {
  it('lists the authenticated R&D reviewer queue', async () => {
    const authService = createAuthService()
    authService.getSession = vi.fn(async () => ({
      id: 'rd-user-1', email: 'rd@example.com', displayName: 'R&D Reviewer', status: 'ACTIVE' as const, roles: ['R&D'],
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
      id: 'rd-user-1', email: 'rd@example.com', displayName: 'R&D Reviewer', status: 'ACTIVE' as const, roles: ['R&D'],
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
      id: 'rd-user-1', email: 'rd@example.com', displayName: 'R&D Reviewer', status: 'ACTIVE' as const, roles: ['R&D'],
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
    expect(rdService.decide).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'rd-user-1' }),
      testOrder.id,
      expect.objectContaining({ planningUserAuthUserId: null }),
    )
  })
})

describe('Planning routes', () => {
  it('lists the authenticated planner queue', async () => {
    const authService = createAuthService()
    authService.getSession = vi.fn(async () => ({
      id: 'planner-1', email: 'planner@example.com', displayName: 'Planner', status: 'ACTIVE' as const, roles: ['PLANNING'],
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
      id: 'planner-1', email: 'planner@example.com', displayName: 'Planner', status: 'ACTIVE' as const, roles: ['PLANNING'],
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
    expect(planningService.release).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'planner-1' }),
      testOrder.id,
      expect.objectContaining({ productionLineId, pressUserAuthUserId: pressUserId }),
    )
  })
})

describe('Issue escalation routes', () => {
  it('reports an order issue for an authenticated operational user', async () => {
    const authService = createAuthService()
    authService.getSession = vi.fn(async () => ({
      id: 'press-user-1', email: 'press@example.com', displayName: 'Press Operator', status: 'ACTIVE' as const, roles: ['PRESS'],
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
    expect(issueService.report).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'press-user-1', roles: ['PRESS'] }),
      testOrder.id,
      'The approved material is not available at the press.',
    )
  })

  it('rejects an issue message that is too short', async () => {
    const authService = createAuthService()
    authService.getSession = vi.fn(async () => ({
      id: 'planner-1', email: 'planner@example.com', displayName: 'Planner', status: 'ACTIVE' as const, roles: ['PLANNING'],
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
      id: 'press-user-1', email: 'press@example.com', displayName: 'Press Operator', status: 'ACTIVE' as const, roles: ['PRESS'],
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
      id: 'press-user-1', email: 'press@example.com', displayName: 'Press Operator', status: 'ACTIVE' as const, roles: ['PRESS'],
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
    expect(pressService.complete).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'press-user-1' }),
      testOrder.id,
      expect.objectContaining({ goodQuantity: 950, wasteQuantity: 50, shippingUserAuthUserId }),
    )
  })
})

describe('Shipping routes', () => {
  it('lists the authenticated Shipping user queue', async () => {
    const authService = createAuthService()
    authService.getSession = vi.fn(async () => ({ id: 'shipping-1', email: 'shipping@example.com', displayName: 'Shipping User', status: 'ACTIVE' as const, roles: ['SHIPPING'] }))
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
    authService.getSession = vi.fn(async () => ({ id: 'shipping-1', email: 'shipping@example.com', displayName: 'Shipping User', status: 'ACTIVE' as const, roles: ['SHIPPING'] }))
    const shippingService = createShippingService()
    shippingService.dispatch = vi.fn(async () => null as never)
    const app = buildApp({ ...createAppOptions(authService), shippingService })
    apps.push(app)
    const payload = { carrier: 'Flowline Logistics', trackingOrVehicleNumber: 'TN-01-AB-1234', dispatchAt: '2026-10-22T12:00:00.000Z', shippedQuantity: 950, destination: 'Chennai', expectedDeliveryAt: '2026-10-23T12:00:00.000Z' }
    const response = await app.inject({ method: 'POST', url: `/api/v1/shipping/orders/${testOrder.id}/dispatch`, cookies: { flowline_session: 'opaque-token' }, payload })
    expect(response.statusCode).toBe(200)
    expect(shippingService.dispatch).toHaveBeenCalledWith(expect.objectContaining({ id: 'shipping-1' }), testOrder.id, payload)
  })
})