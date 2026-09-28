import { PostNotEmbeddedError, PostNotFoundError } from '#src/services/errors.js';

export class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
  }
}

/** Maps any thrown value to an HttpError that is safe to send to clients. */
export function toHttpError(err) {
  if (err instanceof HttpError) return err;
  if (err instanceof PostNotFoundError) return new HttpError(404, 'not_found', err.message);
  if (err instanceof PostNotEmbeddedError) return new HttpError(409, 'not_embedded', err.message);
  // Express/router errors (e.g. a malformed %-escape in the path) carry a 4xx
  // status and a client-safe message. http-errors marks them `expose`; the
  // router sets only `status`, so treat any 4xx as client-facing unless denied.
  if (Number.isInteger(err?.status) && err.status >= 400 && err.status < 500 && err.expose !== false) {
    return new HttpError(err.status, 'bad_request', err.message);
  }
  return new HttpError(500, 'internal', 'Internal server error');
}

export function notFoundHandler(req, res) {
  res.status(404).json({ error: { code: 'not_found', message: 'Route not found' } });
}

export function errorHandler({ exposeStack }) {
  // Express identifies error middleware by its four-argument signature.
  return (err, req, res, _next) => {
    const httpErr = toHttpError(err);
    if (httpErr.status >= 500) req.log.error({ err }, 'request failed');
    const body = { error: { code: httpErr.code, message: httpErr.message } };
    if (exposeStack && httpErr.status >= 500) body.error.stack = err?.stack;
    res.status(httpErr.status).json(body);
  };
}
