import type { FastifyInstance, FastifyReply } from 'fastify'
import { z } from 'zod'
import { sessionCookieName } from './auth-routes.js'
import type { AuthService, AuthUser } from './auth-service.js'
import { ManagerError } from './manager-service.js'
import type { ManagerService } from './manager-service.js'

const params = z.object({ orderId: z.uuid() })
const delivery = z.object({ actualDeliveryAt: z.iso.datetime(), receivedBy: z.string().trim().min(1).max(300) })
async function user(
  request: { cookies: Record<string, string | undefined> },
  reply: FastifyReply,
  auth: AuthService,
): Promise<AuthUser | null> {
  const token = request.cookies[sessionCookieName]
  if (!token) {
    reply.code(401).send({ error: { code: 'UNAUTHENTICATED', message: 'Authentication required.' } })
    return null
  }
  const current = await auth.getSession(token)
  if (!current) {
    reply.code(401).send({ error: { code: 'UNAUTHENTICATED', message: 'Authentication required.' } })
    return null
  }
  return current
}
function send(reply: FastifyReply, error: unknown) {
  if (error instanceof z.ZodError)
    return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Check the delivery details.' } })
  if (error instanceof ManagerError)
    return reply.code(error.statusCode).send({ error: { code: error.code, message: error.message, fields: error.fields } })
  throw error
}
export function registerManagerRoutes(app: FastifyInstance, auth: AuthService, service: ManagerService) {
  app.get('/api/v1/manager/orders', async (request, reply) => {
    try {
      const current = await user(request, reply, auth)
      if (!current) return
      return { orders: await service.listQueue(current) }
    } catch (error) {
      return send(reply, error)
    }
  })
  app.get('/api/v1/manager/orders/:orderId', async (request, reply) => {
    try {
      const current = await user(request, reply, auth)
      if (!current) return
      return { order: await service.getOrder(current, params.parse(request.params).orderId) }
    } catch (error) {
      return send(reply, error)
    }
  })
  app.post('/api/v1/manager/orders/:orderId/proof', async (request, reply) => {
    try {
      const current = await user(request, reply, auth)
      if (!current) return
      const file = await request.file()
      if (!file) throw new ManagerError(400, 'FILE_REQUIRED', 'Choose proof of delivery.')
      return {
        order: await service.uploadProof(current, params.parse(request.params).orderId, {
          fileName: file.filename,
          mediaType: file.mimetype,
          content: await file.toBuffer(),
        }),
      }
    } catch (error) {
      return send(reply, error)
    }
  })
  app.post('/api/v1/manager/orders/:orderId/confirm-delivery', async (request, reply) => {
    try {
      const current = await user(request, reply, auth)
      if (!current) return
      return { order: await service.confirmDelivery(current, params.parse(request.params).orderId, delivery.parse(request.body)) }
    } catch (error) {
      return send(reply, error)
    }
  })
}
