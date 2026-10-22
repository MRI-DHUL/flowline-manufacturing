import { describe, expect, it } from 'vitest'
import { validateLogin, validateRegistration } from '../../frontend/src/features/auth/auth-validation'

describe('validateLogin', () => {
  it('requires a valid work email and password', () => {
    expect(validateLogin({ email: 'invalid', password: '' })).toEqual({
      email: 'Enter a valid email address.',
      password: 'Enter your password.',
    })
  })

  it('accepts complete login values', () => {
    expect(
      validateLogin({ email: 'asha@flowline.example', password: 'secret' }),
    ).toEqual({})
  })
})

describe('validateRegistration', () => {
  it('requires identity and matching password fields', () => {
    expect(
      validateRegistration({
        fullName: '',
        email: '',
        password: 'short',
        confirmPassword: 'different',
      }),
    ).toEqual({
      fullName: 'Enter your full name.',
      email: 'Enter your work email.',
      password: 'Use at least 8 characters.',
      confirmPassword: 'Passwords do not match.',
    })
  })

  it('accepts complete registration values', () => {
    expect(
      validateRegistration({
        fullName: 'Asha Menon',
        email: 'asha@flowline.example',
        password: 'secure-pass',
        confirmPassword: 'secure-pass',
      }),
    ).toEqual({})
  })
})