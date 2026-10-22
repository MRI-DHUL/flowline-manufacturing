import { buildApp } from './app.js'
import { PostgresAuthService } from './auth-service.js'
import { getConfig } from './config.js'
import { PostgresCsrService } from './csr-service.js'
import { PostgresDashboardService } from './dashboard-service.js'
import { checkDatabase, createDatabasePool } from './database.js'
import { getLoggerOptions } from './logger.js'
import { NotificationHub, PostgresNotificationService } from './notification-service.js'

const config = getConfig()
const pool = createDatabasePool(config.DATABASE_URL)
const authService = new PostgresAuthService(pool)
const dashboardService = new PostgresDashboardService(pool)
const notificationService = new PostgresNotificationService(pool)
const notificationHub = new NotificationHub()
const csrService = new PostgresCsrService(pool, notificationHub)
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