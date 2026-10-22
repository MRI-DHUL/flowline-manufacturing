import type { FastifyInstance, FastifyReply } from 'fastify'
import { z } from 'zod'
import { sessionCookieName } from './auth-routes.js'
import type { AuthService, AuthUser } from './auth-service.js'
import { PressError } from './press-service.js'
import type { PressCompletionInput, PressService } from './press-service.js'

const orderParams = z.object({ orderId: z.uuid() })
const pauseSchema = z.object({ reason: z.string().trim().min(5).max(2000) })
const issueSchema = z.object({
  category: z.string().trim().min(1).max(100),
  notes: z.string().trim().min(10).max(3000),
  correctiveAction: z.string().max(3000).nullable().optional(),
})
const reworkSchema = z.object({ action: z.enum(['RESUME', 'REVIEW']), resolution: z.string().trim().min(10).max(3000) })
const completionSchema = z.object({
  goodQuantity: z.number().positive(),
  wasteQuantity: z.number().nonnegative(),
  notes: z.string().max(3000).nullable().optional(),
  shippingUserAuthUserId: z.uuid(),
})

async function authenticatedUser(
  request: { cookies: Record<string, string | undefined> },
  reply: FastifyReply,
  authService: AuthService,
): Promise<AuthUser | null> {
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

function sendPressError(reply: FastifyReply, error: unknown) {
  if (error instanceof z.ZodError) {
    return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Check the production details.' } })
  }
  if (error instanceof PressError) {
    return reply.code(error.statusCode).send({ error: { code: error.code, message: error.message, fields: error.fields } })
  }
  throw error
}

export function registerPressRoutes(app: FastifyInstance, authService: AuthService, pressService: PressService) {
  app.get('/api/v1/press/orders', async (request, reply) => {
    try {
      const user = await authenticatedUser(request, reply, authService)
      if (!user) return
      return { orders: await pressService.listQueue(user) }
    } catch (error) {
      return sendPressError(reply, error)
    }
  })

  app.get('/api/v1/press/shipping-users', async (request, reply) => {
    try {
      const user = await authenticatedUser(request, reply, authService)
      if (!user) return
      return { users: await pressService.listShippingUsers(user) }
    } catch (error) {
      return sendPressError(reply, error)
    }
  })

  app.get('/api/v1/press/orders/:orderId', async (request, reply) => {
    try {
      const user = await authenticatedUser(request, reply, authService)
      if (!user) return
      const { orderId } = orderParams.parse(request.params)
      return { order: await pressService.getOrder(user, orderId) }
    } catch (error) {
      return sendPressError(reply, error)
    }
  })

  app.post('/api/v1/press/orders/:orderId/accept', async (request, reply) => {
    try {
      const user = await authenticatedUser(request, reply, authService)
      if (!user) return
      const { orderId } = orderParams.parse(request.params)
      return { order: await pressService.accept(user, orderId) }
    } catch (error) {
      return sendPressError(reply, error)
    }
  })

  app.post('/api/v1/press/orders/:orderId/start', async (request, reply) => {
    try {
      const user = await authenticatedUser(request, reply, authService)
      if (!user) return
      const { orderId } = orderParams.parse(request.params)
      return { order: await pressService.start(user, orderId) }
    } catch (error) {
      return sendPressError(reply, error)
    }
  })

  app.post('/api/v1/press/orders/:orderId/pause', async (request, reply) => {
    try {
      const user = await authenticatedUser(request, reply, authService)
      if (!user) return
      const { orderId } = orderParams.parse(request.params)
      const { reason } = pauseSchema.parse(request.body)
      return { order: await pressService.pause(user, orderId, reason) }
    } catch (error) {
      return sendPressError(reply, error)
    }
  })

  app.post('/api/v1/press/orders/:orderId/production-issues', async (request, reply) => {
    try {
      const user = await authenticatedUser(request, reply, authService)
      if (!user) return
      const { orderId } = orderParams.parse(request.params)
      return { order: await pressService.reportProductionIssue(user, orderId, issueSchema.parse(request.body)) }
    } catch (error) {
      return sendPressError(reply, error)
    }
  })

  app.post('/api/v1/press/orders/:orderId/rework/resolve', async (request, reply) => {
    try {
      const user = await authenticatedUser(request, reply, authService)
      if (!user) return
      const { orderId } = orderParams.parse(request.params)
      return { order: await pressService.resolveProductionIssue(user, orderId, reworkSchema.parse(request.body)) }
    } catch (error) {
      return sendPressError(reply, error)
    }
  })

  app.post('/api/v1/press/orders/:orderId/complete', async (request, reply) => {
    try {
      const user = await authenticatedUser(request, reply, authService)
      if (!user) return
      const { orderId } = orderParams.parse(request.params)
      return { order: await pressService.complete(user, orderId, completionSchema.parse(request.body) as PressCompletionInput) }
    } catch (error) {
      return sendPressError(reply, error)
    }
  })
}
