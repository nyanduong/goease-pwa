// Only an owned F1 test database is accepted. Never load application .env here.
import mongoose from 'mongoose';
import { createProduct } from '../../src/product.js';
import { parseConfig } from '../../src/config.js';
import { validateIntegrationUri } from './replica-set.js';

async function main() {
  const uri = validateIntegrationUri(
    process.env.CATALOG_WORKER_TEST_URI ?? '',
    'test',
  );
  const connection = await mongoose
    .createConnection(uri, { autoIndex: false, autoCreate: false })
    .asPromise();
  const product = createProduct(
    connection,
    parseConfig({
      NODE_ENV: 'test',
      CLIENT_ORIGIN: 'http://localhost:5180',
      MONGODB_URI: uri,
    }),
    {
      geoapify: async (group) => {
        process.send?.('fetching');
        if (process.env.CATALOG_WORKER_TEST_HOLD === 'yes')
          await new Promise<void>(() => {});
        return {
          group,
          received: 1,
          rejected: 0,
          items: [
            {
              externalId: 'osm:node:906',
              name: 'Fixture qua restart tiến trình',
              address: 'Địa chỉ kiểm thử Hội An',
              latitude: 15.91,
              longitude: 108.328,
              category: 'culture',
              venueType: 'place',
              categories: ['tourism.attraction'],
              openingHoursNote: '',
              sourceUrl: 'https://www.openstreetmap.org/node/906',
              flags: [],
            },
          ],
        };
      },
    },
  );
  await product.initialize();
  const keepAlive = setInterval(() => {}, 1000);
  await product.operations.tick();
  clearInterval(keepAlive);
  await connection.close();
  process.send?.('done');
  process.disconnect?.();
}
void main().catch(() => {
  process.send?.('failed');
  process.exit(1);
});
