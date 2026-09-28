import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

// Downloads and runs the real model, so it is opt-in: RUN_MODEL_TESTS=1 pnpm test
const skip = process.env.RUN_MODEL_TESTS !== '1' && 'set RUN_MODEL_TESTS=1 to run';

const dot = (a, b) => a.reduce((sum, x, i) => sum + x * b[i], 0);

describe('embedder', { skip, timeout: 120_000 }, () => {
  it('returns normalized vectors that separate topics', async () => {
    const { embedBatch } = await import('#src/embeddings/embedder.js');
    const [techA, techB, sport] = await embedBatch([
      'Apple unveils a new laptop chip with a faster processor and longer battery life',
      'Microsoft releases a software update to fix security flaws in Windows',
      'Chelsea beat Arsenal 2-1 in a Premier League football match',
    ]);

    assert.equal(techA.length, 384);
    assert.ok(Math.abs(Math.hypot(...techA) - 1) < 1e-4, 'vector should be unit length');
    assert.ok(dot(techA, techB) > dot(techA, sport), 'tech should be closer to tech than to sport');
  });
});
