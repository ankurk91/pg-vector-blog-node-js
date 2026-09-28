import { config } from '#src/config.js';
import { pool } from '#src/db/client.js';
import { createApp } from '#src/http/app.js';
import { logger } from '#src/logger.js';

const SHUTDOWN_TIMEOUT_MS = 10_000;

const server = createApp().listen(config.port, () => {
  logger.info({ port: config.port }, 'server listening');
});

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'shutting down');

  setTimeout(() => {
    logger.error('graceful shutdown timed out; forcing exit');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS).unref();

  server.close(async (err) => {
    if (err) logger.error({ err }, 'error closing server');
    await pool.end();
    process.exit(err ? 1 : 0);
  });
  // Let idle keep-alive sockets go so close() can finish.
  server.closeIdleConnections();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
