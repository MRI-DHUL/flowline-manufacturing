import { buildApp } from './app.js'
import { PostgresAuthService } from './auth/auth-service.js'
import { getConfig } from './config.js'
import { PostgresCsrService } from './csr/csr-service.js'
import { PostgresDashboardService } from './dashboard/dashboard-service.js'
import { checkDatabase, createDatabasePool } from './database.js'
import { getLoggerOptions } from './logger.js'
import { NotificationHub, PostgresNotificationService } from './notifications/notification-service.js'
import { EmailNotificationService } from './notifications/email-notification-service.js'
import { PostgresRdService } from './rd/rd-service.js'
import { PostgresPlanningService } from './planning/planning-service.js'
import { PostgresIssueService } from './issues/issue-service.js'
import { PostgresPressService } from './press/press-service.js'
import { PostgresShippingService } from './shipping/shipping-service.js'
import { PostgresHoldService } from './holds/hold-service.js'
import { PostgresManagerService } from './manager/manager-service.js'
import { PostgresAdminService } from './admin/admin-service.js'
import { PostgresActivityService } from './activity/activity-service.js'

const config = getConfig()
const pool = createDatabasePool(config.DATABASE_URL)
const jwtSecrets = config.JWT_SECRETS
  ? config.JWT_SECRETS.split(',').map((secret) => secret.trim()).filter(Boolean)
  : [config.JWT_SECRET]
const dashboardService = new PostgresDashboardService(pool)
const notificationService = new PostgresNotificationService(pool)
const emailNotificationService = new EmailNotificationService(pool, { enabled: config.SMTP_ENABLED, host: config.SMTP_HOST, port: config.SMTP_PORT, secure: config.SMTP_SECURE, user: config.SMTP_USER, password: config.SMTP_PASSWORD, from: config.SMTP_FROM || config.SMTP_USER })
const notificationHub = new NotificationHub(emailNotificationService)
const authService = new PostgresAuthService(pool, jwtSecrets, notificationHub)
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
