import { afterEach, describe, expect, it, vi } from 'vitest'
import { registerAccount, signIn } from '../../frontend/src/features/auth/auth-service'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('Flowline authentication service', () => {
  it('sends normalized login credentials to the configured API', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example/')
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ user: { id: 'user-1' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await signIn({ email: ' ASHA@EXAMPLE.COM ', password: 'secure-pass' })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example/api/v1/auth/login',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({
          email: 'asha@example.com',
          password: 'secure-pass',
        }),
      }),
    )
  })

  it('sends registration without role assignment fields', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example')
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ user: { id: 'user-2' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await registerAccount({
      fullName: ' Asha Menon ',
      email: 'ASHA@EXAMPLE.COM',
      password: 'secure-pass',
      confirmPassword: 'secure-pass',
    })

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit
    expect(JSON.parse(String(request.body))).toEqual({
      fullName: 'Asha Menon',
      email: 'asha@example.com',
      password: 'secure-pass',
    })
  })
})
