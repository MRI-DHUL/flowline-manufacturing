import type { FastifyInstance, FastifyReply } from 'fastify'
import { z } from 'zod'
import { sessionCookieName } from './auth-routes.js'
import type { AuthService, AuthUser } from './auth-service.js'
import { AdminError } from './admin-service.js'
import type { AdminService } from './admin-service.js'
const params = z.object({ userId: z.uuid() })
const body = z.object({ status: z.enum(['PENDING', 'ACTIVE', 'DISABLED']), role: z.string().trim().min(1).max(30) })
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
  if (error instanceof z.ZodError) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Check the user details.' } })
  if (error instanceof AdminError) return reply.code(error.statusCode).send({ error: { code: error.code, message: error.message } })
  throw error
}
export function registerAdminRoutes(app: FastifyInstance, auth: AuthService, service: AdminService) {
  app.get('/api/v1/admin/users', async (request, reply) => {
    try {
      const user = await current(request, reply, auth)
      if (!user) return
      return { users: await service.listUsers(user) }
    } catch (error) {
      return send(reply, error)
    }
  })
  app.patch('/api/v1/admin/users/:userId', async (request, reply) => {
    try {
      const user = await current(request, reply, auth)
      if (!user) return
      return { user: await service.updateUser(user, params.parse(request.params).userId, body.parse(request.body)) }
    } catch (error) {
      return send(reply, error)
    }
  })
}
