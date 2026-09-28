import { sql } from 'drizzle-orm';
import { pgTable, integer, text, timestamp, vector, index, uniqueIndex } from 'drizzle-orm/pg-core';

export const posts = pgTable('posts', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  sourceKey: text('source_key').notNull(), // e.g. "business/001" — idempotent seed
  category: text().notNull(),
  title: text().notNull(),
  body: text().notNull(),
  contentHash: text('content_hash')
    .generatedAlwaysAs(sql`md5(title || E'\\n' || body)`), // change detection only
  embedding: vector({ dimensions: 384 }),
  embeddingModel: text('embedding_model'),
  embeddedHash: text('embedded_hash'),
  embeddedAt: timestamp('embedded_at', { withTimezone: true }),
}, (t) => [
  uniqueIndex('posts_source_key_uq').on(t.sourceKey),
  index('posts_embedding_hnsw').using('hnsw', t.embedding.op('vector_cosine_ops')),
]);
