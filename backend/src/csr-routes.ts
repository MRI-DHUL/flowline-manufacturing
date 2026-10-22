import type { FastifyInstance, FastifyReply } from 'fastify'
import { z } from 'zod'
import { sessionCookieName } from './auth-routes.js'
import type { AuthService, AuthUser } from './auth-service.js'
import { CsrError } from './csr-service.js'
import type { CsrService, OrderPatch } from './csr-service.js'

const orderPatchSchema = z.object({
  customerName: z.string().max(160).nullable().optional(),
  destination: z.string().max(240).nullable().optional(),
  productName: z.string().max(180).nullable().optional(),
  productDescription: z.string().max(2000).nullable().optional(),
  orderType: z.string().max(100).nullable().optional(),
  packagingType: z.string().max(120).nullable().optional(),
  dimensions: z.string().max(160).nullable().optional(),
  material: z.string().max(240).nullable().optional(),
  printColors: z.string().max(120).nullable().optional(),
  requestedQuantity: z.number().positive().max(999_999_999).nullable().optional(),
  requestedDeliveryDate: z.preprocess(
    (value) => value === '' ? null : value,
    z.iso.date().nullable().optional(),
  ),
  technicalNotes: z.string().max(5000).nullable().optional(),
  priority: z.enum(['Normal', 'High']).nullable().optional(),
})

const orderParams = z.object({ orderId: z.uuid() })
const attachmentParams = orderParams.extend({ attachmentId: z.uuid() })
const clarificationParams = orderParams.extend({ clarificationId: z.uuid() })
const listQuery = z.object({
  search: z.string().max(160).optional(),
  status: z.string().max(80).optional(),
})
const clarificationResponse = z.object({ response: z.string().trim().min(1).max(5000) })
const reviewerAssignment = z.object({ reviewerAuthUserId: z.uuid() })

function sendCsrError(reply: FastifyReply, error: unknown) {
  if (error instanceof z.ZodError) {
    return reply.code(400).send({
      error: { code: 'VALIDATION_ERROR', message: 'Check the submitted order details.' },
    })
  }
  if (error instanceof CsrError) {
    return reply.code(error.statusCode).send({
      error: { code: error.code, message: error.message, fields: error.fields },
    })
  }
  throw error
}

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

export function registerCsrRoutes(
  app: FastifyInstance,
  authService: AuthService,
  csrService: CsrService,
) {
  app.get('/api/v1/csr/order-status', async (request, reply) => {
    try {
      const user = await authenticatedUser(request, reply, authService)
      if (!user) return
      return { statuses: await csrService.listOrderStatuses(user) }
    } catch (error) {
      return sendCsrError(reply, error)
    }
  })

  app.get('/api/v1/reviewers/rd', async (request, reply) => {
    try {
      const user = await authenticatedUser(request, reply, authService)
      if (!user) return
      return { reviewers: await csrService.listRdReviewers(user) }
    } catch (error) {
      return sendCsrError(reply, error)
    }
  })

  app.get('/api/v1/orders', async (request, reply) => {
    try {
      const user = await authenticatedUser(request, reply, authService)
      if (!user) return
      return { orders: await csrService.listOrders(user, listQuery.parse(request.query)) }
    } catch (error) {
      return sendCsrError(reply, error)
    }
  })

  app.post('/api/v1/orders', async (request, reply) => {
    try {
      const user = await authenticatedUser(request, reply, authService)
      if (!user) return
      const order = await csrService.createDraft(user, orderPatchSchema.parse(request.body) as OrderPatch)
      return reply.code(201).send({ order })
    } catch (error) {
      return sendCsrError(reply, error)
    }
  })

  app.get('/api/v1/orders/:orderId', async (request, reply) => {
    try {
      const user = await authenticatedUser(request, reply, authService)
      if (!user) return
      const { orderId } = orderParams.parse(request.params)
      return { order: await csrService.getOrder(user, orderId) }
    } catch (error) {
      return sendCsrError(reply, error)
    }
  })

  app.patch('/api/v1/orders/:orderId', async (request, reply) => {
    try {
      const user = await authenticatedUser(request, reply, authService)
      if (!user) return
      const { orderId } = orderParams.parse(request.params)
      const order = await csrService.updateDraft(user, orderId, orderPatchSchema.parse(request.body) as OrderPatch)
      return { order }
    } catch (error) {
      return sendCsrError(reply, error)
    }
  })

  app.post('/api/v1/orders/:orderId/submit', async (request, reply) => {
    try {
      const user = await authenticatedUser(request, reply, authService)
      if (!user) return
      const { orderId } = orderParams.parse(request.params)
      return { order: await csrService.submitOrder(user, orderId) }
    } catch (error) {
      return sendCsrError(reply, error)
    }
  })

  app.post('/api/v1/orders/:orderId/assign-rd', async (request, reply) => {
    try {
      const user = await authenticatedUser(request, reply, authService)
      if (!user) return
      const { orderId } = orderParams.parse(request.params)
      const { reviewerAuthUserId } = reviewerAssignment.parse(request.body)
      return { order: await csrService.assignRdReviewer(user, orderId, reviewerAuthUserId) }
    } catch (error) {
      return sendCsrError(reply, error)
    }
  })

  app.post('/api/v1/orders/:orderId/attachments', async (request, reply) => {
    try {
      const user = await authenticatedUser(request, reply, authService)
      if (!user) return
      const { orderId } = orderParams.parse(request.params)
      const file = await request.file({ limits: { files: 1, fileSize: 5 * 1024 * 1024 } })
      if (!file) throw new CsrError(400, 'FILE_REQUIRED', 'Choose a file to upload.')
      const content = await file.toBuffer()
      if (!content.length) throw new CsrError(400, 'FILE_EMPTY', 'The selected file is empty.')
      return {
        order: await csrService.uploadAttachment(user, orderId, {
          fileName: file.filename,
          mediaType: file.mimetype || 'application/octet-stream',
          content,
        }),
      }
    } catch (error) {
      if ((error as { code?: string }).code === 'FST_REQ_FILE_TOO_LARGE') {
        return reply.code(413).send({
          error: { code: 'FILE_TOO_LARGE', message: 'Files must be 5 MB or smaller.' },
        })
      }
      return sendCsrError(reply, error)
    }
  })

  app.get('/api/v1/orders/:orderId/attachments/:attachmentId', async (request, reply) => {
    try {
      const user = await authenticatedUser(request, reply, authService)
      if (!user) return
      const { orderId, attachmentId } = attachmentParams.parse(request.params)
      const attachment = await csrService.downloadAttachment(user, orderId, attachmentId)
      return reply
        .header('content-type', attachment.mediaType)
        .header('content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`)
        .send(attachment.content)
    } catch (error) {
      return sendCsrError(reply, error)
    }
  })

  app.delete('/api/v1/orders/:orderId/attachments/:attachmentId', async (request, reply) => {
    try {
      const user = await authenticatedUser(request, reply, authService)
      if (!user) return
      const { orderId, attachmentId } = attachmentParams.parse(request.params)
      return { order: await csrService.deleteAttachment(user, orderId, attachmentId) }
    } catch (error) {
      return sendCsrError(reply, error)
    }
  })

  app.post('/api/v1/orders/:orderId/clarifications/:clarificationId/respond', async (request, reply) => {
    try {
      const user = await authenticatedUser(request, reply, authService)
      if (!user) return
      const { orderId, clarificationId } = clarificationParams.parse(request.params)
      const { response } = clarificationResponse.parse(request.body)
      return { order: await csrService.respondToClarification(user, orderId, clarificationId, response) }
    } catch (error) {
      return sendCsrError(reply, error)
    }
  })
}