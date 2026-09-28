import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { HttpError } from '#src/http/errors.js';
import { LIMIT_DEFAULT, LIMIT_MAX, parseSimilarParams } from '#src/http/validate.js';

function assertBadRequest(params, query) {
  assert.throws(() => parseSimilarParams(params, query), (err) => {
    assert.ok(err instanceof HttpError);
    assert.equal(err.status, 400);
    assert.equal(err.code, 'invalid_param');
    return true;
  });
}

describe('parseSimilarParams', () => {
  it('parses a valid id and limit', () => {
    assert.deepEqual(parseSimilarParams({ id: '42' }, { limit: '7' }), { id: 42, limit: 7 });
  });

  it('defaults limit', () => {
    assert.deepEqual(parseSimilarParams({ id: '1' }, {}), { id: 1, limit: LIMIT_DEFAULT });
  });

  it('accepts the limit bounds', () => {
    assert.equal(parseSimilarParams({ id: '1' }, { limit: '1' }).limit, 1);
    assert.equal(parseSimilarParams({ id: '1' }, { limit: String(LIMIT_MAX) }).limit, LIMIT_MAX);
  });

  for (const id of ['abc', '0', '-1', '1.5', '', ' 1', '1e3', '01', '0x10', '99999999999999999999']) {
    it(`rejects id ${JSON.stringify(id)}`, () => assertBadRequest({ id }, {}));
  }

  for (const limit of ['abc', '0', '-1', '1.5', '', '21', '999']) {
    it(`rejects limit ${JSON.stringify(limit)}`, () => assertBadRequest({ id: '1' }, { limit }));
  }

  it('rejects a repeated limit (array)', () => {
    assertBadRequest({ id: '1' }, { limit: ['1', '2'] });
  });
});
