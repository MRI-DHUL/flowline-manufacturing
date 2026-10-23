import type { LoginValues, RegisterValues } from './auth-validation'
import { ApiRequestError, requestJson } from '../../shared/api/client'

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
    super('The Flowline API URL is not configured. Add VITE_API_BASE_URL to frontend/.env.')
    this.name = 'AuthServiceNotConfiguredError'
  }
}

function ensureApiConfigured() {
  const url = import.meta.env.VITE_API_BASE_URL?.trim()
  if (!url) throw new AuthServiceNotConfiguredError()
}

async function authRequest<T>(path: string, payload: object): Promise<T> {
  ensureApiConfigured()
  try {
    return await requestJson<T>(path, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  } catch (error) {
    if (error instanceof AuthServiceNotConfiguredError) throw error
    if (error instanceof ApiRequestError) throw new Error(error.message, { cause: error })
    throw new Error('Unable to reach the Flowline API. Check the API URL and network connection.', { cause: error })
  }
}

export async function signIn(values: LoginValues): Promise<AuthResponse> {
  return authRequest<AuthResponse>('/api/v1/auth/login', {
    email: values.email.trim().toLowerCase(),
    password: values.password,
  })
}

export async function registerAccount(values: RegisterValues): Promise<AuthResponse> {
  return authRequest<AuthResponse>('/api/v1/auth/register', {
    fullName: values.fullName.trim(),
    email: values.email.trim().toLowerCase(),
    password: values.password,
  })
}

export async function getCurrentSession(): Promise<AuthUser> {
  ensureApiConfigured()
  return (await requestJson<AuthResponse>('/api/v1/auth/session')).user
}
