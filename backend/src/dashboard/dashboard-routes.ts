import type { FastifyInstance } from 'fastify'
import { sessionCookieName } from '../auth/auth-routes.js'
import type { AuthService } from '../auth/auth-service.js'
import { DashboardAccessError } from './dashboard-service.js'
import type { DashboardService } from './dashboard-service.js'

export function registerDashboardRoutes(app: FastifyInstance, authService: AuthService, dashboardService: DashboardService) {
  app.get('/api/v1/dashboard', async (request, reply) => {
    const token = request.cookies[sessionCookieName]
    if (!token) {
      return reply.code(401).send({
        error: { code: 'UNAUTHENTICATED', message: 'Authentication required.' },
      })
    }

    const user = await authService.getSession(token)
    if (!user) {
      reply.clearCookie(sessionCookieName, { path: '/' })
      return reply.code(401).send({
        error: { code: 'UNAUTHENTICATED', message: 'Authentication required.' },
      })
    }

    try {
      return await dashboardService.getDashboard(user)
    } catch (error) {
      if (error instanceof DashboardAccessError) {
        return reply.code(403).send({
          error: { code: 'ACCESS_PENDING', message: error.message },
        })
      }
      throw error
    }
  })
}
