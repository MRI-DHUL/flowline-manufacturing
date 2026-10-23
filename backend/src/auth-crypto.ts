import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import argon2 from 'argon2'

const passwordHashOptions = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const

export function hashPassword(password: string) {
  return argon2.hash(password, passwordHashOptions)
}

export function verifyPassword(passwordHash: string, password: string) {
  return argon2.verify(passwordHash, password)
}

export function createSessionToken() {
  return randomBytes(32).toString('base64url')
}

export function hashSessionToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

type JwtClaims = { sub: string; sid: string; iat: number; exp: number; typ: 'session' }

function encode(value: object | string) {
  return Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url')
}

export function createSessionJwt(claims: JwtClaims, secret: string) {
  const header = encode({ alg: 'HS256', typ: 'JWT' })
  const payload = encode(claims)
  const signature = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url')
  return `${header}.${payload}.${signature}`
}

export function verifySessionJwt(token: string, secret: string) {
  const parts = token.split('.')
  if (parts.length !== 3) return false
  const [header, payload, signature] = parts
  if (!header || !payload || !signature) return false
  const expected = createHmac('sha256', secret).update(`${header}.${payload}`).digest()
  const actual = Buffer.from(signature, 'base64url')
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return false
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString()) as Partial<JwtClaims>
    return claims.typ === 'session' && typeof claims.exp === 'number' && claims.exp > Math.floor(Date.now() / 1000)
  } catch { return false }
}
