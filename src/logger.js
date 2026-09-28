import pino from 'pino';
import { config } from '#src/config.js';

export const logger = pino({
  level: config.nodeEnv === 'test' ? 'silent' : config.logLevel,
});
