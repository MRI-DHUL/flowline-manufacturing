import { describe, expect, it, vi } from 'vitest'
import { buildApp } from '../../backend/src/app.js'
import { apps, adminOrder, createAdminService, createAppOptions, createAuthService } from './app-test-fixtures.js'

describe('Admin order monitor route', () => {
  it('requires an authenticated session', async () => {
    const app = buildApp(createAppOptions())
    apps.push(app)

    const response = await app.inject({ method: 'GET', url: '/api/v1/admin/orders' })

    expect(response.statusCode).toBe(401)
  })

  it('returns read-only order records to an authenticated administrator', async () => {
    const authService = createAuthService()
    authService.getSession = vi.fn(async () => ({
      id: 'admin-user-1',
      email: 'admin@flowline.com',
      displayName: 'System Administrator',
      status: 'ACTIVE' as const,
      roles: ['SYSTEM_ADMIN'],
    }))
    const adminService = createAdminService()
    const app = buildApp({ ...createAppOptions(authService), adminService })
    apps.push(app)

    const response = await app.inject({ method: 'GET', url: '/api/v1/admin/orders', cookies: { flowline_session: 'opaque-token' } })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ orders: [adminOrder] })
    expect(adminService.listOrders).toHaveBeenCalledWith(expect.objectContaining({ roles: ['SYSTEM_ADMIN'] }))
  })

  it('does not create a mutation endpoint for monitored orders', async () => {
    const app = buildApp(createAppOptions())
    apps.push(app)

    const response = await app.inject({ method: 'PATCH', url: '/api/v1/admin/orders/99999999-9999-4999-8999-999999999999', cookies: { flowline_session: 'opaque-token' } })

    expect(response.statusCode).toBe(404)
  })
})