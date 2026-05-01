import pino from 'pino';
import { config } from '../config.js';

export const log = pino({
  level: config.LOG_LEVEL,
  transport: config.isProd
    ? undefined
    : { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' } },
  redact: ['req.headers.authorization', '*.password', '*.passwordHash'],
});
