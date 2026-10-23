import type { FastifyInstance, FastifyReply } from 'fastify'
import { z } from 'zod'
import { sessionCookieName } from '../auth/auth-routes.js'
import type { AuthService, AuthUser } from '../auth/auth-service.js'
import { PlanningError } from './planning-service.js'
import type { PlanningAssessmentInput, PlanningService } from './planning-service.js'

const orderParams = z.object({ orderId: z.uuid() })
const attachmentParams = orderParams.extend({ attachmentId: z.uuid() })
const optionalDate = z.preprocess((value) => (value === '' ? null : value), z.iso.date().nullable().optional())
const optionalUuid = z.preprocess((value) => (value === '' ? null : value), z.uuid().nullable().optional())
const assessmentSchema = z.object({
  materialStatus: z.enum(['PENDING', 'AVAILABLE', 'SHORTAGE']),
  shortageReason: z.string().max(3000).nullable().optional(),
  expectedMaterialDate: optionalDate,
  productionLineId: optionalUuid,
  plannedProductionDate: optionalDate,
  capacityStatus: z.enum(['PENDING', 'AVAILABLE', 'UNAVAILABLE']),
  readinessStatus: z.enum(['PENDING', 'READY', 'BLOCKED']),
  planningNotes: z.string().max(5000).nullable().optional(),
  pressUserAuthUserId: optionalUuid,
})

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

function sendPlanningError(reply: FastifyReply, error: unknown) {
  if (error instanceof z.ZodError) {
    return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Check the planning details.' } })
  }
  if (error instanceof PlanningError) {
    return reply.code(error.statusCode).send({
      error: { code: error.code, message: error.message, fields: error.fields },
    })
  }
  throw error
}

export function registerPlanningRoutes(app: FastifyInstance, authService: AuthService, planningService: PlanningService) {
  app.get('/api/v1/planning/orders', async (request, reply) => {
    try {
      const user = await authenticatedUser(request, reply, authService)
      if (!user) return
      return { orders: await planningService.listQueue(user) }
    } catch (error) {
      return sendPlanningError(reply, error)
    }
  })

  app.get('/api/v1/planning/resources', async (request, reply) => {
    try {
      const user = await authenticatedUser(request, reply, authService)
      if (!user) return
      return await planningService.listResources(user)
    } catch (error) {
      return sendPlanningError(reply, error)
    }
  })

  app.get('/api/v1/planning/orders/:orderId', async (request, reply) => {
    try {
      const user = await authenticatedUser(request, reply, authService)
      if (!user) return
      const { orderId } = orderParams.parse(request.params)
      return { order: await planningService.getOrder(user, orderId) }
    } catch (error) {
      return sendPlanningError(reply, error)
    }
  })

  app.patch('/api/v1/planning/orders/:orderId/assessment', async (request, reply) => {
    try {
      const user = await authenticatedUser(request, reply, authService)
      if (!user) return
      const { orderId } = orderParams.parse(request.params)
      const input = assessmentSchema.parse(request.body) as PlanningAssessmentInput
      return { order: await planningService.saveAssessment(user, orderId, input) }
    } catch (error) {
      return sendPlanningError(reply, error)
    }
  })

  app.post('/api/v1/planning/orders/:orderId/release', async (request, reply) => {
    try {
      const user = await authenticatedUser(request, reply, authService)
      if (!user) return
      const { orderId } = orderParams.parse(request.params)
      const input = assessmentSchema.parse(request.body) as PlanningAssessmentInput
      return { order: await planningService.release(user, orderId, input) }
    } catch (error) {
      return sendPlanningError(reply, error)
    }
  })

  app.get('/api/v1/planning/orders/:orderId/attachments/:attachmentId', async (request, reply) => {
    try {
      const user = await authenticatedUser(request, reply, authService)
      if (!user) return
      const { orderId, attachmentId } = attachmentParams.parse(request.params)
      const attachment = await planningService.downloadAttachment(user, orderId, attachmentId)
      return reply
        .header('content-type', attachment.mediaType)
        .header('content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`)
        .send(attachment.content)
    } catch (error) {
      return sendPlanningError(reply, error)
    }
  })
}
