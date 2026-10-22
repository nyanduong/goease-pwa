import { createApp } from './app.js';
import { parseConfig } from './config.js';
import { createDatabase } from './database.js';

async function main() {
  const config = parseConfig(process.env);
  const database = createDatabase(config.MONGODB_URI);
  const app = createApp(config, database.ping);
  const server = app.listen(config.PORT, config.HOST, () => {
    console.info(
      `GoEase API listening on http://${config.HOST}:${config.PORT}`,
    );
  });
  void database.start();
  let stopping = false;
  async function shutdown() {
    if (stopping) return;
    stopping = true;
    console.info('Shutting down GoEase API');
    const deadline = setTimeout(() => process.exit(1), 10000);
    deadline.unref();
    server.closeIdleConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await database.close();
    clearTimeout(deadline);
  }
  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());
  server.once('error', () => {
    console.error('API could not listen on the configured address');
    void shutdown().finally(() => {
      process.exitCode = 1;
    });
  });
}
main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'API startup failed');
  process.exitCode = 1;
});
