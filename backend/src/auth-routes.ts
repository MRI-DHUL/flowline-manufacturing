import type { FastifyInstance, FastifyReply } from 'fastify'
import { z } from 'zod'
import { AuthError } from './auth-service.js'
import type { AuthService } from './auth-service.js'

export const sessionCookieName = 'flowline_session'

const registerSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  email: z
    .email()
    .max(254)
    .refine((value) => value.toLowerCase().endsWith('@flowline.com'), 'Use your @flowline.com work email.'),
  password: z.string().min(8).max(128),
})

const loginSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(128),
})

function sendAuthError(reply: FastifyReply, error: unknown) {
  if (error instanceof z.ZodError) {
    return reply.code(400).send({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Check the submitted account details.',
      },
    })
  }

  if (error instanceof AuthError) {
    return reply.code(error.statusCode).send({
      error: { code: error.code, message: error.message },
    })
  }

  throw error
}

export function registerAuthRoutes(app: FastifyInstance, authService: AuthService, secureCookies: boolean) {
  app.post('/api/v1/auth/register', async (request, reply) => {
    try {
      const input = registerSchema.parse(request.body)
      const user = await authService.register(input)
      return reply.code(201).send({ user })
    } catch (error) {
      return sendAuthError(reply, error)
    }
  })

  app.post('/api/v1/auth/login', async (request, reply) => {
    try {
      const input = loginSchema.parse(request.body)
      const result = await authService.login(input)
      const maxAge = Math.max(0, Math.floor((result.expiresAt.getTime() - Date.now()) / 1000))
      reply.setCookie(sessionCookieName, result.sessionToken, {
        httpOnly: true,
        sameSite: 'lax',
        secure: secureCookies,
        path: '/',
        maxAge,
      })
      return { user: result.user }
    } catch (error) {
      return sendAuthError(reply, error)
    }
  })

  app.get('/api/v1/auth/session', async (request, reply) => {
    const token = request.cookies[sessionCookieName]
    if (!token) {
      return reply.code(401).send({
        error: { code: 'UNAUTHENTICATED', message: 'Authentication required.' },
      })
    }

    const user = await authService.getSession(token)
    if (!user) {
      reply.clearCookie(sessionCookieName, { path: '/' })
      return reply.code(401).send({
        error: { code: 'UNAUTHENTICATED', message: 'Authentication required.' },
      })
    }
    return { user }
  })

  app.post('/api/v1/auth/logout', async (request, reply) => {
    const token = request.cookies[sessionCookieName]
    if (token) await authService.logout(token)
    reply.clearCookie(sessionCookieName, { path: '/' })
    return reply.code(204).send()
  })
}
