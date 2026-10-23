import pg from 'pg';
import { getDatabaseUrl } from './config.js';
import { logger } from './logger.js';
import { loadMigrations } from './migration-files.js';
const { Client } = pg;
const lockId = 7331042026;
async function ensureMigrationTable(client) {
    await client.query(`
    CREATE SCHEMA IF NOT EXISTS flowline;
    CREATE TABLE IF NOT EXISTS flowline.schema_migrations (
      name text PRIMARY KEY,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT clock_timestamp()
    );
  `);
}
async function main() {
    const command = process.argv[2] ?? 'status';
    if (!['up', 'status'].includes(command)) {
        throw new Error(`Unsupported migration command: ${command}`);
    }
    const client = new Client({ connectionString: getDatabaseUrl() });
    await client.connect();
    try {
        await client.query('SELECT pg_advisory_lock($1)', [lockId]);
        await ensureMigrationTable(client);
        const migrations = await loadMigrations();
        const appliedResult = await client.query('SELECT name, checksum, applied_at FROM flowline.schema_migrations ORDER BY name');
        const applied = new Map(appliedResult.rows.map((row) => [row.name, row]));
        for (const migration of migrations) {
            const previous = applied.get(migration.name);
            if (previous && previous.checksum !== migration.checksum) {
                throw new Error(`Applied migration was modified: ${migration.name}`);
            }
            if (command === 'status') {
                logger.info({ migration: migration.name, status: previous ? 'applied' : 'pending' }, 'Migration status');
                continue;
            }
            if (previous)
                continue;
            logger.info({ migration: migration.name }, 'Applying migration');
            await client.query('BEGIN');
            try {
                await client.query(migration.sql);
                await client.query('INSERT INTO flowline.schema_migrations (name, checksum) VALUES ($1, $2)', [migration.name, migration.checksum]);
                await client.query('COMMIT');
            }
            catch (error) {
                await client.query('ROLLBACK');
                throw error;
            }
            logger.info({ migration: migration.name }, 'Migration applied');
        }
    }
    finally {
        await client.query('SELECT pg_advisory_unlock($1)', [lockId]).catch(() => undefined);
        await client.end();
    }
}
main().catch((error) => {
    logger.error({ err: error }, 'Migration command failed');
    process.exitCode = 1;
});
