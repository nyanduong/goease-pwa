/** Owned, local review fixture. Never imports .env or calls a real provider. */
import { once } from 'node:events';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import mongoose from 'mongoose';
import type { Config } from '../server/src/config.js';
import { createProduct } from '../server/src/product.js';
import { createApp } from '../server/src/app.js';
import { createLogger } from '../server/src/observability/logger.js';
import { seedDestinations } from '../server/src/features/trips/destination-seed.js';
import {
  configureFixtureScope,
  fixtureDestinationId,
} from '../server/test/support/catalog-scope.js';
import { adminOperationsModels } from '../server/src/features/explore/admin-operations.models.js';
import { HttpError } from '../server/src/http-error.js';
import type {
  geoapifyProvider,
  GeoapifyCandidate,
} from '../server/src/features/explore/geoapify.js';

const databaseName = 'goease_admin_v3_review_20261024';
const uri = `mongodb://localhost:27017/${databaseName}?replicaSet=rs0`;
const apiPort = 3002,
  webOrigin = 'http://localhost:5182';
const markerId = 'goease-admin-v3-review-20261024-fixture-v1';
const accessPath = '.local/admin-v3-review-access.json';
const config: Config = {
  REGISTRATION_OTP_REQUIRED: false,
  NODE_ENV: 'test',
  HOST: 'localhost',
  PORT: apiPort,
  CLIENT_ORIGIN: webOrigin,
  MONGODB_URI: uri,
  SESSION_TTL_SECONDS: 604800,
  SESSION_IDLE_SECONDS: 86400,
  AUTH_MAX_ATTEMPTS: 100,
  AUTH_WINDOW_SECONDS: 900,
  SMTP_PORT: 465,
  RESET_TOKEN_TTL_SECONDS: 900,
  AI_PROVIDER: 'gemini',
  FULLDICHVU_MODEL: 'fulldichvu/haiku-4.5',
  GEMINI_MODEL: 'gemini-3.5-flash-lite',
  AI_DAILY_USER_LIMIT: 5,
  AI_DAILY_GLOBAL_LIMIT: 20,
  GOOGLE_REDIRECT_URI: `http://localhost:${apiPort}/api/v1/auth/google/callback`,
};
async function main() {
  if (
    process.env.NODE_ENV === 'production' ||
    uri !==
      'mongodb://localhost:27017/goease_admin_v3_review_20261024?replicaSet=rs0'
  )
    throw new Error('Review database guard rejected target');
  const connection = await mongoose.createConnection(uri).asPromise();
  if (
    connection.name !== databaseName ||
    connection.host !== 'localhost' ||
    connection.port !== 27017
  )
    throw new Error('Review database identity guard rejected target');
  const db = connection.db!;
  const collections = await db
    .listCollections({}, { nameOnly: true })
    .toArray();
  const marker = await db
    .collection<{ _id: string; kind: string }>('_review_fixture_meta')
    .findOne({ _id: markerId });
  if (collections.length && marker?.kind !== 'synthetic-review-only')
    throw new Error('Refusing existing unowned review data');
  let phase = 0;
  const provider: ReturnType<typeof geoapifyProvider> = async (
    group,
    limit,
    area,
  ) => {
    if (!area || ![15.88, 21.02].includes(area.latitude) || limit > 50)
      throw new Error('Fixture provider scope guard');
    if (area.latitude === 21.02)
      throw new HttpError(
        403,
        'GEOAPIFY_AUTH',
        'Nguồn fixture từ chối quyền truy cập. Đây là lỗi kiểm thử có kiểm soát.',
      );
    const items: GeoapifyCandidate[] = Array.from(
      { length: 24 },
      (_, i): GeoapifyCandidate => ({
        externalId: `osm:node:${980000 + i}`,
        name: `${i % 3 === 0 ? 'Vườn thử nghiệm' : i % 3 === 1 ? 'Quán thử nghiệm' : 'Không gian văn hóa thử'} ${String(i + 1).padStart(2, '0')} · FIXTURE`,
        address: `${10 + i} Đường dữ liệu thử, Hội An · FIXTURE${phase && i === 0 ? ' · quan sát nguồn mới' : ''}`,
        latitude: 15.876 + (i % 6) * 0.002,
        longitude: 108.32 + Math.floor(i / 6) * 0.003,
        category: i % 3 === 0 ? 'nature' : i % 3 === 1 ? 'food' : 'culture',
        venueType: i % 3 === 1 ? 'restaurant' : 'place',
        categories: [
          i % 3 === 1 ? 'catering.restaurant' : 'tourism.attraction',
        ],
        openingHoursNote: i % 4 === 0 ? '' : '08:00–18:00 · FIXTURE',
        sourceUrl: `https://www.openstreetmap.org/node/${980000 + i}`,
        flags: [],
      }),
    ).slice(0, limit);
    return { group, received: items.length, rejected: 0, items };
  };
  const product = createProduct(connection, config, {
    geoapify: provider,
    generate: async () => {
      throw new Error('Review fixture does not run AI');
    },
  });
  await product.initialize();
  const app = createApp(
    config,
    async () => {
      await db.command({ ping: 1 });
    },
    createLogger('test', () => {}),
    product.router,
  );
  const server = app.listen(apiPort, 'localhost');
  await once(server, 'listening');
  if (!marker) {
    await db
      .collection<{ _id: string; kind: string }>('_review_fixture_meta')
      .insertOne({ _id: markerId, kind: 'synthetic-review-only' });
    await seedDestinations(product.trips.models.Destination);
    await configureFixtureScope(connection);
    const password = `Review-${randomBytes(18).toString('base64url')}!7`;
    const email = 'admin-v3-review@example.invalid';
    const response = await fetch(
      `http://localhost:${apiPort}/api/v1/auth/register`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: webOrigin,
          'X-GoEase-Client': 'web',
        },
        body: JSON.stringify({
          email,
          password,
          displayName: 'Admin review · FIXTURE',
        }),
      },
    );
    if (!response.ok) throw new Error('Review fixture registration failed');
    const user = await product.auth.models.User.findOne({
      emailNormalized: email,
    });
    if (!user) throw new Error('Missing fixture user');
    await product.auth.models.User.updateOne(
      { _id: user._id },
      { $set: { roles: ['traveler', 'admin'] } },
    );
    await adminOperationsModels(connection).Settings.updateOne(
      { scope: 'global' },
      {
        $push: {
          regions: {
            destinationId: '000000000000000000000003',
            latitude: 21.02,
            longitude: 105.84,
            radiusMeters: 5000,
            enabled: true,
          },
        },
      },
    );
    await product.trips.models.Destination.updateOne(
      { _id: '000000000000000000000002' },
      { $set: { publicationStatus: 'draft' } },
    );
    await product.trips.models.Destination.updateOne(
      { _id: '000000000000000000000001' },
      { $set: { publicationStatus: 'archived' } },
    );
    const policy = await product.v3.createPolicy(user._id, {
      name: 'Quy tắc kiểm thử · FIXTURE',
      autoApplyDraftHours: true,
    });
    const campaign = await product.v3.createCampaign(
      user._id,
      {
        destinationIds: [fixtureDestinationId, '000000000000000000000003'],
        group: 'restaurant',
        policyId: policy.id,
      },
      randomUUID(),
    );
    await product.operations.tick();
    await product.operations.tick();
    const place = await product.explore.models.Place.findOne({
      'source.externalId': 'osm:node:980000',
    });
    if (!place) throw new Error('Provider fixture produced no place');
    await product.explore.models.Place.updateOne(
      { _id: place._id },
      {
        $set: {
          description:
            'Địa điểm kiểm thử giao diện quản trị, không phải thông tin du lịch đã xác minh.',
          publicationStatus: 'published',
          openingHoursNote: '08:00–18:00 · FIXTURE',
        },
        $inc: { revision: 1 },
      },
    );
    phase = 1;
    const updated = await product.v3.createCampaign(
      user._id,
      { destinationIds: [fixtureDestinationId], group: 'restaurant' },
      randomUUID(),
    );
    await product.operations.tick();
    await mkdir('.local', { recursive: true });
    await writeFile(
      accessPath,
      JSON.stringify(
        {
          fixture: true,
          email,
          password,
          webOrigin,
          apiOrigin: `http://localhost:${apiPort}`,
          database: databaseName,
          campaignId: campaign.campaign.id,
          updatedCampaignId: updated.campaign.id,
        },
        null,
        2,
      ),
    );
  } else {
    const access = JSON.parse(await readFile(accessPath, 'utf8')) as {
      fixture?: boolean;
      database?: string;
    };
    if (!access.fixture || access.database !== databaseName)
      throw new Error('Missing owned fixture access record');
    phase = 1;
  }
  product.operations.start();
  process.stdout.write(
    `Admin V3 synthetic review API ready on localhost:${apiPort}; owned database ${databaseName}; no live provider.\n`,
  );
  const stop = async () => {
    await product.operations.stop();
    server.close();
    await connection.close();
    process.exit(0);
  };
  process.once('SIGINT', () => {
    void stop();
  });
  process.once('SIGTERM', () => {
    void stop();
  });
}
void main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : 'Review fixture failed'}\n`,
  );
  process.exit(1);
});
