# Flowline Database

PostgreSQL migrations and verification tooling for the Neon `dev` branch.

Flowline application data, Argon2id credential hashes, and hashed session tokens live in the `flowline` schema. Database access remains server-side; raw passwords and session tokens are never stored in PostgreSQL.

## Setup

1. Copy `.env.example` to `.env`.
2. Enter the pooled Neon connection string as `DATABASE_URL` directly in `.env`.
3. Never commit `.env`.

## Commands

```powershell
npm install
npm run migrate:status
npm run migrate
npm run health
npm test
```

The migration runner takes a PostgreSQL advisory lock, records SHA-256 checksums, and rejects edited migrations that have already been applied.
