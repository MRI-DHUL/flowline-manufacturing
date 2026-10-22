import type { LoginValues, RegisterValues } from './auth-validation'

type AuthErrorPayload = {
  error?: {
    message?: string
  }
  message?: string
}

export type AuthUser = {
  id: string
  email: string
  displayName: string
  status: 'PENDING' | 'ACTIVE' | 'DISABLED'
  roles: string[]
}

type AuthResponse = {
  user: AuthUser
}

export class AuthServiceNotConfiguredError extends Error {
  constructor() {
    super(
      'The Flowline API URL is not configured. Add VITE_API_BASE_URL to frontend/.env.',
    )
    this.name = 'AuthServiceNotConfiguredError'
  }
}

function getApiBaseUrl() {
  const url = import.meta.env.VITE_API_BASE_URL?.trim()
  if (!url) throw new AuthServiceNotConfiguredError()
  return url.replace(/\/$/, '')
}

async function authRequest<T>(path: string, payload: object): Promise<T> {
  let response: Response

  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch (error) {
    if (error instanceof AuthServiceNotConfiguredError) throw error
    throw new Error(
      'Unable to reach the Flowline API. Check the API URL and network connection.',
      { cause: error },
    )
  }

  const body = (await response.json().catch(() => ({}))) as AuthErrorPayload
  if (!response.ok || body.error) {
    throw new Error(
      body.error?.message ?? body.message ?? 'Authentication request failed.',
    )
  }

  return body as T
}

export async function signIn(values: LoginValues): Promise<AuthResponse> {
  return authRequest<AuthResponse>('/api/v1/auth/login', {
    email: values.email.trim().toLowerCase(),
    password: values.password,
  })
}

export async function registerAccount(
  values: RegisterValues,
): Promise<AuthResponse> {
  return authRequest<AuthResponse>('/api/v1/auth/register', {
    fullName: values.fullName.trim(),
    email: values.email.trim().toLowerCase(),
    password: values.password,
  })
}