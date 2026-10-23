import type { FastifyInstance, FastifyReply } from 'fastify'
import { z } from 'zod'
import { sessionCookieName } from '../auth/auth-routes.js'
import type { AuthService } from '../auth/auth-service.js'
import { NotificationError } from './notification-service.js'
import type { NotificationService } from './notification-service.js'
import type { NotificationHub } from './notification-service.js'

const notificationParams = z.object({ notificationId: z.uuid() })

async function authenticatedUser(request: { cookies: Record<string, string | undefined> }, reply: FastifyReply, authService: AuthService) {
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

function sendNotificationError(reply: FastifyReply, error: unknown) {
  if (error instanceof z.ZodError) {
    return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Invalid notification request.' } })
  }
  if (error instanceof NotificationError) {
    return reply.code(error.statusCode).send({ error: { code: error.code, message: error.message } })
  }
  throw error
}

export function registerNotificationRoutes(app: FastifyInstance, authService: AuthService, notificationService: NotificationService, notificationHub: NotificationHub) {
  app.get('/api/v1/notifications/live', { websocket: true }, async (socket, request) => {
    const token = request.cookies[sessionCookieName]
    const user = token ? await authService.getSession(token) : null
    if (!user || user.status !== 'ACTIVE') {
      socket.close(1008, 'Authentication required.')
      return
    }
    const unsubscribe = notificationHub.subscribe(user.id, socket)
    socket.send(JSON.stringify({ type: 'ready' }))
    socket.on('close', unsubscribe)
    socket.on('error', unsubscribe)
  })

  app.get('/api/v1/notifications', async (request, reply) => {
    try {
      const user = await authenticatedUser(request, reply, authService)
      if (!user) return
      return { notifications: await notificationService.listForUser(user) }
    } catch (error) {
      return sendNotificationError(reply, error)
    }
  })

  app.post('/api/v1/notifications/:notificationId/read', async (request, reply) => {
    try {
      const user = await authenticatedUser(request, reply, authService)
      if (!user) return
      const { notificationId } = notificationParams.parse(request.params)
      await notificationService.markRead(user, notificationId)
      return { ok: true }
    } catch (error) {
      return sendNotificationError(reply, error)
    }
  })

  app.delete('/api/v1/notifications/:notificationId', async (request, reply) => {
    try {
      const user = await authenticatedUser(request, reply, authService)
      if (!user) return
      const { notificationId } = notificationParams.parse(request.params)
      await notificationService.deleteForUser(user, notificationId)
      return { ok: true }
    } catch (error) {
      return sendNotificationError(reply, error)
    }
  })
}
