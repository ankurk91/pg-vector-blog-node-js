import { HttpError } from '#src/http/errors.js';

export const LIMIT_DEFAULT = 5;
// HNSW returns at most hnsw.ef_search rows (default 40). Raising this cap
// above that needs SET LOCAL hnsw.ef_search in the query's transaction.
export const LIMIT_MAX = 20;

const POSITIVE_INT = /^[1-9]\d*$/;

function parsePositiveInt(value, name) {
  if (typeof value !== 'string' || !POSITIVE_INT.test(value)) {
    throw new HttpError(400, 'invalid_param', `${name} must be a positive integer`);
  }
  const n = Number(value);
  if (!Number.isSafeInteger(n)) {
    throw new HttpError(400, 'invalid_param', `${name} is too large`);
  }
  return n;
}

export function parseSimilarParams(params, query) {
  const id = parsePositiveInt(params.id, 'id');
  const limit = query.limit === undefined ? LIMIT_DEFAULT : parsePositiveInt(query.limit, 'limit');
  if (limit > LIMIT_MAX) {
    throw new HttpError(400, 'invalid_param', `limit must be between 1 and ${LIMIT_MAX}`);
  }
  return { id, limit };
}
