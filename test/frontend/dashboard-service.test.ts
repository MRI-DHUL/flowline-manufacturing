import { afterEach, describe, expect, it, vi } from 'vitest'
import { DashboardRequestError, getDashboard } from '../../frontend/src/features/dashboard/dashboard-service'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('dashboard service', () => {
  it('requests the protected dashboard with credentials', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example/')
    const responseBody = {
      user: {
        id: 'user-1',
        email: 'asha@example.com',
        displayName: 'Asha Menon',
        status: 'ACTIVE',
        roles: ['CSR'],
      },
      role: 'CSR',
      metrics: { active: 0, attention: 0, aging: 0, completed: 0 },
      orders: [],
    }
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(responseBody), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(getDashboard()).resolves.toEqual(responseBody)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example/api/v1/dashboard',
      { credentials: 'include' },
    )
  })

  it('preserves controlled access-pending errors', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: 'ACCESS_PENDING',
              message: 'Awaiting role assignment.',
            },
          }),
          { status: 403, headers: { 'content-type': 'application/json' } },
        ),
      ),
    )

    await expect(getDashboard()).rejects.toEqual(
      expect.objectContaining<Partial<DashboardRequestError>>({
        status: 403,
        code: 'ACCESS_PENDING',
        message: 'Awaiting role assignment.',
      }),
    )
  })
})