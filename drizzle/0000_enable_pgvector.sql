-- Drizzle does not manage extensions; this must run before the posts table migration.
CREATE EXTENSION IF NOT EXISTS vector;
