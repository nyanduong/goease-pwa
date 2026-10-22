import mongoose from 'mongoose';
import { createLogger, type Logger } from './observability/logger.js';

export function createDatabase(uri: string, logger: Logger = createLogger()) {
  const connection = mongoose.createConnection();
  connection.on('error', () => logger.write('database.error'));
  connection.on('disconnected', () => logger.write('database.disconnected'));
  connection.on('connected', () => logger.write('database.connected'));
  let stopped = false;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;

  async function connect() {
    try {
      await connection.openUri(uri, {
        serverSelectionTimeoutMS: 2000,
        connectTimeoutMS: 2000,
        socketTimeoutMS: 2000,
        heartbeatFrequencyMS: 1000,
        bufferCommands: false,
      });
    } catch {
      logger.write('database.retry');
      if (!stopped) retryTimer = setTimeout(() => void connect(), 3000);
    }
  }

  return {
    connection,
    start: connect,
    async ping() {
      if (connection.readyState !== 1 || !connection.db)
        throw new Error('Database unavailable');
      await connection.db.command({ ping: 1 }, { timeoutMS: 2000 });
    },
    async close() {
      stopped = true;
      clearTimeout(retryTimer);
      await connection.close(true);
    },
  };
}
