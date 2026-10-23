import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildApp } from '../../backend/src/app.js'
import { AuthError } from '../../backend/src/auth/auth-service.js'
import type { AuthService } from '../../backend/src/auth/auth-service.js'
import { DashboardAccessError } from '../../backend/src/dashboard/dashboard-service.js'
import type { DashboardService } from '../../backend/src/dashboard/dashboard-service.js'
import { CsrError } from '../../backend/src/csr/csr-service.js'
import type { CsrOrderDetail, CsrService } from '../../backend/src/csr/csr-service.js'
import { NotificationHub } from '../../backend/src/notifications/notification-service.js'
import type { NotificationService } from '../../backend/src/notifications/notification-service.js'
import type { RdService } from '../../backend/src/rd/rd-service.js'
import type { PlanningService } from '../../backend/src/planning/planning-service.js'
import type { IssueService } from '../../backend/src/issues/issue-service.js'
import type { PressService } from '../../backend/src/press/press-service.js'
import type { ShippingService } from '../../backend/src/shipping/shipping-service.js'
import type { AdminOrder, AdminService, AdminUser } from '../../backend/src/admin/admin-service.js'

export const apps: ReturnType<typeof buildApp>[] = []

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()))
})

export function createAuthService(): AuthService {
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

export function createDashboardService(): DashboardService {
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

export const testOrder: CsrOrderDetail = {
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

export function createCsrService(): CsrService {
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

export function createNotificationService(): NotificationService {
  return {
    listForUser: vi.fn(async () => []),
    markRead: vi.fn(async () => undefined),
    deleteForUser: vi.fn(async () => undefined),
  }
}

export function createRdService(): RdService {
  return {
    listQueue: vi.fn(async () => []),
    listPlanningUsers: vi.fn(async () => []),
    getOrder: vi.fn(async () => {
      throw new Error('Not configured in route tests')
    }),
    decide: vi.fn(async () => {
      throw new Error('Not configured in route tests')
    }),
    downloadAttachment: vi.fn(async () => ({
      fileName: 'specification.pdf',
      mediaType: 'application/pdf',
      content: Buffer.from('content'),
    })),
  }
}

export function createPlanningService(): PlanningService {
  return {
    listQueue: vi.fn(async () => []),
    listResources: vi.fn(async () => ({ productionLines: [], pressUsers: [] })),
    getOrder: vi.fn(async () => {
      throw new Error('Not configured in route tests')
    }),
    saveAssessment: vi.fn(async () => {
      throw new Error('Not configured in route tests')
    }),
    release: vi.fn(async () => {
      throw new Error('Not configured in route tests')
    }),
    downloadAttachment: vi.fn(async () => ({
      fileName: 'specification.pdf',
      mediaType: 'application/pdf',
      content: Buffer.from('content'),
    })),
  }
}

export function createIssueService(): IssueService {
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

export function createPressService(): PressService {
  const unavailable = async () => {
    throw new Error('Not configured in route tests')
  }
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

export function createShippingService(): ShippingService {
  const unavailable = async () => {
    throw new Error('Not configured in route tests')
  }
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

export const adminOrder: AdminOrder = {
  id: '99999999-9999-4999-8999-999999999999',
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
}

const adminUser: AdminUser = {
  authUserId: 'admin-user-1',
  displayName: 'System Administrator',
  email: 'admin@flowline.com',
  status: 'ACTIVE',
  roles: ['SYSTEM_ADMIN'],
}

export function createAdminService(): AdminService {
  return {
    listUsers: vi.fn(async () => [adminUser]),
    listOrders: vi.fn(async () => [adminOrder]),
    updateUser: vi.fn(async () => adminUser),
  }
}

export function createAppOptions(authService = createAuthService()) {
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
    adminService: createAdminService(),
    databaseCheck: async () => ({
      database: 'neondb',
      serverTime: new Date(),
      schemaReady: true,
      latestMigration: '002_postgresql_auth.sql',
    }),
  }
}

