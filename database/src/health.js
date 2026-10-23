import pg from 'pg';
import { getDatabaseUrl } from './config.js';
import { logger } from './logger.js';
const { Client } = pg;
const client = new Client({ connectionString: getDatabaseUrl() });
try {
    await client.connect();
    const result = await client.query(`
    SELECT
      current_database() AS database,
      clock_timestamp() AS server_time,
      to_regnamespace('flowline') IS NOT NULL AS schema_ready
  `);
    logger.info(result.rows[0], 'Neon database connection healthy');
}
catch (error) {
    logger.error({ err: error }, 'Neon database connection failed');
    process.exitCode = 1;
}
finally {
    await client.end().catch(() => undefined);
}
