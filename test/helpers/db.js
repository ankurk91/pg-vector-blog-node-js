import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { sql } from 'drizzle-orm';
import { db, pool } from '#src/db/client.js';
import { posts } from '#src/db/schema.js';

export { db, pool };

export const DIMS = 384;
export const TEST_MODEL = 'test-model';

/** A unit vector pointing along `axis`, tilted towards `tiltAxis` by `tilt`. */
export function unitVector(axis, tiltAxis = axis, tilt = 0) {
  const v = Array.from({ length: DIMS }, () => 0);
  v[axis] = 1;
  v[tiltAxis] += tilt;
  const norm = Math.hypot(...v);
  return v.map((x) => x / norm);
}

export async function migrateDb() {
  await migrate(db, { migrationsFolder: 'drizzle' });
}

export async function truncate() {
  await db.execute(sql`TRUNCATE ${posts} RESTART IDENTITY`);
}

/** Inserts posts in order and returns them keyed by sourceKey. */
export async function insertPosts(rows) {
  const inserted = await db.insert(posts).values(rows.map((r) => ({
    sourceKey: r.sourceKey,
    category: r.category,
    title: r.title ?? r.sourceKey,
    body: r.body ?? `Body of ${r.sourceKey}`,
    embedding: r.embedding ?? null,
    embeddingModel: r.embedding ? (r.embeddingModel ?? TEST_MODEL) : null,
  }))).returning({ id: posts.id, sourceKey: posts.sourceKey });
  return Object.fromEntries(inserted.map((p) => [p.sourceKey, p.id]));
}
