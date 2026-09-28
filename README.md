# pgvector-blog-similarity

A Node.js learning project: BBC News articles stored in Postgres, embedded with a
local model ([`Xenova/bge-small-en-v1.5`](https://huggingface.co/Xenova/bge-small-en-v1.5),
384 dims, CPU via ONNX), served by a read-only REST API that returns similar posts
using [pgvector](https://github.com/pgvector/pgvector).

## Stack

Node 24 (ESM) · pnpm 12 · Postgres 18 + pgvector 0.8 · Drizzle ORM · Transformers.js 4 ·
Express 5 · pino · oxlint · `node:test`

## Quick start

```sh
cp .env.example .env
pnpm install
docker compose up -d          # Postgres on 127.0.0.1:5432 (also creates blog_test)
pnpm db:migrate
pnpm seed --download          # fetches the BBC dataset into data/ (2,225 articles)
pnpm embed                    # first run downloads the model into .cache/hf
pnpm dev
```

```sh
curl 'localhost:3000/api/posts/1/similar?limit=5'
```

## Dataset

The [BBC full-text dataset](http://mlg.ucd.ie/datasets/bbc.html) (D. Greene and
P. Cunningham, ICML 2006) is for **non-commercial research use**. It is not committed:
`pnpm seed --download` fetches it, or place `bbc-fulltext.zip` in `data/` yourself.
`pnpm seed` is idempotent: rows are keyed by `category/number` and only rewritten
when their content changed.

## Embedding

```sh
pnpm embed                  # all pending rows
pnpm embed --id 42          # one post (always re-embeds it)
pnpm embed --force          # re-embed everything
pnpm embed --batch 32       # batch size, default 32
```

A row is pending when it has no embedding, its content changed since it was embedded
(`embedded_hash <> content_hash`), or it was embedded with a different model than
`EMBEDDING_MODEL`. So `pnpm embed` is safe to run any time. A Postgres advisory lock
keeps concurrent runs out; Ctrl-C finishes the current batch and exits.

## API

### `GET /api/posts/:id/similar?limit=5`

| Input | Rule | Error |
|---|---|---|
| `id` | integer ≥ 1 | 400 |
| `limit` | integer 1–20, default 5 | 400 |
| post missing | | 404 |
| post not embedded yet | | 409 |

```json
{
  "source": { "id": 42, "title": "…", "category": "tech" },
  "results": [
    { "id": 118, "title": "…", "category": "tech", "excerpt": "first 200 chars…", "score": 0.87 }
  ],
  "meta": { "limit": 5, "model": "Xenova/bge-small-en-v1.5" }
}
```

`score` is cosine similarity. Only posts embedded with the same model as the source
are compared. `limit` is capped at 20 because HNSW returns at most `hnsw.ef_search`
rows (default 40).

Errors are always `{ "error": { "code", "message" } }`; stack traces are included for
5xx responses outside `NODE_ENV=production`.

### `GET /healthz`

Runs `SELECT 1`. An ops probe, not a data API.

## Tests

```sh
pnpm test                     # unit + integration, against the blog_test database
RUN_MODEL_TESTS=1 pnpm test   # also runs the real model
```

Integration tests use real Postgres with hand-made vectors, so CI never downloads
the model. Settings come from `.env.test`; real environment variables win.

## Layout

```
src/
  config.js               env → frozen config
  db/                     pg pool (5s statement_timeout) + Drizzle schema
  embeddings/embedder.js  lazy singleton pipeline
  services/similar.js     query logic, no HTTP
  http/                   Express app, routes, validation, error mapping
  server.js               listen + graceful shutdown
  cli/                    migrate, seed, embed
drizzle/                  generated SQL migrations (0000 enables pgvector)
test/                     unit, integration, helpers
```

## Notes

- **pnpm 12 build scripts:** `pnpm-workspace.yaml` denies the build scripts of
  `onnxruntime-node`, `esbuild` and `protobufjs`. The CPU binaries ship prebuilt;
  onnxruntime's postinstall only fetches CUDA files.
- **Schema changes:** edit `src/db/schema.js`, run `pnpm db:generate`, commit the
  new file in `drizzle/`, then `pnpm db:migrate`.
