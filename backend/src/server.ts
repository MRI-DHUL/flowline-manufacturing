import { buildApp } from './app.js'
import { PostgresAuthService } from './auth-service.js'
import { getConfig } from './config.js'
import { PostgresCsrService } from './csr-service.js'
import { PostgresDashboardService } from './dashboard-service.js'
import { checkDatabase, createDatabasePool } from './database.js'
import { getLoggerOptions } from './logger.js'
import { NotificationHub, PostgresNotificationService } from './notification-service.js'
import { PostgresRdService } from './rd-service.js'
import { PostgresPlanningService } from './planning-service.js'
import { PostgresIssueService } from './issue-service.js'
import { PostgresPressService } from './press-service.js'
import { PostgresShippingService } from './shipping-service.js'
import { PostgresHoldService } from './hold-service.js'
import { PostgresManagerService } from './manager-service.js'
import { PostgresAdminService } from './admin-service.js'
import { PostgresActivityService } from './activity-service.js'

const config = getConfig()
const pool = createDatabasePool(config.DATABASE_URL)
const authService = new PostgresAuthService(pool)
const dashboardService = new PostgresDashboardService(pool)
const notificationService = new PostgresNotificationService(pool)
const notificationHub = new NotificationHub()
const csrService = new PostgresCsrService(pool, notificationHub)
const rdService = new PostgresRdService(pool, notificationHub)
const planningService = new PostgresPlanningService(pool, notificationHub)
const issueService = new PostgresIssueService(pool, notificationHub)
const pressService = new PostgresPressService(pool, notificationHub)
const shippingService = new PostgresShippingService(pool, notificationHub)
const holdService = new PostgresHoldService(pool, notificationHub)
const managerService = new PostgresManagerService(pool, notificationHub)
const adminService = new PostgresAdminService(pool)
const activityService = new PostgresActivityService(pool)
const app = buildApp({
  frontendOrigin: config.FRONTEND_ORIGIN,
  secureCookies: config.NODE_ENV === 'production',
  logger: getLoggerOptions(config.LOG_LEVEL),
  databaseCheck: () => checkDatabase(pool),
  authService,
  dashboardService,
  csrService,
  notificationService,
  notificationHub,
  rdService,
  planningService,
  issueService,
  pressService,
  shippingService,
  holdService,
  managerService,
  adminService,
  activityService,
})

const close = async (signal: string) => {
  app.log.info({ signal }, 'Shutting down')
  await app.close()
  await pool.end()
  process.exit(0)
}

process.on('SIGINT', () => void close('SIGINT'))
process.on('SIGTERM', () => void close('SIGTERM'))

try {
  await app.listen({ host: config.HOST, port: config.PORT })
} catch (error) {
  app.log.fatal({ err: error }, 'Backend startup failed')
  await pool.end()
  process.exit(1)
}
