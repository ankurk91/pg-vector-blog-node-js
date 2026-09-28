import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from '#src/db/client.js';
import { logger } from '#src/logger.js';

try {
  await migrate(db, { migrationsFolder: 'drizzle' });
  logger.info('migrations applied');
} catch (err) {
  logger.error({ err }, 'migration failed');
  process.exitCode = 1;
} finally {
  await pool.end();
}
