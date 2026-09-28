import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { config } from '#src/config.js';
import * as schema from '#src/db/schema.js';

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  statement_timeout: 5_000,
});

export const db = drizzle({ client: pool, schema });
