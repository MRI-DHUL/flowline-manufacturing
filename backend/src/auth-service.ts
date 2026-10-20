import { randomUUID } from 'node:crypto'
import type pg from 'pg'
import {
  createSessionToken,
  hashPassword,
  hashSessionToken,
  verifyPassword,
} from './auth-crypto.js'

const sessionDurationMs = 8 * 60 * 60 * 1000
const maximumFailedAttempts = 5
const lockDurationMinutes = 15

export type AuthUser = {
  id: string
  email: string
  displayName: string
  status: 'PENDING' | 'ACTIVE' | 'DISABLED'
}

export type LoginResult = {
  user: AuthUser
  sessionToken: string
  expiresAt: Date
}

export interface AuthService {
  register(input: {
    fullName: string
    email: string
    password: string
  }): Promise<AuthUser>
  login(input: { email: string; password: string }): Promise<LoginResult>
  getSession(token: string): Promise<AuthUser | null>
  logout(token: string): Promise<void>
}

export class AuthError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'AuthError'
  }
}

type AccountRow = {
  id: string
  auth_user_id: string
  email: string
  display_name: string
  status: AuthUser['status']
  password_hash: string
  failed_attempts: number
  locked_until: Date | null
}

const dummyHash = hashPassword(randomUUID())

function toUser(row: Pick<AccountRow, 'auth_user_id' | 'email' | 'display_name' | 'status'>): AuthUser {
  return {
    id: row.auth_user_id,
    email: row.email,
    displayName: row.display_name,
    status: row.status,
  }
}

export class PostgresAuthService implements AuthService {
  constructor(private readonly pool: pg.Pool) {}

  async register(input: {
    fullName: string
    email: string
    password: string
  }): Promise<AuthUser> {
    const email = input.email.trim().toLowerCase()
    const fullName = input.fullName.trim()
    const passwordHash = await hashPassword(input.password)
    const identityId = randomUUID()
    const client = await this.pool.connect()

    try {
      await client.query('BEGIN')
      const profileResult = await client.query<AccountRow>(
        `
          INSERT INTO flowline.user_profiles (
            auth_user_id,
            email,
            display_name,
            status
          )
          VALUES ($1, $2, $3, 'PENDING')
          RETURNING id, auth_user_id, email, display_name, status
        `,
        [identityId, email, fullName],
      )
      const profile = profileResult.rows[0]
      if (!profile) throw new Error('Profile creation returned no row')

      await client.query(
        `
          INSERT INTO flowline.auth_accounts (user_profile_id, password_hash)
          VALUES ($1, $2)
        `,
        [profile.id, passwordHash],
      )
      await client.query('COMMIT')
      return toUser(profile)
    } catch (error) {
      await client.query('ROLLBACK')
      if ((error as { code?: string }).code === '23505') {
        throw new AuthError(
          409,
          'ACCOUNT_EXISTS',
          'An account already exists for this email address.',
        )
      }
      throw error
    } finally {
      client.release()
    }
  }

  async login(input: { email: string; password: string }): Promise<LoginResult> {
    const email = input.email.trim().toLowerCase()
    const result = await this.pool.query<AccountRow>(
      `
        SELECT
          profile.id,
          profile.auth_user_id,
          profile.email,
          profile.display_name,
          profile.status,
          account.password_hash,
          account.failed_attempts,
          account.locked_until
        FROM flowline.user_profiles AS profile
        JOIN flowline.auth_accounts AS account
          ON account.user_profile_id = profile.id
        WHERE profile.email = $1
      `,
      [email],
    )
    const account = result.rows[0]

    if (!account) {
      await verifyPassword(await dummyHash, input.password)
      throw new AuthError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.')
    }

    if (account.status === 'DISABLED') {
      throw new AuthError(403, 'ACCOUNT_DISABLED', 'This account is disabled.')
    }

    if (account.locked_until && account.locked_until > new Date()) {
      throw new AuthError(
        429,
        'ACCOUNT_LOCKED',
        'Too many failed attempts. Try again later.',
      )
    }

    const validPassword = await verifyPassword(account.password_hash, input.password)
    if (!validPassword) {
      await this.pool.query(
        `
          UPDATE flowline.auth_accounts
          SET
            failed_attempts = failed_attempts + 1,
            locked_until = CASE
              WHEN failed_attempts + 1 >= $2
                THEN clock_timestamp() + ($3 * interval '1 minute')
              ELSE NULL
            END
          WHERE user_profile_id = $1
        `,
        [account.id, maximumFailedAttempts, lockDurationMinutes],
      )
      throw new AuthError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.')
    }

    const sessionToken = createSessionToken()
    const expiresAt = new Date(Date.now() + sessionDurationMs)
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(
        `
          UPDATE flowline.auth_accounts
          SET failed_attempts = 0, locked_until = NULL
          WHERE user_profile_id = $1
        `,
        [account.id],
      )
      await client.query(
        `
          INSERT INTO flowline.auth_sessions (
            user_profile_id,
            token_hash,
            expires_at
          )
          VALUES ($1, $2, $3)
        `,
        [account.id, hashSessionToken(sessionToken), expiresAt],
      )
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }

    return { user: toUser(account), sessionToken, expiresAt }
  }

  async getSession(token: string): Promise<AuthUser | null> {
    const result = await this.pool.query<AccountRow>(
      `
        UPDATE flowline.auth_sessions AS session
        SET last_seen_at = clock_timestamp()
        FROM flowline.user_profiles AS profile
        WHERE session.token_hash = $1
          AND session.user_profile_id = profile.id
          AND session.revoked_at IS NULL
          AND session.expires_at > clock_timestamp()
          AND profile.status <> 'DISABLED'
        RETURNING
          profile.auth_user_id,
          profile.email,
          profile.display_name,
          profile.status
      `,
      [hashSessionToken(token)],
    )
    const profile = result.rows[0]
    return profile ? toUser(profile) : null
  }

  async logout(token: string): Promise<void> {
    await this.pool.query(
      `
        UPDATE flowline.auth_sessions
        SET revoked_at = clock_timestamp()
        WHERE token_hash = $1 AND revoked_at IS NULL
      `,
      [hashSessionToken(token)],
    )
  }
}