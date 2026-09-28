const env = process.env;

function int(name, fallback) {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n)) throw new Error(`${name} must be an integer, got "${raw}"`);
  return n;
}

function required(name) {
  const value = env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export const config = Object.freeze({
  nodeEnv: env.NODE_ENV ?? 'development',
  isProduction: env.NODE_ENV === 'production',
  port: int('PORT', 3000),
  logLevel: env.LOG_LEVEL ?? 'info',
  databaseUrl: required('DATABASE_URL'),
  embedding: Object.freeze({
    model: env.EMBEDDING_MODEL ?? 'Xenova/bge-small-en-v1.5',
    pooling: env.EMBEDDING_POOLING ?? 'cls',
    dims: int('EMBEDDING_DIMS', 384),
  }),
  hfCacheDir: env.HF_CACHE_DIR ?? '.cache/hf',
});
