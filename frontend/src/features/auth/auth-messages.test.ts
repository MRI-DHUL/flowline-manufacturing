import { describe, expect, it } from 'vitest'
import { getLoginSuccessMessage } from './auth-messages'

describe('getLoginSuccessMessage', () => {
  it('does not promise workspace access to a pending account', () => {
    expect(getLoginSuccessMessage('PENDING')).toBe(
      'Signed in. Your account is awaiting administrator role assignment.',
    )
  })

  it('confirms workspace readiness for an active account', () => {
    expect(getLoginSuccessMessage('ACTIVE')).toBe(
      'Signed in successfully. Your role workspace is ready to load.',
    )
  })
})