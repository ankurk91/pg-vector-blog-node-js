import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { HttpError, toHttpError } from '#src/http/errors.js';
import { PostNotEmbeddedError, PostNotFoundError } from '#src/services/errors.js';

describe('toHttpError', () => {
  it('passes HttpError through', () => {
    const err = new HttpError(400, 'invalid_param', 'bad');
    assert.equal(toHttpError(err), err);
  });

  it('maps PostNotFoundError to 404', () => {
    const err = toHttpError(new PostNotFoundError(3));
    assert.equal(err.status, 404);
    assert.equal(err.code, 'not_found');
    assert.match(err.message, /3/);
  });

  it('maps PostNotEmbeddedError to 409', () => {
    const err = toHttpError(new PostNotEmbeddedError(3));
    assert.equal(err.status, 409);
    assert.equal(err.code, 'not_embedded');
  });

  it('keeps exposed 4xx errors from Express', () => {
    const err = Object.assign(new Error('URIError'), { status: 400, expose: true });
    assert.deepEqual(
      { status: toHttpError(err).status, code: toHttpError(err).code },
      { status: 400, code: 'bad_request' },
    );
  });

  it('keeps router 4xx errors that only set status', () => {
    const err = Object.assign(new URIError("Failed to decode param '%E0'"), { status: 400 });
    assert.equal(toHttpError(err).status, 400);
  });

  it('does not expose 4xx errors marked expose: false', () => {
    const err = Object.assign(new Error('secret'), { status: 400, expose: false });
    assert.equal(toHttpError(err).status, 500);
  });

  it('hides the message of unknown errors', () => {
    const err = toHttpError(new Error('connection string with password'));
    assert.equal(err.status, 500);
    assert.equal(err.code, 'internal');
    assert.equal(err.message, 'Internal server error');
  });

  it('handles non-Error throwables', () => {
    assert.equal(toHttpError(undefined).status, 500);
    assert.equal(toHttpError('boom').status, 500);
  });
});
