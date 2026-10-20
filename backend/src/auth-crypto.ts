import { createHash, randomBytes } from 'node:crypto'
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