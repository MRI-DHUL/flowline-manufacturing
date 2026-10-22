import pg from 'pg'

const { Pool } = pg

export type DatabaseHealth = {
  database: string
  serverTime: Date
  schemaReady: boolean
  latestMigration: string | null
}

export function createDatabasePool(connectionString: string) {
  return new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  })
}

export async function checkDatabase(pool: pg.Pool): Promise<DatabaseHealth> {
  const result = await pool.query<{
    database: string
    server_time: Date
    schema_ready: boolean
    latest_migration: string | null
  }>(`
    SELECT
      current_database() AS database,
      clock_timestamp() AS server_time,
      to_regnamespace('flowline') IS NOT NULL AS schema_ready,
      CASE
        WHEN to_regclass('flowline.schema_migrations') IS NULL THEN NULL
        ELSE (SELECT max(name) FROM flowline.schema_migrations)
      END AS latest_migration
  `)

  const row = result.rows[0]
  if (!row) throw new Error('Database health query returned no rows')

  return {
    database: row.database,
    serverTime: row.server_time,
    schemaReady: row.schema_ready,
    latestMigration: row.latest_migration,
  }
}
