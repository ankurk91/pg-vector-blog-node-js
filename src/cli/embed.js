import { parseArgs } from 'node:util';
import { and, asc, eq, isNull, or, sql } from 'drizzle-orm';
import { config } from '#src/config.js';
import { db, pool } from '#src/db/client.js';
import { posts } from '#src/db/schema.js';
import { embedBatch, postText } from '#src/embeddings/embedder.js';
import { logger } from '#src/logger.js';

const LOCK_SQL = `hashtext('embed-cli')`;
const model = config.embedding.model;

const { values: args } = parseArgs({
  options: {
    id: { type: 'string' },
    force: { type: 'boolean', default: false },
    batch: { type: 'string', default: '32' },
  },
});

const batchSize = Number(args.batch);
if (!Number.isInteger(batchSize) || batchSize < 1) {
  throw new Error(`--batch must be a positive integer, got "${args.batch}"`);
}
const onlyId = args.id === undefined ? undefined : Number(args.id);
if (onlyId !== undefined && (!Number.isInteger(onlyId) || onlyId < 1)) {
  throw new Error(`--id must be a positive integer, got "${args.id}"`);
}

let stopping = false;
process.on('SIGINT', () => {
  logger.info('SIGINT received; finishing current batch');
  stopping = true;
});

const pending = or(
  isNull(posts.embedding),
  sql`${posts.embeddedHash} IS DISTINCT FROM ${posts.contentHash}`,
  sql`${posts.embeddingModel} IS DISTINCT FROM ${model}`,
);

async function embedRows(rows) {
  const vectors = await embedBatch(rows.map(postText));
  await db.transaction(async (tx) => {
    for (const [i, row] of rows.entries()) {
      await tx.update(posts).set({
        embedding: vectors[i],
        embeddingModel: model,
        embeddedHash: sql`${posts.contentHash}`,
        embeddedAt: sql`now()`,
      }).where(eq(posts.id, row.id));
    }
  });
}

const columns = { id: posts.id, title: posts.title, body: posts.body };

async function embedOne(id) {
  const rows = await db.select(columns).from(posts).where(eq(posts.id, id));
  if (rows.length === 0) {
    logger.error({ id }, 'post not found');
    return 1;
  }
  await embedRows(rows);
  logger.info({ id }, 'embedded post');
  return 0;
}

async function embedAll() {
  // --force re-embeds everything once: the snapshot of ids is taken up front,
  // then walked by keyset so rows embedded in this run are not revisited.
  const where = args.force ? undefined : pending;
  const [{ total }] = await db.select({ total: sql`count(*)::int` }).from(posts).where(where);
  logger.info({ total, model, force: args.force }, 'embedding started');

  const started = performance.now();
  let done = 0;
  let lastId = 0;
  while (!stopping) {
    const rows = await db.select(columns).from(posts)
      .where(and(where, sql`${posts.id} > ${lastId}`))
      .orderBy(asc(posts.id))
      .limit(batchSize);
    if (rows.length === 0) break;

    await embedRows(rows);
    done += rows.length;
    lastId = rows.at(-1).id;
    const secs = (performance.now() - started) / 1000;
    logger.info({ done, total, rowsPerSec: Number((done / secs).toFixed(1)) }, 'progress');
  }
  logger.info({ done, stopped: stopping }, 'embedding finished');
  return 0;
}

async function main() {
  const conn = await pool.connect();
  try {
    const { rows: [{ locked }] } = await conn.query(
      `SELECT pg_try_advisory_lock(${LOCK_SQL}) AS locked`,
    );
    if (!locked) {
      logger.info('another embed run holds the lock; exiting');
      return 0;
    }
    try {
      return onlyId === undefined ? await embedAll() : await embedOne(onlyId);
    } finally {
      await conn.query(`SELECT pg_advisory_unlock(${LOCK_SQL})`);
    }
  } finally {
    conn.release();
  }
}

try {
  process.exitCode = await main();
} catch (err) {
  logger.error({ err }, 'embed failed');
  process.exitCode = 1;
} finally {
  await pool.end();
}
