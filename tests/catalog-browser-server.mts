// Test-only server: real API + owned MongoDB, allowlisted provider fixture.
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { startTestReplicaSet } from '../server/test/support/replica-set.js';
import { createProduct } from '../server/src/product.js';
import { createApp } from '../server/src/app.js';
import { parseConfig } from '../server/src/config.js';
import { createLogger } from '../server/src/observability/logger.js';
import { seedDestinations } from '../server/src/features/trips/destination-seed.js';
import { HttpError } from '../server/src/http-error.js';
import type { GeoapifyCandidate } from '../server/src/features/explore/geoapify.js';
import { e2eApiPort, e2eWebOrigin } from './ports.js';

async function main() {
  const harness = await startTestReplicaSet();
  const config = parseConfig({
    NODE_ENV: 'test',
    CLIENT_ORIGIN: e2eWebOrigin,
    MONGODB_URI: `mongodb://127.0.0.1:27021/${harness.connection.name}?replicaSet=${harness.setName}`,
    AUTH_MAX_ATTEMPTS: '100',
  });
  const candidate = (
    id: number,
    name: string,
    latitude: number,
  ): GeoapifyCandidate => ({
    externalId: `osm:node:${id}`,
    name,
    address: `Địa chỉ ${id}, Hội An · dữ liệu thử`,
    latitude,
    longitude: 108.328,
    category: 'food',
    venueType: 'restaurant',
    categories: ['catering.restaurant'],
    sourceUrl: `https://www.openstreetmap.org/node/${id}`,
    openingHoursNote: '',
    flags: [],
  });
  let phase = 0;
  const provider = async (group: 'sights' | 'restaurant' | 'cafe') => {
    if (phase >= 2)
      throw new HttpError(429, 'GEOAPIFY_REJECTED', 'Provider fixture 429');
    const items = [
      candidate(8001, 'Quán An · dữ liệu thử', 15.88),
      candidate(8002, 'Quán Bình · dữ liệu thử', 15.89),
      candidate(8003, 'Quán Bình · dữ liệu thử', 15.89001),
      candidate(8004, 'Vườn Cẩm · dữ liệu thử', 15.9),
    ];
    if (phase === 1)
      items[0]!.address = 'Địa chỉ nguồn mới, Hội An · dữ liệu thử';
    return { group, received: items.length, rejected: 0, items };
  };
  const product = createProduct(harness.connection, config, {
    geoapify: provider,
  });
  await product.initialize();
  await seedDestinations(product.trips.models.Destination);
  const app = createApp(
    config,
    async () => {},
    createLogger('test', () => {}),
    product.router,
  );
  const server = app.listen(e2eApiPort, 'localhost');
  await once(server, 'listening');
  const response = await fetch(
    `http://localhost:${e2eApiPort}/api/v1/auth/register`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: e2eWebOrigin,
        'X-GoEase-Client': 'web',
      },
      body: JSON.stringify({
        email: 'catalog-browser@example.invalid',
        password: 'Browser-fixture-2026!',
        displayName: 'Vận hành · dữ liệu thử',
      }),
    },
  );
  if (!response.ok) throw new Error('Fixture registration failed');
  const user = (await product.auth.models.User.findOne({
    emailNormalized: 'catalog-browser@example.invalid',
  }))!;
  await product.auth.models.User.updateOne(
    { _id: user._id },
    { $set: { roles: ['traveler', 'admin'] } },
  );
  await product.operations.status(user._id);
  await product.operations.models.Schedule.updateOne(
    {},
    { $set: { group: 'restaurant' } },
  );
  await product.operations.enqueue(user._id, randomUUID());
  await product.operations.tick();
  await product.explore.models.Place.updateOne(
    { 'source.externalId': 'osm:node:8001' },
    {
      $set: {
        name: 'Quán An đã biên tập · dữ liệu thử',
        publicationStatus: 'published',
      },
      $inc: { revision: 1 },
    },
  );
  phase = 1;
  await product.operations.enqueue(user._id, randomUUID());
  await product.operations.tick();
  phase = 2;
  product.operations.start();
  const stop = async () => {
    await product.operations.stop();
    server.close();
    await harness.stop();
    process.exit(0);
  };
  process.once('SIGINT', () => {
    void stop();
  });
  process.once('SIGTERM', () => {
    void stop();
  });
}
void main().catch(() => {
  process.stderr.write('Catalog browser fixture server failed\n');
  process.exit(1);
});
