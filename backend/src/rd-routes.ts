import type { FastifyInstance, FastifyReply } from 'fastify'
import { z } from 'zod'
import { sessionCookieName } from './auth-routes.js'
import type { AuthService, AuthUser } from './auth-service.js'
import { RdError } from './rd-service.js'
import type { RdDecisionInput, RdService } from './rd-service.js'

const orderParams = z.object({ orderId: z.uuid() })
const attachmentParams = orderParams.extend({ attachmentId: z.uuid() })
const decisionSchema = z.object({
  decision: z.enum(['APPROVED', 'CLARIFICATION_REQUESTED', 'REJECTED', 'ON_HOLD']),
  technicalComments: z.string().trim().min(1).max(5000),
  toolingRequirements: z.string().max(3000).nullable().optional(),
  materialRecommendation: z.string().max(3000).nullable().optional(),
  constraintsAndRisks: z.string().max(3000).nullable().optional(),
  clarificationQuestion: z.string().max(5000).nullable().optional(),
  planningUserAuthUserId: z.preprocess((value) => (value === '' ? null : value), z.uuid().nullable().optional()),
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

function sendRdError(reply: FastifyReply, error: unknown) {
  if (error instanceof z.ZodError) {
    return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Check the technical review details.' } })
  }
  if (error instanceof RdError) {
    return reply.code(error.statusCode).send({
      error: { code: error.code, message: error.message, fields: error.fields },
    })
  }
  throw error
}

export function registerRdRoutes(app: FastifyInstance, authService: AuthService, rdService: RdService) {
  app.get('/api/v1/rd/planners', async (request, reply) => {
    try {
      const user = await authenticatedUser(request, reply, authService)
      if (!user) return
      return { planners: await rdService.listPlanningUsers(user) }
    } catch (error) {
      return sendRdError(reply, error)
    }
  })

  app.get('/api/v1/rd/orders', async (request, reply) => {
    try {
      const user = await authenticatedUser(request, reply, authService)
      if (!user) return
      return { orders: await rdService.listQueue(user) }
    } catch (error) {
      return sendRdError(reply, error)
    }
  })

  app.get('/api/v1/rd/orders/:orderId', async (request, reply) => {
    try {
      const user = await authenticatedUser(request, reply, authService)
      if (!user) return
      const { orderId } = orderParams.parse(request.params)
      return { order: await rdService.getOrder(user, orderId) }
    } catch (error) {
      return sendRdError(reply, error)
    }
  })

  app.post('/api/v1/rd/orders/:orderId/decision', async (request, reply) => {
    try {
      const user = await authenticatedUser(request, reply, authService)
      if (!user) return
      const { orderId } = orderParams.parse(request.params)
      const input = decisionSchema.parse(request.body) as RdDecisionInput
      return { order: await rdService.decide(user, orderId, input) }
    } catch (error) {
      return sendRdError(reply, error)
    }
  })

  app.get('/api/v1/rd/orders/:orderId/attachments/:attachmentId', async (request, reply) => {
    try {
      const user = await authenticatedUser(request, reply, authService)
      if (!user) return
      const { orderId, attachmentId } = attachmentParams.parse(request.params)
      const attachment = await rdService.downloadAttachment(user, orderId, attachmentId)
      return reply
        .header('content-type', attachment.mediaType)
        .header('content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`)
        .send(attachment.content)
    } catch (error) {
      return sendRdError(reply, error)
    }
  })
}
