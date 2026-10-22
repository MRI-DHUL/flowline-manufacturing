import type { FastifyInstance, FastifyReply } from 'fastify'
import { z } from 'zod'
import { sessionCookieName } from './auth-routes.js'
import type { AuthService, AuthUser } from './auth-service.js'
import { ActivityError, PostgresActivityService } from './activity-service.js'

const params = z.object({ orderId: z.uuid() })
async function current(
  request: { cookies: Record<string, string | undefined> },
  reply: FastifyReply,
  auth: AuthService,
): Promise<AuthUser | null> {
  const token = request.cookies[sessionCookieName]
  if (!token) {
    reply.code(401).send({ error: { code: 'UNAUTHENTICATED', message: 'Authentication required.' } })
    return null
  }
  const user = await auth.getSession(token)
  if (!user) {
    reply.code(401).send({ error: { code: 'UNAUTHENTICATED', message: 'Authentication required.' } })
    return null
  }
  return user
}
function send(reply: FastifyReply, error: unknown) {
  if (error instanceof z.ZodError)
    return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Invalid order identifier.' } })
  if (error instanceof ActivityError) return reply.code(error.statusCode).send({ error: { code: error.code, message: error.message } })
  throw error
}
export function registerActivityRoutes(app: FastifyInstance, auth: AuthService, service: PostgresActivityService) {
  app.get('/api/v1/orders/:orderId/activity', async (request, reply) => {
    try {
      const user = await current(request, reply, auth)
      if (!user) return
      return { activity: await service.list(user, params.parse(request.params).orderId) }
    } catch (error) {
      return send(reply, error)
    }
  })
}
