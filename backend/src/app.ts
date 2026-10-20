import cors from '@fastify/cors'
import cookie from '@fastify/cookie'
import Fastify from 'fastify'
import type { FastifyServerOptions } from 'fastify'
import { registerAuthRoutes } from './auth-routes.js'
import type { AuthService } from './auth-service.js'
import type { DatabaseHealth } from './database.js'

type BuildAppOptions = {
  frontendOrigin: string
  secureCookies: boolean
  logger?: FastifyServerOptions['logger']
  databaseCheck: () => Promise<DatabaseHealth>
  authService: AuthService
}

export function buildApp(options: BuildAppOptions) {
  const app = Fastify({ logger: options.logger ?? false })

  app.register(cors, {
    origin: options.frontendOrigin,
    credentials: true,
  })
  app.register(cookie)

  registerAuthRoutes(app, options.authService, options.secureCookies)

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