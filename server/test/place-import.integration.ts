import {
  configureFixtureScope,
  fixtureDestinationId,
} from './support/catalog-scope.js';
import assert from 'node:assert/strict';
import { fixturePhoto } from './support/photo.js';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';
import type {
  PlaceImportPreview,
  PlaceImportResult,
  AdminPlaceDto,
  AdminPlaceInput,
} from '@goease/contracts';
import { createProduct } from '../src/product.js';
import { createApp } from '../src/app.js';
import { parseConfig } from '../src/config.js';
import { createLogger } from '../src/observability/logger.js';
import { seedDestinations } from '../src/features/trips/destination-seed.js';
import { startTestReplicaSet } from './support/replica-set.js';
import { HttpError } from '../src/http-error.js';
import type { GeoapifyCandidate } from '../src/features/explore/geoapify.js';
const candidate = (
  id: string,
  name: string,
  longitude = 108.328,
): GeoapifyCandidate => ({
  externalId: id,
  name,
  address: `${name}, Hội An`,
  longitude,
  latitude: 15.88,
  category: 'food',
  venueType: 'restaurant',
  categories: ['catering.cafe'],
  sourceUrl: 'https://www.openstreetmap.org/node/123',
  openingHoursNote: '',
  flags: [
    'missing_hours',
    'unknown_price',
    'unverified_location',
    'missing_photo',
  ],
});
test(
  'Geoapify import: fixtures exercise real API, MongoDB indexes, atomic batch, permissions and retries',
  { timeout: 90000 },
  async (t) => {
    const harness = await startTestReplicaSet();
    const config = parseConfig({
      NODE_ENV: 'test',
      CLIENT_ORIGIN: 'http://localhost:5180',
      MONGODB_URI: `mongodb://127.0.0.1:27021/${harness.connection.name}?replicaSet=${harness.setName}`,
      AUTH_MAX_ATTEMPTS: '100',
    });
    let providerCalls = 0,
      providerFails = false;
    let candidates = [
      candidate('fixture-a', 'Cafe 99'),
      candidate('fixture-b', 'Café 99', 108.3281),
      candidate('fixture-c', 'Quán mới', 108.33),
    ];
    const logs: string[] = [];
    const product = createProduct(harness.connection, config, {
      geoapify: async (group) => {
        providerCalls++;
        if (providerFails)
          throw new HttpError(
            502,
            'GEOAPIFY_UNAVAILABLE',
            'Provider fixture failed',
          );
        return {
          group,
          received: candidates.length,
          rejected: 0,
          items: candidates,
        };
      },
    });
    await product.initialize();
    await seedDestinations(product.trips.models.Destination);
    await configureFixtureScope(harness.connection);

    const server = createApp(
      config,
      async () => {},
      createLogger('test', (s) => logs.push(s)),
      product.router,
    ).listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
    const call = (
      path: string,
      method = 'POST',
      body?: unknown,
      cookie = '',
      key = randomUUID(),
    ) =>
      fetch(base + path, {
        method,
        headers: {
          Origin: config.CLIENT_ORIGIN,
          'X-GoEase-Client': 'web',
          'Content-Type': 'application/json',
          'Idempotency-Key': key,
          Cookie: cookie,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    const read = async <T>(r: Response): Promise<T> => {
      const v = (await r.json()) as { data: T };
      assert.ok(r.ok, JSON.stringify(v));
      return v.data;
    };
    try {
      const register = async (email: string, admin = false) => {
        const r = await call('/auth/register', 'POST', {
          email,
          password: 'Import-fixture-only-2026!',
          displayName: 'Fixture',
        });
        assert.equal(r.status, 201);
        if (admin)
          await product.auth.models.User.updateOne(
            { emailNormalized: email },
            { $set: { roles: ['traveler', 'admin'] } },
          );
        return r.headers.get('set-cookie')!.split(';')[0]!;
      };
      const admin = await register('import-admin@example.invalid', true),
        admin2 = await register('import-other@example.invalid', true),
        customer = await register('import-customer@example.invalid');
      const query = {
        group: 'cafe',
        limit: 30,
        destinationId: fixtureDestinationId,
      };
      const preview = () =>
        call('/admin/place-import/preview', 'POST', query, admin).then(
          read<PlaceImportPreview>,
        );
      let p!: PlaceImportPreview;
      await t.test(
        'guest/customer/forged data rejected before external call',
        async () => {
          assert.equal(
            (await call('/admin/place-import/preview', 'POST', query)).status,
            401,
          );
          assert.equal(
            (await call('/admin/place-import/preview', 'POST', query, customer))
              .status,
            403,
          );
          assert.equal(
            (
              await call(
                '/admin/place-import/preview',
                'POST',
                { ...query, limit: 1000 },
                admin,
              )
            ).status,
            400,
          );
          assert.equal(
            (
              await call(
                '/admin/place-import/preview',
                'POST',
                { ...query, apiKey: 'forged' },
                admin,
              )
            ).status,
            400,
          );
          assert.equal(providerCalls, 0);
          p = await preview();
          assert.equal(providerCalls, 1);
          assert.equal(p.items.length, 3);
          assert.ok(
            p.items
              .find((v) => v.externalId === 'fixture-a')!
              .possibleDuplicates.includes('Café 99'),
          );
          assert.equal(await product.explore.models.Place.countDocuments(), 0);
          const body = { previewId: p.previewId, externalIds: ['fixture-c'] };
          assert.equal(
            (await call('/admin/place-import/commit', 'POST', body, admin2))
              .status,
            409,
          );
          assert.equal(
            (
              await call(
                '/admin/place-import/commit',
                'POST',
                { ...body, externalIds: ['forged'] },
                admin,
              )
            ).status,
            400,
          );
          assert.equal(
            (
              await call(
                '/admin/place-import/commit',
                'POST',
                { ...body, source: { provider: 'geoapify' } },
                admin,
              )
            ).status,
            400,
          );
          assert.equal(
            (
              await call(
                '/admin/place-import/commit',
                'POST',
                { ...body, externalIds: ['fixture-a'] },
                admin,
              )
            ).status,
            409,
          );
        },
      );
      let result!: PlaceImportResult;
      const key = randomUUID();
      let body = { previewId: p.previewId, externalIds: ['fixture-c'] };
      await t.test(
        'concurrent retry creates one draft with provenance, unknown price, atomic audit and receipt',
        async () => {
          body = { previewId: p.previewId, externalIds: ['fixture-c'] };
          const responses = await Promise.all([
            call('/admin/place-import/commit', 'POST', body, admin, key),
            call('/admin/place-import/commit', 'POST', body, admin, key),
          ]);
          result = await read<PlaceImportResult>(responses[0]!);
          assert.deepEqual(await read(responses[1]!), result);
          assert.equal(result.created, 1);
          assert.equal(result.existing, 0);
          const saved = await product.explore.models.Place.findById(
            result.placeIds[0],
          );
          assert.equal(saved!.publicationStatus, 'draft');
          assert.equal(saved!.referencePrice, null);
          assert.equal(saved!.planning!.priceOptions.length, 0);
          assert.equal(saved!.source!.provider, 'geoapify');
          assert.equal(saved!.source!.license, 'ODbL-1.0');
          assert.equal(saved!.mapLocation!.precision, 'area');
          assert.equal(saved!.createdByType, 'user');
          assert.equal(
            await harness.connection
              .collection('audit_logs')
              .countDocuments({ action: 'catalog.imported' }),
            1,
          );
          assert.equal(
            await product.trips.models.Key.countDocuments({ key }),
            1,
          );
          assert.equal(
            (await call('/places/' + saved!._id, 'GET')).status,
            404,
          );
          const publicList = await read<{ items: unknown[] }>(
            await call('/places', 'GET'),
          );
          assert.equal(publicList.items.length, 0);
          assert.equal(providerCalls, 1);
          assert.equal(
            (
              await call(
                '/admin/place-import/commit',
                'POST',
                { ...body, externalIds: ['fixture-a'] },
                admin,
                key,
              )
            ).status,
            409,
          );
        },
      );
      await t.test(
        'new preview invalidates old selection; durable receipt still replays; reimport preserves admin edits',
        async () => {
          const saved = await read<{ place: AdminPlaceDto }>(
            await call(
              '/admin/places/' + result.placeIds[0],
              'GET',
              undefined,
              admin,
            ),
          );
          const {
            id,
            revision,
            updatedAt,
            source,
            imageUrl,
            imageCredit,
            proposalRevision,
            publicRevision,
            fieldProvenance,
            capabilities,
            photoSearch,
            ...input
          } = saved.place;
          void proposalRevision;
          void publicRevision;
          void fieldProvenance;
          void capabilities;
          void photoSearch;
          void updatedAt;
          void source;
          void imageUrl;
          void imageCredit;
          const edited: AdminPlaceInput = {
            ...input,
            images: [fixturePhoto],
            description: 'Giới thiệu dành cho kiểm thử.',
            name: 'Tên do admin biên tập',
            referencePrice: {
              label: 'Vé kiểm thử',
              amountMinor: 10000,
              basis: 'per_person',
              maxTravelers: 10,
              conditions: 'Fixture kiểm thử',
              inclusions: 'Vào cửa',
              exclusions: 'Dịch vụ thêm',
              sourceUrl: 'https://example.com/fixture',
              checkedAt: '2026-01-01',
              reviewAfter: '2099-01-01',
            },
            publicationStatus: 'published',
          };
          const changed = await read<{ place: AdminPlaceDto }>(
            await call(
              '/admin/places/' + id,
              'PATCH',
              { place: edited, expectedRevision: revision, intent: 'publish' },
              admin,
            ),
          );
          assert.equal(changed.place.source!.externalId, 'fixture-c');
          const p2 = await preview();
          assert.equal(
            p2.items.find((v) => v.externalId === 'fixture-c')!.existingPlaceId,
            id,
          );
          assert.deepEqual(
            await read(
              await call(
                '/admin/place-import/commit',
                'POST',
                body,
                admin,
                key,
              ),
            ),
            result,
          );
          assert.equal(
            (
              await call(
                '/admin/place-import/commit',
                'POST',
                {
                  previewId: p.previewId,
                  externalIds: ['fixture-b'],
                  acknowledgeDuplicates: true,
                },
                admin,
              )
            ).status,
            409,
          );
          const reimport = await read<PlaceImportResult>(
            await call(
              '/admin/place-import/commit',
              'POST',
              { previewId: p2.previewId, externalIds: ['fixture-c'] },
              admin,
            ),
          );
          assert.equal(reimport.created, 0);
          assert.equal(reimport.existing, 1);
          assert.equal(
            (await product.explore.models.Place.findById(id))!.name,
            'Tên do admin biên tập',
          );
        },
      );
      await t.test(
        'audit failure rolls back every item and receipt, same-key retry imports entire batch',
        async () => {
          candidates = [
            candidate('fixture-rollback-1', 'Rollback một', 108.332),
            candidate('fixture-rollback-2', 'Rollback hai', 108.333),
          ];
          const p3 = await preview(),
            batch = {
              previewId: p3.previewId,
              externalIds: candidates.map((v) => v.externalId),
            };
          const audit = harness.connection.collection('audit_logs');
          await audit.createIndex(
            { action: 1 },
            {
              unique: true,
              partialFilterExpression: { action: 'catalog.imported' },
              name: 'import_test_failure',
            },
          );
          const k = randomUUID();
          try {
            assert.equal(
              (
                await call(
                  '/admin/place-import/commit',
                  'POST',
                  batch,
                  admin,
                  k,
                )
              ).status,
              500,
            );
            assert.equal(
              await product.explore.models.Place.countDocuments(),
              1,
            );
            assert.equal(
              await product.trips.models.Key.countDocuments({ key: k }),
              0,
            );
          } finally {
            await audit.dropIndex('import_test_failure');
          }
          const imported = await read<PlaceImportResult>(
            await call('/admin/place-import/commit', 'POST', batch, admin, k),
          );
          assert.equal(imported.created, 2);
          assert.equal(await product.explore.models.Place.countDocuments(), 3);
          const reordered = {
            ...batch,
            externalIds: [...batch.externalIds].reverse(),
          };
          assert.deepEqual(
            await read(
              await call(
                '/admin/place-import/commit',
                'POST',
                reordered,
                admin,
                k,
              ),
            ),
            imported,
          );
        },
      );
      await t.test(
        'independent concurrent imports dedupe by durable external index beyond receipt lifespan',
        async () => {
          candidates = [candidate('fixture-race', 'Race', 108.334)];
          const p4 = await preview();
          const b = { previewId: p4.previewId, externalIds: ['fixture-race'] };
          const values = await Promise.all([
            call('/admin/place-import/commit', 'POST', b, admin).then(
              read<PlaceImportResult>,
            ),
            call('/admin/place-import/commit', 'POST', b, admin).then(
              read<PlaceImportResult>,
            ),
          ]);
          assert.equal(
            values.reduce((n, v) => n + v.created, 0),
            1,
          );
          assert.equal(
            await product.explore.models.Place.countDocuments({
              'source.externalId': 'fixture-race',
            }),
            1,
          );
          const again = await read<PlaceImportResult>(
            await call('/admin/place-import/commit', 'POST', b, admin),
          );
          assert.equal(again.created, 0);
        },
      );
      await t.test(
        'expired preview refuses catalog writes before cleanup',
        async () => {
          const expiring = await preview();
          const future = Date.now() + 16 * 60_000;
          const clock = t.mock.method(Date, 'now', () => future);
          try {
            assert.equal(
              (
                await call(
                  '/admin/place-import/commit',
                  'POST',
                  {
                    previewId: expiring.previewId,
                    externalIds: ['fixture-race'],
                  },
                  admin,
                )
              ).status,
              409,
            );
          } finally {
            clock.mock.restore();
          }
        },
      );
      await t.test(
        'provider failure and revoked role cannot import; search guard stops extra provider calls',
        async () => {
          providerFails = true;
          const before = await product.explore.models.Place.countDocuments();
          assert.equal(
            (await call('/admin/place-import/preview', 'POST', query, admin))
              .status,
            502,
          );
          assert.equal(
            await product.explore.models.Place.countDocuments(),
            before,
          );
          providerFails = false;
          while (providerCalls < 10) await preview();
          assert.equal(
            (await call('/admin/place-import/preview', 'POST', query, admin))
              .status,
            429,
          );
          assert.equal(providerCalls, 10);
          await product.auth.models.User.updateOne(
            { emailNormalized: 'import-admin@example.invalid' },
            { $set: { roles: ['traveler'] } },
          );
          assert.equal(
            (await call('/admin/place-import/commit', 'POST', body, admin, key))
              .status,
            403,
          );
          assert.ok(!logs.join('').includes('Import-fixture-only'));
          assert.ok(!logs.join('').includes('Quán mới'));
          assert.ok(!logs.join('').includes('fixture-secret'));
        },
      );
    } finally {
      server.close();
      await once(server, 'close');
      await harness.stop();
    }
  },
);
