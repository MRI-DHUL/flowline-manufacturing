import { describe, expect, it } from 'vitest'
import { createSessionJwt, createSessionToken, hashPassword, hashSessionToken, verifyPassword, verifySessionJwt } from '../../backend/src/auth-crypto.js'

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

  it('supports signing-key rotation without accepting tampered tokens', () => {
    const claims = { sub: 'user-1', sid: 'session-1', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 300, typ: 'session' as const }
    const token = createSessionJwt(claims, 'current-secret-that-is-at-least-32-characters')

    expect(verifySessionJwt(token, 'current-secret-that-is-at-least-32-characters')).toBe(true)
    expect(verifySessionJwt(token, 'previous-secret-that-is-at-least-32-characters')).toBe(false)
    expect(verifySessionJwt(token, 'current-secret-that-is-at-least-32-characters,previous-secret-that-is-at-least-32-characters')).toBe(false)
    expect(verifySessionJwt(`${token}tampered`, 'current-secret-that-is-at-least-32-characters')).toBe(false)
  })
})
