import { createServer } from 'node:http';
import { createApp } from './app.js';
import { readConfig } from './config.js';
import { log } from './logger.js';

function main() {
  let config;
  try {
    config = readConfig(process.env);
  } catch (error) {
    log('error', 'api.config_invalid', {
      message:
        error instanceof Error ? error.message : 'Invalid API configuration.',
    });
    process.exitCode = 1;
    return;
  }

  const server = createServer(createApp());
  let stopping = false;

  function shutdown(signal: NodeJS.Signals) {
    if (stopping) return;
    stopping = true;
    log('info', 'api.stopping', { signal });

    const deadline = setTimeout(() => {
      log('error', 'api.shutdown_timeout');
      process.exitCode = 1;
      server.closeAllConnections();
    }, 5000);
    deadline.unref();

    server.close((error) => {
      clearTimeout(deadline);
      process.off('SIGINT', shutdown);
      process.off('SIGTERM', shutdown);
      if (error) {
        log('error', 'api.shutdown_failed');
        process.exitCode = 1;
      } else if (process.exitCode !== 1) {
        log('info', 'api.stopped');
      }
    });
  }

  server.on('error', (error: NodeJS.ErrnoException) => {
    log('error', 'api.listen_failed', {
      port: config.port,
      code: error.code ?? 'UNKNOWN',
    });
    process.exitCode = 1;
  });
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  server.listen(config.port, config.host, () => {
    log('info', 'api.started', { host: config.host, port: config.port });
  });
}

main();
