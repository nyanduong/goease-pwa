import { createApp } from '../server/src/app.js';

// Local foundation review uses the real health router without product initialization.
const app = createApp({ CLIENT_ORIGIN: 'http://localhost:5181' }, async () => {
  throw new Error('MongoDB is disabled in the foundation health process.');
});

const server = app.listen(3001, 'localhost', (error) => {
  if (error) {
    console.error('Không thể mở cổng health 3001.', error.message);
    process.exitCode = 1;
    return;
  }
  console.log('GoEase health · http://localhost:3001/api/v1/health');
});

process.once('SIGINT', () => server.close());
process.once('SIGTERM', () => server.close());
