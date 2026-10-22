import { createApp } from '../../src/app.js';
import { getRequestContext } from '../../src/observability/context.js';
import { setTimeout as delay } from 'node:timers/promises';

const app = createApp(
  { CLIENT_ORIGIN: 'http://localhost:5180', NODE_ENV: 'test' },
  async () => {
    const before = getRequestContext();
    await delay(Math.floor(Math.random() * 20));
    process.send?.({ before, after: getRequestContext() });
    throw new Error(process.env.F1B_TEST_SECRET, {
      cause: { nested: process.env.F1B_TEST_SECRET },
    });
  },
);
const server = app.listen(0, '127.0.0.1', () =>
  process.send?.({ address: server.address() }),
);
process.on('message', (message) => {
  if (message === 'stop') server.close(() => process.exit(0));
});
