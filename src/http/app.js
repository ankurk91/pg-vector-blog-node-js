import { randomUUID } from 'node:crypto';
import express from 'express';
import { pinoHttp } from 'pino-http';
import { config } from '#src/config.js';
import { pool } from '#src/db/client.js';
import { errorHandler, notFoundHandler } from '#src/http/errors.js';
import { router } from '#src/http/routes.js';
import { logger } from '#src/logger.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');

  app.use(pinoHttp({
    logger,
    genReqId(req, res) {
      const id = req.headers['x-request-id'] ?? randomUUID();
      res.setHeader('x-request-id', id);
      return id;
    },
  }));

  // Ops probe, not a data API.
  app.get('/healthz', async (req, res) => {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  });

  app.use('/api', router);
  app.use(notFoundHandler);
  app.use(errorHandler({ exposeStack: !config.isProduction }));
  return app;
}
