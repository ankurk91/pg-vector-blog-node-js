import { and, cosineDistance, eq, isNotNull, ne, sql } from 'drizzle-orm';
import { db } from '#src/db/client.js';
import { posts } from '#src/db/schema.js';
import { PostNotEmbeddedError, PostNotFoundError } from '#src/services/errors.js';

export async function findSimilar({ id, limit }) {
  const [src] = await db.select({
    id: posts.id,
    title: posts.title,
    category: posts.category,
    embedding: posts.embedding,
    embeddingModel: posts.embeddingModel,
  }).from(posts).where(eq(posts.id, id));

  if (!src) throw new PostNotFoundError(id);
  if (!src.embedding) throw new PostNotEmbeddedError(id);

  const distance = cosineDistance(posts.embedding, src.embedding);
  const results = await db.select({
    id: posts.id,
    title: posts.title,
    category: posts.category,
    excerpt: sql`left(${posts.body}, 200)`,
    score: sql`1 - (${distance})`.mapWith(Number),
  })
    .from(posts)
    .where(and(
      ne(posts.id, id),
      isNotNull(posts.embedding),
      // Vectors from different models live in different spaces; never mix them.
      eq(posts.embeddingModel, src.embeddingModel),
    ))
    .orderBy(distance)
    .limit(limit);

  return {
    source: { id: src.id, title: src.title, category: src.category },
    results,
    meta: { limit, model: src.embeddingModel },
  };
}
