import cors from '@fastify/cors'
import cookie from '@fastify/cookie'
import multipart from '@fastify/multipart'
import websocket from '@fastify/websocket'
import Fastify from 'fastify'
import type { FastifyServerOptions } from 'fastify'
import { registerAuthRoutes } from './auth-routes.js'
import type { AuthService } from './auth-service.js'
import { registerDashboardRoutes } from './dashboard-routes.js'
import type { DashboardService } from './dashboard-service.js'
import { registerCsrRoutes } from './csr-routes.js'
import type { CsrService } from './csr-service.js'
import type { DatabaseHealth } from './database.js'
import { registerNotificationRoutes } from './notification-routes.js'
import type { NotificationHub, NotificationService } from './notification-service.js'
import { registerRdRoutes } from './rd-routes.js'
import type { RdService } from './rd-service.js'
import { registerPlanningRoutes } from './planning-routes.js'
import type { PlanningService } from './planning-service.js'
import { registerIssueRoutes } from './issue-routes.js'
import type { IssueService } from './issue-service.js'
import { registerPressRoutes } from './press-routes.js'
import type { PressService } from './press-service.js'
import { registerShippingRoutes } from './shipping-routes.js'
import type { ShippingService } from './shipping-service.js'
import { registerHoldRoutes } from './hold-routes.js'
import type { HoldService } from './hold-service.js'

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
}

export function buildApp(options: BuildAppOptions) {
  const app = Fastify({ logger: options.logger ?? false })

  app.register(cors, {
    origin: options.frontendOrigin,
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
  app.after(() => {
    registerNotificationRoutes(app, options.authService, options.notificationService, options.notificationHub)
  })

  app.get('/health', async () => ({
    status: 'ok',
    service: 'flowline-backend',
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