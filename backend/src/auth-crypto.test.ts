import { describe, expect, it } from 'vitest'
import {
  createSessionToken,
  hashPassword,
  hashSessionToken,
  verifyPassword,
} from './auth-crypto.js'

describe('auth crypto', () => {
  it('hashes passwords with Argon2id and verifies only the correct value', async () => {
    const hash = await hashPassword('secure-pass')

    expect(hash).toMatch(/^\$argon2id\$/)
    await expect(verifyPassword(hash, 'secure-pass')).resolves.toBe(true)
    await expect(verifyPassword(hash, 'wrong-pass')).resolves.toBe(false)
  })

  it('creates opaque session tokens and stable SHA-256 storage hashes', () => {
    const token = createSessionToken()

    expect(token.length).toBeGreaterThanOrEqual(43)
    expect(hashSessionToken(token)).toMatch(/^[a-f0-9]{64}$/)
    expect(hashSessionToken(token)).toBe(hashSessionToken(token))
    expect(hashSessionToken(token)).not.toContain(token)
  })
})