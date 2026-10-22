import mongoose from 'mongoose';

export function createDatabase(uri: string) {
  const connection = mongoose.createConnection();
  connection.on('error', () => console.error('MongoDB connection error'));
  connection.on('disconnected', () => console.warn('MongoDB disconnected'));
  connection.on('connected', () => console.info('MongoDB connected'));
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
      console.warn('MongoDB unavailable; retrying in 3 seconds');
      if (!stopped) retryTimer = setTimeout(() => void connect(), 3000);
    }
  }

  return {
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
