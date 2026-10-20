import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildApp } from './app.js'
import { AuthError } from './auth-service.js'
import type { AuthService } from './auth-service.js'

const apps: ReturnType<typeof buildApp>[] = []

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()))
})

function createAuthService(): AuthService {
  return {
    register: vi.fn(async (input) => ({
      id: 'user-1',
      email: input.email,
      displayName: input.fullName,
      status: 'PENDING' as const,
    })),
    login: vi.fn(async (input) => ({
      user: {
        id: 'user-1',
        email: input.email,
        displayName: 'Asha Menon',
        status: 'ACTIVE' as const,
      },
      sessionToken: 'opaque-session-token',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    })),
    getSession: vi.fn(async () => null),
    logout: vi.fn(async () => undefined),
  }
}

function createAppOptions(authService = createAuthService()) {
  return {
    frontendOrigin: 'http://127.0.0.1:5173',
    secureCookies: false,
    authService,
    databaseCheck: async () => ({
      database: 'neondb',
      serverTime: new Date(),
      schemaReady: true,
      latestMigration: '002_postgresql_auth.sql',
    }),
  }
}

describe('health routes', () => {
  it('reports API process health', async () => {
    const app = buildApp({
      ...createAppOptions(),
      databaseCheck: async () => ({
        database: 'neondb',
        serverTime: new Date(),
        schemaReady: true,
        latestMigration: '001_flowline_foundation.sql',
      }),
    })
    apps.push(app)

    const response = await app.inject({ method: 'GET', url: '/health' })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      status: 'ok',
      service: 'flowline-backend',
    })
  })

  it('reports database readiness', async () => {
    const app = buildApp({
      ...createAppOptions(),
      databaseCheck: async () => ({
        database: 'neondb',
        serverTime: new Date('2026-10-20T00:00:00.000Z'),
        schemaReady: true,
        latestMigration: '001_flowline_foundation.sql',
      }),
    })
    apps.push(app)

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/health/database',
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      status: 'ok',
      database: {
        database: 'neondb',
        schemaReady: true,
        latestMigration: '001_flowline_foundation.sql',
      },
    })
  })

  it('does not expose connection failures', async () => {
    const app = buildApp({
      ...createAppOptions(),
      databaseCheck: async () => {
        throw new Error('postgresql://secret@host/database')
      },
    })
    apps.push(app)

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/health/database',
    })

    expect(response.statusCode).toBe(503)
    expect(response.body).not.toContain('postgresql://')
  })
})

describe('authentication routes', () => {
  it('registers an account without accepting role assignment', async () => {
    const authService = createAuthService()
    const app = buildApp(createAppOptions(authService))
    apps.push(app)

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        fullName: 'Asha Menon',
        email: 'asha@example.com',
        password: 'secure-pass',
        role: 'SYSTEM_ADMIN',
      },
    })

    expect(response.statusCode).toBe(201)
    expect(response.json()).toMatchObject({
      user: { email: 'asha@example.com', status: 'PENDING' },
    })
    expect(authService.register).toHaveBeenCalledWith({
      fullName: 'Asha Menon',
      email: 'asha@example.com',
      password: 'secure-pass',
    })
  })

  it('sets an HTTP-only session cookie without returning the token', async () => {
    const app = buildApp(createAppOptions())
    apps.push(app)

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'asha@example.com', password: 'secure-pass' },
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['set-cookie']).toContain('flowline_session=')
    expect(response.headers['set-cookie']).toContain('HttpOnly')
    expect(response.body).not.toContain('opaque-session-token')
  })

  it('rejects invalid request payloads before calling the auth service', async () => {
    const authService = createAuthService()
    const app = buildApp(createAppOptions(authService))
    apps.push(app)

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { fullName: '', email: 'invalid', password: 'short' },
    })

    expect(response.statusCode).toBe(400)
    expect(authService.register).not.toHaveBeenCalled()
  })

  it('returns controlled authentication errors', async () => {
    const authService = createAuthService()
    authService.login = vi.fn(async () => {
      throw new AuthError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.')
    })
    const app = buildApp(createAppOptions(authService))
    apps.push(app)

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'asha@example.com', password: 'wrong-pass' },
    })

    expect(response.statusCode).toBe(401)
    expect(response.json()).toEqual({
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.',
      },
    })
  })
})