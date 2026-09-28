import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { insertPosts, migrateDb, pool, TEST_MODEL, truncate, unitVector } from '../helpers/db.js';
import { startServer } from '../helpers/server.js';

describe('GET /api/posts/:id/similar', () => {
  let server;
  let ids;

  before(async () => {
    await migrateDb();
    server = await startServer();
  });

  after(async () => {
    await server?.close();
    await pool.end();
  });

  beforeEach(async () => {
    await truncate();
    // Two clusters: around axis 0 ("tech") and axis 1 ("sport"), plus stragglers.
    ids = await insertPosts([
      { sourceKey: 'tech/1', category: 'tech', embedding: unitVector(0) },
      { sourceKey: 'tech/2', category: 'tech', embedding: unitVector(0, 2, 0.1) },
      { sourceKey: 'tech/3', category: 'tech', embedding: unitVector(0, 3, 0.4) },
      { sourceKey: 'sport/1', category: 'sport', embedding: unitVector(1, 0, 0.05) },
      { sourceKey: 'sport/2', category: 'sport', embedding: unitVector(1, 0, 0.2) },
      { sourceKey: 'sport/3', category: 'sport', embedding: unitVector(1, 2, 0.1) },
      { sourceKey: 'tech/pending', category: 'tech' },
      { sourceKey: 'tech/other-model', category: 'tech', embedding: unitVector(0), embeddingModel: 'other' },
    ]);
  });

  const get = (path) => fetch(`${server.baseUrl}${path}`);

  it('returns nearest posts in order, excluding the source', async () => {
    const res = await get(`/api/posts/${ids['tech/1']}/similar?limit=5`);
    assert.equal(res.status, 200);
    const body = await res.json();

    assert.deepEqual(body.source, { id: ids['tech/1'], title: 'tech/1', category: 'tech' });
    assert.deepEqual(body.meta, { limit: 5, model: TEST_MODEL });
    assert.deepEqual(
      body.results.map((r) => r.id),
      [ids['tech/2'], ids['tech/3'], ids['sport/2'], ids['sport/1'], ids['sport/3']],
    );
    for (const r of body.results) {
      assert.ok(r.score >= -1 && r.score <= 1, `score ${r.score} out of range`);
      assert.equal(typeof r.excerpt, 'string');
    }
    assert.ok(body.results[0].score > 0.99);
    assert.ok(body.results.every((r, i, all) => i === 0 || all[i - 1].score >= r.score));
  });

  it('skips unembedded posts and posts from another model', async () => {
    const res = await get(`/api/posts/${ids['tech/1']}/similar?limit=20`);
    const { results } = await res.json();
    const returned = new Set(results.map((r) => r.id));
    assert.equal(results.length, 5);
    assert.ok(!returned.has(ids['tech/pending']));
    assert.ok(!returned.has(ids['tech/other-model']));
    assert.ok(!returned.has(ids['tech/1']));
  });

  it('respects limit and defaults to 5', async () => {
    const two = await (await get(`/api/posts/${ids['sport/1']}/similar?limit=2`)).json();
    assert.deepEqual(two.results.map((r) => r.id), [ids['sport/3'], ids['sport/2']]);

    const dflt = await (await get(`/api/posts/${ids['sport/1']}/similar`)).json();
    assert.equal(dflt.meta.limit, 5);
    assert.equal(dflt.results.length, 5);
  });

  it('truncates the excerpt to 200 characters', async () => {
    const extra = await insertPosts([
      { sourceKey: 'tech/long', category: 'tech', body: 'x'.repeat(500), embedding: unitVector(0, 2, 0.05) },
    ]);
    const { results } = await (await get(`/api/posts/${ids['tech/1']}/similar?limit=1`)).json();
    assert.equal(results[0].id, extra['tech/long']);
    assert.equal(results[0].excerpt.length, 200);
  });

  it('returns 404 for a missing post', async () => {
    const res = await get('/api/posts/9999/similar');
    assert.equal(res.status, 404);
    assert.equal((await res.json()).error.code, 'not_found');
  });

  it('returns 409 for a post that is not embedded yet', async () => {
    const res = await get(`/api/posts/${ids['tech/pending']}/similar`);
    assert.equal(res.status, 409);
    assert.equal((await res.json()).error.code, 'not_embedded');
  });

  for (const path of ['/api/posts/abc/similar', '/api/posts/0/similar', '/api/posts/1/similar?limit=21']) {
    it(`returns 400 for ${path}`, async () => {
      const res = await get(path);
      assert.equal(res.status, 400);
      const body = await res.json();
      assert.equal(body.error.code, 'invalid_param');
      assert.equal(typeof body.error.message, 'string');
    });
  }

  it('returns 400 for a malformed path escape', async () => {
    const res = await get('/api/posts/%E0%A4%A/similar');
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error.code, 'bad_request');
  });

  it('returns JSON 404 for unknown routes', async () => {
    const res = await get('/nope');
    assert.equal(res.status, 404);
    assert.match(res.headers.get('content-type'), /application\/json/);
  });

  it('hides x-powered-by and sets a request id', async () => {
    const res = await get('/healthz');
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: 'ok' });
    assert.equal(res.headers.get('x-powered-by'), null);
    assert.ok(res.headers.get('x-request-id'));
  });
});
