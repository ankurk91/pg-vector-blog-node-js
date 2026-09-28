import { createWriteStream } from 'node:fs';
import { access, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { Readable } from 'node:stream';
import { buffer } from 'node:stream/consumers';
import { pipeline } from 'node:stream/promises';
import { parseArgs } from 'node:util';
import yauzl from 'yauzl';
import { sql } from 'drizzle-orm';
import { db, pool } from '#src/db/client.js';
import { posts } from '#src/db/schema.js';
import { logger } from '#src/logger.js';

const DATASET_URL = 'http://mlg.ucd.ie/files/datasets/bbc-fulltext.zip';
const BATCH_SIZE = 500;
const ENTRY_RE = /^bbc\/([a-z]+)\/(\d+)\.txt$/;

const { values: args } = parseArgs({
  options: {
    file: { type: 'string', default: 'data/bbc-fulltext.zip' },
    download: { type: 'boolean', default: false },
  },
});

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function download(url, dest) {
  logger.info({ url, dest }, 'downloading dataset');
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`);
  await mkdir(dirname(dest), { recursive: true });
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
}

/** Line 1 is the title; the rest is the body. */
function parseArticle(text) {
  const [first, ...rest] = text.replace(/\r\n/g, '\n').trim().split('\n');
  return { title: first.trim(), body: rest.join('\n').trim() };
}

async function* readArticles(zipPath) {
  const zip = await yauzl.openPromise(zipPath);
  const decoder = new TextDecoder('utf-8');
  for await (const entry of zip.eachEntry()) {
    const match = ENTRY_RE.exec(entry.fileName);
    if (!match) continue;
    const [, category, num] = match;
    const raw = await buffer(await zip.openReadStreamPromise(entry));
    yield { sourceKey: `${category}/${num}`, category, ...parseArticle(decoder.decode(raw)) };
  }
}

async function upsert(tx, rows) {
  // Only touch rows whose content changed, so a re-seed is a no-op.
  return tx.insert(posts).values(rows)
    .onConflictDoUpdate({
      target: posts.sourceKey,
      set: {
        category: sql`excluded.category`,
        title: sql`excluded.title`,
        body: sql`excluded.body`,
      },
      setWhere: sql`(${posts.category}, ${posts.title}, ${posts.body})
        IS DISTINCT FROM (excluded.category, excluded.title, excluded.body)`,
    })
    .returning({ id: posts.id });
}

async function main() {
  if (!(await exists(args.file))) {
    if (!args.download) {
      throw new Error(`${args.file} not found; place the zip there or pass --download`);
    }
    await download(DATASET_URL, args.file);
  }

  let seen = 0;
  let written = 0;
  await db.transaction(async (tx) => {
    let batch = [];
    const flush = async () => {
      written += (await upsert(tx, batch)).length;
      batch = [];
    };
    for await (const article of readArticles(args.file)) {
      batch.push(article);
      seen++;
      if (batch.length === BATCH_SIZE) await flush();
    }
    if (batch.length) await flush();
  });

  logger.info({ seen, written }, 'seed complete');
}

try {
  await main();
} catch (err) {
  logger.error({ err }, 'seed failed');
  process.exitCode = 1;
} finally {
  await pool.end();
}
