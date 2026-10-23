import type { FastifyInstance, FastifyReply } from 'fastify'
import { z } from 'zod'
import { sessionCookieName } from '../auth/auth-routes.js'
import type { AuthService, AuthUser } from '../auth/auth-service.js'
import { IssueError } from './issue-service.js'
import type { IssueService } from './issue-service.js'

const orderParams = z.object({ orderId: z.uuid() })
const reportSchema = z.object({ message: z.string().trim().min(10).max(2000) })

async function authenticatedUser(request: { cookies: Record<string, string | undefined> }, reply: FastifyReply, authService: AuthService): Promise<AuthUser | null> {
  const token = request.cookies[sessionCookieName]
  if (!token) {
    reply.code(401).send({ error: { code: 'UNAUTHENTICATED', message: 'Authentication required.' } })
    return null
  }
  const user = await authService.getSession(token)
  if (!user) {
    reply.clearCookie(sessionCookieName, { path: '/' })
    reply.code(401).send({ error: { code: 'UNAUTHENTICATED', message: 'Authentication required.' } })
    return null
  }
  return user
}

function sendIssueError(reply: FastifyReply, error: unknown) {
  if (error instanceof z.ZodError) {
    return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Describe the issue in 10 to 2000 characters.' } })
  }
  if (error instanceof IssueError) {
    return reply.code(error.statusCode).send({ error: { code: error.code, message: error.message } })
  }
  throw error
}

export function registerIssueRoutes(app: FastifyInstance, authService: AuthService, issueService: IssueService) {
  app.post('/api/v1/orders/:orderId/issues', async (request, reply) => {
    try {
      const user = await authenticatedUser(request, reply, authService)
      if (!user) return
      const { orderId } = orderParams.parse(request.params)
      const { message } = reportSchema.parse(request.body)
      return { issue: await issueService.report(user, orderId, message) }
    } catch (error) {
      return sendIssueError(reply, error)
    }
  })
}
