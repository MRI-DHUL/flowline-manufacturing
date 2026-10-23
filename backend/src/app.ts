import cors from '@fastify/cors'
import cookie from '@fastify/cookie'
import multipart from '@fastify/multipart'
import websocket from '@fastify/websocket'
import rateLimit from '@fastify/rate-limit'
import helmet from '@fastify/helmet'
import Fastify from 'fastify'
import type { FastifyServerOptions } from 'fastify'
import { registerAuthRoutes } from './auth/auth-routes.js'
import type { AuthService } from './auth/auth-service.js'
import { registerDashboardRoutes } from './dashboard/dashboard-routes.js'
import type { DashboardService } from './dashboard/dashboard-service.js'
import { registerCsrRoutes } from './csr/csr-routes.js'
import type { CsrService } from './csr/csr-service.js'
import type { DatabaseHealth } from './database.js'
import { registerNotificationRoutes } from './notifications/notification-routes.js'
import type { NotificationHub, NotificationService } from './notifications/notification-service.js'
import { registerRdRoutes } from './rd/rd-routes.js'
import type { RdService } from './rd/rd-service.js'
import { registerPlanningRoutes } from './planning/planning-routes.js'
import type { PlanningService } from './planning/planning-service.js'
import { registerIssueRoutes } from './issues/issue-routes.js'
import type { IssueService } from './issues/issue-service.js'
import { registerPressRoutes } from './press/press-routes.js'
import type { PressService } from './press/press-service.js'
import { registerShippingRoutes } from './shipping/shipping-routes.js'
import type { ShippingService } from './shipping/shipping-service.js'
import { registerHoldRoutes } from './holds/hold-routes.js'
import type { HoldService } from './holds/hold-service.js'
import { registerManagerRoutes } from './manager/manager-routes.js'
import type { ManagerService } from './manager/manager-service.js'
import { registerAdminRoutes } from './admin/admin-routes.js'
import type { AdminService } from './admin/admin-service.js'
import { registerActivityRoutes } from './activity/activity-routes.js'
import type { PostgresActivityService } from './activity/activity-service.js'

type BuildAppOptions = {
  frontendOrigin: string
  secureCookies: boolean
  logger?: FastifyServerOptions['logger']
  databaseCheck: () => Promise<DatabaseHealth>
  authService: AuthService
  dashboardService: DashboardService
  csrService: CsrService
  notificationService: NotificationService
  notificationHub: NotificationHub
  rdService: RdService
  planningService: PlanningService
  issueService: IssueService
  pressService: PressService
  shippingService: ShippingService
  holdService?: HoldService
  managerService?: ManagerService
  adminService?: AdminService
  activityService?: PostgresActivityService
}

export function buildApp(options: BuildAppOptions) {
  const app = Fastify({ logger: options.logger ?? false })

  app.register(rateLimit, { global: false })
  app.register(helmet)
  app.addHook('onSend', async (request, reply) => {
    reply.header('x-request-id', request.id)
  })

  const localOrigins = /^(https?:\/\/)(127\.0\.0\.1|localhost)(:\d+)?$/.test(options.frontendOrigin)
    ? [options.frontendOrigin, 'http://127.0.0.1:5174']
    : options.frontendOrigin
  app.register(cors, {
    origin: localOrigins,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  })
  app.register(cookie)
  app.register(multipart, {
    limits: { files: 1, fileSize: 5 * 1024 * 1024 },
  })
  app.register(websocket)

  registerAuthRoutes(app, options.authService, options.secureCookies)
  registerDashboardRoutes(app, options.authService, options.dashboardService)
  registerCsrRoutes(app, options.authService, options.csrService)
  registerRdRoutes(app, options.authService, options.rdService)
  registerPlanningRoutes(app, options.authService, options.planningService)
  registerIssueRoutes(app, options.authService, options.issueService)
  registerPressRoutes(app, options.authService, options.pressService)
  registerShippingRoutes(app, options.authService, options.shippingService)
  if (options.holdService) registerHoldRoutes(app, options.authService, options.holdService)
  if (options.managerService) registerManagerRoutes(app, options.authService, options.managerService)
  if (options.adminService) registerAdminRoutes(app, options.authService, options.adminService)
  if (options.activityService) registerActivityRoutes(app, options.authService, options.activityService)
  app.after(() => {
    registerNotificationRoutes(app, options.authService, options.notificationService, options.notificationHub)
  })

  app.get('/health', async () => ({
    status: 'ok',
    service: 'flowline-backend',
    ...(process.env.RENDER_GIT_COMMIT ? { commit: process.env.RENDER_GIT_COMMIT } : {}),
  }))

  app.get('/api/v1/health/database', async (_request, reply) => {
    try {
      const database = await options.databaseCheck()
      return { status: 'ok', database }
    } catch (error) {
      app.log.error({ err: error }, 'Database health check failed')
      return reply.code(503).send({
        status: 'unavailable',
        message: 'Database connection is unavailable.',
      })
    }
  })

  return app
}
