import type { FastifyInstance, FastifyReply } from 'fastify'
import { z } from 'zod'
import { sessionCookieName } from '../auth/auth-routes.js'
import type { AuthService, AuthUser } from '../auth/auth-service.js'
import { HoldError } from './hold-service.js'
import type { HoldService } from './hold-service.js'

const orderParams = z.object({ orderId: z.uuid() })
const holdParams = z.object({ holdId: z.uuid() })
const holdSchema = z.object({
  category: z.string().trim().min(1).max(100),
  reason: z.string().trim().min(10).max(2000),
  responsibleTeam: z.string().trim().min(1).max(50),
  ownerAuthUserId: z.uuid(),
  correctiveAction: z.string().trim().max(3000).nullable().optional(),
  targetResolutionDate: z.iso.date(),
})
const reassignSchema = z.object({ ownerAuthUserId: z.uuid(), responsibleTeam: z.string().trim().min(1).max(50) })
const resolveSchema = z.object({
  action: z.enum(['RESUME', 'REVIEW', 'CANCEL']),
  resolution: z.string().trim().min(10).max(2000),
  stage: z.string().trim().max(50).nullable().optional(),
  ownerAuthUserId: z.uuid().nullable().optional(),
})
const ownerQuery = z.object({ team: z.string().trim().min(1).max(50) })

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

function sendHoldError(reply: FastifyReply, error: unknown) {
  if (error instanceof z.ZodError) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Check the hold details.' } })
  if (error instanceof HoldError) return reply.code(error.statusCode).send({ error: { code: error.code, message: error.message, fields: error.fields } })
  throw error
}

export function registerHoldRoutes(app: FastifyInstance, authService: AuthService, holdService: HoldService) {
  app.get('/api/v1/hold-owners', async (request, reply) => {
    try {
      const user = await authenticatedUser(request, reply, authService)
      if (!user) return
      return { users: await holdService.listOwners(user, ownerQuery.parse(request.query).team) }
    } catch (error) {
      return sendHoldError(reply, error)
    }
  })
  app.get('/api/v1/orders/:orderId/holds', async (request, reply) => {
    try {
      const user = await authenticatedUser(request, reply, authService)
      if (!user) return
      return { holds: await holdService.listForOrder(user, orderParams.parse(request.params).orderId) }
    } catch (error) {
      return sendHoldError(reply, error)
    }
  })
  app.post('/api/v1/orders/:orderId/holds', async (request, reply) => {
    try {
      const user = await authenticatedUser(request, reply, authService)
      if (!user) return
      return { hold: await holdService.place(user, orderParams.parse(request.params).orderId, holdSchema.parse(request.body)) }
    } catch (error) {
      return sendHoldError(reply, error)
    }
  })
  app.post('/api/v1/holds/:holdId/reassign', async (request, reply) => {
    try {
      const user = await authenticatedUser(request, reply, authService)
      if (!user) return
      return {
        hold: await holdService.reassign(user, holdParams.parse(request.params).holdId, reassignSchema.parse(request.body).ownerAuthUserId, reassignSchema.parse(request.body).responsibleTeam),
      }
    } catch (error) {
      return sendHoldError(reply, error)
    }
  })
  app.post('/api/v1/holds/:holdId/resolve', async (request, reply) => {
    try {
      const user = await authenticatedUser(request, reply, authService)
      if (!user) return
      return { hold: await holdService.resolve(user, holdParams.parse(request.params).holdId, resolveSchema.parse(request.body)) }
    } catch (error) {
      return sendHoldError(reply, error)
    }
  })
}
