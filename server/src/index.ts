import { createApp } from './app.js';
import { parseConfig } from './config.js';
import { createDatabase } from './database.js';
import { createLogger } from './observability/logger.js';
import { createProduct } from './product.js';

const logger = createLogger(process.env.NODE_ENV);

async function main() {
  const config = parseConfig(process.env);
  const database = createDatabase(config.MONGODB_URI, logger);
  const product = createProduct(database.connection, config, { logger });
  database.connection.on('connected', () => {
    void product.initialize().catch(() => logger.write('product.init_failed'));
  });
  const app = createApp(config, database.ping, logger, product.router);
  const server = app.listen(config.PORT, config.HOST, () => {
    logger.write('api.started');
  });
  void database.start();
  let stopping = false;
  async function shutdown() {
    if (stopping) return;
    stopping = true;
    logger.write('api.stopping');
    const deadline = setTimeout(() => process.exit(1), 10000);
    deadline.unref();
    server.closeIdleConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await product.recovery.drain();
    await database.close();
    clearTimeout(deadline);
  }
  const stop = () => {
    void shutdown().catch(() => {
      logger.write('api.shutdown_failed');
      process.exitCode = 1;
    });
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  server.once('error', () => {
    logger.write('api.listen_failed');
    void shutdown()
      .catch(() => logger.write('api.shutdown_failed'))
      .finally(() => {
        process.exitCode = 1;
      });
  });
}
main().catch(() => {
  logger.write('api.startup_failed');
  process.exitCode = 1;
});
