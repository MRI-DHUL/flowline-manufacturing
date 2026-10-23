import { randomUUID } from 'node:crypto'
import type pg from 'pg'
import { createSessionJwt, hashPassword, hashSessionToken, verifyPassword, verifySessionJwt } from '../auth-crypto.js'
import type { NotificationItem, NotificationPublisher } from '../notifications/notification-service.js'

const sessionDurationMs = 8 * 60 * 60 * 1000
const maximumFailedAttempts = 5
const lockDurationMinutes = 15

export type AuthUser = {
  id: string
  email: string
  displayName: string
  status: 'PENDING' | 'ACTIVE' | 'DISABLED'
  roles: string[]
}

export type LoginResult = {
  user: AuthUser
  sessionToken: string
  expiresAt: Date
}

export interface AuthService {
  register(input: { fullName: string; email: string; password: string }): Promise<AuthUser>
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
  roles: string[]
}

const dummyHash = hashPassword(randomUUID())

function toUser(row: Pick<AccountRow, 'auth_user_id' | 'email' | 'display_name' | 'status' | 'roles'>): AuthUser {
  return {
    id: row.auth_user_id,
    email: row.email,
    displayName: row.display_name,
    status: row.status,
    roles: row.roles,
  }
}

export class PostgresAuthService implements AuthService {
  constructor(private readonly pool: pg.Pool, private readonly jwtSecrets: string[], private readonly notificationPublisher?: NotificationPublisher) {}

  async register(input: { fullName: string; email: string; password: string }): Promise<AuthUser> {
    const email = input.email.trim().toLowerCase()
    if (!email.endsWith('@flowline.com')) {
      throw new AuthError(422, 'WORK_EMAIL_REQUIRED', 'Use your @flowline.com work email.')
    }
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
      const admins = await this.pool.query<{ auth_user_id: string }>(
        `SELECT profile.auth_user_id
         FROM flowline.user_profiles profile
         JOIN flowline.user_roles user_role ON user_role.user_profile_id = profile.id
         JOIN flowline.roles role ON role.id = user_role.role_id
         WHERE profile.status = 'ACTIVE' AND role.code = 'SYSTEM_ADMIN'`,
      )
      const registrationNotification: NotificationItem = {
        id: identityId,
        orderId: null,
        orderNumber: null,
        type: 'ACCOUNT_REGISTERED',
        title: 'New Flowline account registration',
        message: `${fullName} registered with ${email}. Administrator activation and role assignment are required.`,
        createdAt: new Date(),
        readAt: null,
      }
      this.notificationPublisher?.publish(identityId, { ...registrationNotification, title: 'Welcome to Flowline', message: 'Your account is pending administrator activation and role assignment.' })
      for (const admin of admins.rows) this.notificationPublisher?.publish(admin.auth_user_id, registrationNotification)
      return toUser({ ...profile, roles: [] })
    } catch (error) {
      await client.query('ROLLBACK')
      if ((error as { code?: string }).code === '23505') {
        throw new AuthError(409, 'ACCOUNT_EXISTS', 'An account already exists for this email address.')
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
          account.locked_until,
          ARRAY(
            SELECT role.code
            FROM flowline.user_roles AS user_role
            JOIN flowline.roles AS role ON role.id = user_role.role_id
            WHERE user_role.user_profile_id = profile.id
            ORDER BY role.code
          ) AS roles
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
      throw new AuthError(429, 'ACCOUNT_LOCKED', 'Too many failed attempts. Try again later.')
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

    const expiresAt = new Date(Date.now() + sessionDurationMs)
      await this.pool.query(`DELETE FROM flowline.auth_sessions WHERE expires_at <= clock_timestamp() OR revoked_at <= clock_timestamp() - interval '30 days'`)
    let sessionToken = ''
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
      const session = await client.query<{ id: string }>(
        `
          INSERT INTO flowline.auth_sessions (
            user_profile_id,
            token_hash,
            expires_at
          )
          VALUES ($1, $2, $3)
          RETURNING id
        `,
        [account.id, hashSessionToken(randomUUID()), expiresAt],
      )
      const sessionId = session.rows[0]?.id
      if (!sessionId) throw new Error('Session creation returned no id')
      const now = Math.floor(Date.now() / 1000)
      sessionToken = createSessionJwt({ sub: account.auth_user_id, sid: sessionId, iat: now, exp: Math.floor(expiresAt.getTime() / 1000), typ: 'session' }, this.jwtSecrets[0]!)
      await client.query(`UPDATE flowline.auth_sessions SET token_hash=$2 WHERE id=$1`, [sessionId, hashSessionToken(sessionToken)])
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
    if (!this.jwtSecrets.some((secret) => verifySessionJwt(token, secret))) return null
    const tokenHash = hashSessionToken(token)
    const result = await this.pool.query<AccountRow>(
      `
        SELECT
          profile.auth_user_id,
          profile.email,
          profile.display_name,
          profile.status,
          ARRAY(
            SELECT role.code
            FROM flowline.user_roles AS user_role
            JOIN flowline.roles AS role ON role.id = user_role.role_id
            WHERE user_role.user_profile_id = profile.id
            ORDER BY role.code
          ) AS roles
        FROM flowline.auth_sessions AS session
        JOIN flowline.user_profiles AS profile
          ON profile.id = session.user_profile_id
        WHERE session.token_hash = $1
          AND session.revoked_at IS NULL
          AND session.expires_at > clock_timestamp()
          AND profile.status <> 'DISABLED'
      `,
      [tokenHash],
    )
    const profile = result.rows[0]
    if (profile) {
      await this.pool.query('UPDATE flowline.auth_sessions SET last_seen_at = clock_timestamp() WHERE token_hash = $1', [tokenHash])
    }
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
