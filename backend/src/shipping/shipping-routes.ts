import type { FastifyInstance, FastifyReply } from 'fastify'
import { z } from 'zod'
import { sessionCookieName } from '../auth/auth-routes.js'
import type { AuthService, AuthUser } from '../auth/auth-service.js'
import { ShippingError } from './shipping-service.js'
import type { ShippingService } from './shipping-service.js'

const orderParams = z.object({ orderId: z.uuid() })
const dispatchSchema = z.object({
  carrier: z.string().trim().min(1).max(200),
  trackingOrVehicleNumber: z.string().trim().min(1).max(300),
  dispatchAt: z.iso.datetime(),
  shippedQuantity: z.number().positive(),
  destination: z.string().trim().min(1).max(1000),
  expectedDeliveryAt: z.iso.datetime(),
})
const issueSchema = z.object({
  category: z.string().trim().min(1).max(100),
  notes: z.string().trim().min(10).max(3000),
  managerUserAuthUserId: z.uuid(),
})
const managerHandoffSchema = z.object({ managerUserAuthUserId: z.uuid() })
const deliverySchema = z.object({ actualDeliveryAt: z.iso.datetime(), receivedBy: z.string().trim().min(1).max(300) })

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

function sendShippingError(reply: FastifyReply, error: unknown) {
  if (error instanceof z.ZodError) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Check the shipping details.' } })
  if (error instanceof ShippingError) return reply.code(error.statusCode).send({ error: { code: error.code, message: error.message, fields: error.fields } })
  throw error
}

export function registerShippingRoutes(app: FastifyInstance, authService: AuthService, shippingService: ShippingService) {
  app.get('/api/v1/shipping/orders', async (request, reply) => {
    try {
      const user = await authenticatedUser(request, reply, authService)
      if (!user) return
      return { orders: await shippingService.listQueue(user) }
    } catch (error) {
      return sendShippingError(reply, error)
    }
  })
  app.get('/api/v1/shipping/manager-users', async (request, reply) => {
    try {
      const user = await authenticatedUser(request, reply, authService)
      if (!user) return
      return { users: await shippingService.listManagerUsers(user) }
    } catch (error) {
      return sendShippingError(reply, error)
    }
  })
  app.get('/api/v1/shipping/orders/:orderId', async (request, reply) => {
    try {
      const user = await authenticatedUser(request, reply, authService)
      if (!user) return
      const { orderId } = orderParams.parse(request.params)
      return { order: await shippingService.getOrder(user, orderId) }
    } catch (error) {
      return sendShippingError(reply, error)
    }
  })
  app.post('/api/v1/shipping/orders/:orderId/verify-ready', async (request, reply) => {
    try {
      const user = await authenticatedUser(request, reply, authService)
      if (!user) return
      const { orderId } = orderParams.parse(request.params)
      return { order: await shippingService.verifyReady(user, orderId) }
    } catch (error) {
      return sendShippingError(reply, error)
    }
  })
  app.post('/api/v1/shipping/orders/:orderId/dispatch', async (request, reply) => {
    try {
      const user = await authenticatedUser(request, reply, authService)
      if (!user) return
      const { orderId } = orderParams.parse(request.params)
      return { order: await shippingService.dispatch(user, orderId, dispatchSchema.parse(request.body)) }
    } catch (error) {
      return sendShippingError(reply, error)
    }
  })
  app.post('/api/v1/shipping/orders/:orderId/delivery-issues', async (request, reply) => {
    try {
      const user = await authenticatedUser(request, reply, authService)
      if (!user) return
      const { orderId } = orderParams.parse(request.params)
      return { order: await shippingService.reportDeliveryIssue(user, orderId, issueSchema.parse(request.body)) }
    } catch (error) {
      return sendShippingError(reply, error)
    }
  })
  app.post('/api/v1/shipping/orders/:orderId/manager-handoff', async (request, reply) => {
    try {
      const user = await authenticatedUser(request, reply, authService)
      if (!user) return
      const { orderId } = orderParams.parse(request.params)
      return { order: await shippingService.handoffToManager(user, orderId, managerHandoffSchema.parse(request.body)) }
    } catch (error) {
      return sendShippingError(reply, error)
    }
  })
  app.post('/api/v1/shipping/orders/:orderId/proof', async (request, reply) => {
    try {
      const user = await authenticatedUser(request, reply, authService)
      if (!user) return
      const { orderId } = orderParams.parse(request.params)
      const file = await request.file({ limits: { files: 1, fileSize: 5 * 1024 * 1024 } })
      if (!file) throw new ShippingError(400, 'FILE_REQUIRED', 'Choose proof of delivery to upload.')
      const content = await file.toBuffer()
      return {
        order: await shippingService.uploadProof(user, orderId, {
          fileName: file.filename,
          mediaType: file.mimetype || 'application/octet-stream',
          content,
        }),
      }
    } catch (error) {
      if ((error as { code?: string }).code === 'FST_REQ_FILE_TOO_LARGE') return reply.code(413).send({ error: { code: 'FILE_TOO_LARGE', message: 'Files must be 5 MB or smaller.' } })
      return sendShippingError(reply, error)
    }
  })
  app.post('/api/v1/shipping/orders/:orderId/confirm-delivery', async (request, reply) => {
    try {
      const user = await authenticatedUser(request, reply, authService)
      if (!user) return
      const { orderId } = orderParams.parse(request.params)
      return { order: await shippingService.confirmDelivery(user, orderId, deliverySchema.parse(request.body)) }
    } catch (error) {
      return sendShippingError(reply, error)
    }
  })
}
