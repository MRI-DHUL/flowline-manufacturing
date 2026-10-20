# Flowline Backend

Node.js API for server-side workflow rules and PostgreSQL access.

## Setup

1. Copy `.env.example` to `.env`.
2. Enter the pooled Neon connection string as `DATABASE_URL` directly in `.env`.
3. Never expose `DATABASE_URL` to the frontend or commit `.env`.

## Commands

```powershell
npm install
npm run dev
npm test
npm run typecheck
npm run build
```

## Health Routes

- `GET /health` - API process status.
- `GET /api/v1/health/database` - PostgreSQL connectivity and Flowline migration state.

## Authentication Routes

- `POST /api/v1/auth/register` - create a pending account without roles.
- `POST /api/v1/auth/login` - verify credentials and issue an HTTP-only session cookie.
- `GET /api/v1/auth/session` - return the current session identity and account status.
- `POST /api/v1/auth/logout` - revoke the current session.

Passwords use Argon2id hashes. PostgreSQL stores only SHA-256 session-token hashes; raw tokens exist only in HTTP-only cookies. Five failed password attempts lock an account for 15 minutes.

Fastify provides structured request logs. Authorization headers, cookies, passwords, and connection strings are redacted.
