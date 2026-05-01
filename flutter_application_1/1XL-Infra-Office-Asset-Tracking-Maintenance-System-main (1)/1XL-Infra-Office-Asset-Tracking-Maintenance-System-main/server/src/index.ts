import 'dotenv/config';
import { config } from './config.js';
import { createApp } from './app.js';
import { log } from './lib/log.js';

const app = createApp();

const server = app.listen(config.PORT, () => {
  log.info(`1XL Asset Tracker API listening on http://localhost:${config.PORT} (${config.NODE_ENV})`);
});

function shutdown(signal: string) {
  log.info(`${signal} received — closing server`);
  server.close(err => {
    if (err) {
      log.error({ err }, 'shutdown error');
      process.exit(1);
    }
    log.info('bye');
    process.exit(0);
  });
  setTimeout(() => {
    log.warn('forced shutdown after 10s');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('unhandledRejection', err => log.error({ err }, 'unhandledRejection'));
process.on('uncaughtException',  err => log.error({ err }, 'uncaughtException'));
