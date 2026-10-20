import type { AuthUser } from './auth-service'

export function getLoginSuccessMessage(status: AuthUser['status']) {
  if (status === 'PENDING') {
    return 'Signed in. Your account is awaiting administrator role assignment.'
  }

  return 'Signed in successfully. Your role workspace is ready to load.'
}