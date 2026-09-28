import { defineConfig } from 'drizzle-kit';

// CI has no .env file; env vars come from the job instead.
try { process.loadEnvFile(); } catch {}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.js',
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_URL },
});
