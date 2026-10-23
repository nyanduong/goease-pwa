import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';
import {
  catalogCost,
  catalogToday,
  type AdminPlaceInput,
  type AdminPlaceDto,
  type PlaceDto,
  type TripInput,
  type TripDto,
} from '@goease/contracts';
import { createProduct } from '../src/product.js';
import { createApp } from '../src/app.js';
import { parseConfig } from '../src/config.js';
import { createLogger } from '../src/observability/logger.js';
import { seedDestinations } from '../src/features/trips/destination-seed.js';
import { startTestReplicaSet } from './support/replica-set.js';
import { validatePlan } from '../src/features/ai/planner.js';
import { calculateBudget } from '../src/features/trips/budget.js';

test(
  'admin catalog to customer estimates: permissions, transactional edits, source snapshots and publication',
  { timeout: 90000 },
  async (t) => {
    const harness = await startTestReplicaSet();
    const config = parseConfig({
      NODE_ENV: 'development',
      CLIENT_ORIGIN: 'http://localhost:5180',
      MONGODB_URI: `mongodb://127.0.0.1:27021/${harness.connection.name}?replicaSet=${harness.setName}`,
      AUTH_MAX_ATTEMPTS: '100',
    });
    const product = createProduct(harness.connection, config);
    await product.initialize();
    await seedDestinations(product.trips.models.Destination);
    const app = createApp(
      config,
      async () => {},
      createLogger('test', () => {}),
      product.router,
    );
    const server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
    const call = (
      path: string,
      method = 'GET',
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
      const register = async (email: string) => {
        const r = await call('/auth/register', 'POST', {
          email,
          password: 'Catalog-test-only-2026!',
          displayName: 'Catalog test',
        });
        assert.equal(r.status, 201);
        return r.headers.get('set-cookie')!.split(';')[0]!;
      };
      const admin = await register('admin@example.invalid'),
        customer = await register('customer@example.invalid');
      const adminUser = await product.auth.models.User.findOne({
        emailNormalized: 'admin@example.invalid',
      });
      await product.auth.models.User.updateOne(
        { _id: adminUser!._id },
        { $set: { roles: ['traveler', 'admin'] } },
      );
      const destinationId = '000000000000000000000004';
      const input: AdminPlaceInput = {
        destinationId,
        name: 'Quán thử nghiệm có nguồn',
        category: 'food',
        venueType: 'restaurant',
        description: 'Dữ liệu kiểm thử, không phải giá thật.',
        locationQuery: 'Địa chỉ thử nghiệm Hội An',
        durationMinutes: 60,
        openingHoursNote: 'Giờ minh họa',
        sourceUrl: 'https://example.invalid/catalog-fixture',
        publicationStatus: 'draft',
        referencePrice: {
          label: 'Bữa ăn kiểm thử',
          amountMinor: 50000,
          basis: 'per_person',
          maxTravelers: 10,
          conditions:
            'Giá kiểm thử cho một bữa/người; không phải báo giá thực.',
          sourceUrl: 'https://example.invalid/price-fixture',
          checkedAt: catalogToday(),
          reviewAfter: '2099-12-31',
        },
      };
      await t.test(
        'server denies guest/customer and role mass assignment',
        async () => {
          assert.equal((await call('/admin/places')).status, 401);
          assert.equal(
            (await call('/admin/places', 'GET', undefined, customer)).status,
            403,
          );
          assert.equal(
            (await call('/admin/places', 'POST', { place: input }, customer))
              .status,
            403,
          );
          assert.equal(
            (
              await call('/auth/register', 'POST', {
                email: 'intruder@example.invalid',
                password: 'Catalog-test-only-2026!',
                displayName: 'Test',
                roles: ['admin'],
              })
            ).status,
            400,
          );
          assert.equal(
            (
              await call(
                '/admin/places',
                'POST',
                { place: { ...input, ownerId: String(adminUser!._id) } },
                admin,
              )
            ).status,
            400,
          );
        },
      );
      let place!: AdminPlaceDto;
      await t.test(
        'same-key concurrent create commits one draft and audit; draft stays private',
        async () => {
          const key = randomUUID();
          const [a, b] = await Promise.all([
            call('/admin/places', 'POST', { place: input }, admin, key),
            call('/admin/places', 'POST', { place: input }, admin, key),
          ]);
          place = (await read<{ place: AdminPlaceDto }>(a)).place;
          assert.equal(
            (await read<{ place: AdminPlaceDto }>(b)).place.id,
            place.id,
          );
          assert.equal(await product.explore.models.Place.countDocuments(), 1);
          assert.equal(
            await harness.connection
              .collection('audit_logs')
              .countDocuments({ entityType: 'place' }),
            1,
          );
          assert.equal((await call(`/places/${place.id}`)).status, 404);
          assert.equal(
            (
              await call(
                '/admin/places',
                'POST',
                { place: { ...input, name: 'Changed' } },
                admin,
                key,
              )
            ).status,
            409,
          );
          assert.equal(
            (
              await call(
                `/admin/places/${place.id}`,
                'PATCH',
                { place: input },
                admin,
              )
            ).status,
            400,
          );
        },
      );
      await t.test(
        'publication and revision conflict; invalid source/date/price rejected',
        async () => {
          for (const patch of [
            { sourceUrl: 'javascript:alert(1)' },
            { referencePrice: { ...input.referencePrice!, amountMinor: -1 } },
            {
              referencePrice: {
                ...input.referencePrice!,
                checkedAt: '2099-01-01',
              },
            },
            { venueType: 'food_idea' },
          ])
            assert.equal(
              (
                await call(
                  `/admin/places/${place.id}`,
                  'PATCH',
                  {
                    place: { ...input, ...patch },
                    expectedRevision: place.revision,
                  },
                  admin,
                )
              ).status,
              400,
            );
          const pub = { ...input, publicationStatus: 'published' };
          assert.equal(
            (
              await call(
                `/admin/places/${place.id}`,
                'PATCH',
                {
                  place: {
                    ...input,
                    destinationId: '000000000000000000000001',
                  },
                  expectedRevision: place.revision,
                },
                admin,
              )
            ).status,
            400,
          );
          place = (
            await read<{ place: AdminPlaceDto }>(
              await call(
                `/admin/places/${place.id}`,
                'PATCH',
                { place: pub, expectedRevision: place.revision },
                admin,
              ),
            )
          ).place;
          assert.equal(
            (
              await call(
                `/admin/places/${place.id}`,
                'PATCH',
                { place: pub, expectedRevision: 1 },
                admin,
              )
            ).status,
            409,
          );
          assert.equal(
            (
              await call(
                `/admin/places/${place.id}`,
                'PATCH',
                { place: pub, expectedRevision: place.revision },
                customer,
              )
            ).status,
            403,
          );
        },
      );
      const publicPlace = (
        await read<{ place: PlaceDto }>(await call(`/places/${place.id}`))
      ).place;
      const trip: TripInput = {
        title: 'Test priced trip',
        destinations: [{ destinationId, order: 0 }],
        startDate: '2026-11-07',
        endDate: '2026-11-07',
        timezone: 'Asia/Ho_Chi_Minh',
        travelers: { totalCount: 2 },
        budget: {
          amountMinor: null,
          currency: 'VND',
          scope: 'group_total',
          includedCategories: [],
        },
        preferences: {
          interestCodes: [],
          pace: 'balanced',
          transportModes: [],
        },
        generationMode: 'manual',
        notes: '',
        days: [
          {
            dayId: randomUUID(),
            date: '2026-11-07',
            destinationId,
            activities: [
              {
                activityId: randomUUID(),
                placeId: place.id,
                title: place.name,
                kind: 'meal',
                timezone: 'Asia/Ho_Chi_Minh',
                order: 0,
                notes: '',
                source: 'manual',
                estimatedCost: catalogCost(publicPlace),
              },
            ],
          },
        ],
      };
      let saved!: TripDto;
      await t.test(
        'AI prices from catalog, server totals and persistence include provenance',
        async () => {
          const generated = validatePlan(
            {
              days: [
                {
                  date: trip.startDate,
                  stops: [{ placeId: place.id, start: '12:00', end: '13:00' }],
                },
              ],
            },
            { consent: true, trip },
            [publicPlace],
            randomUUID(),
          );
          assert.equal(generated.budget.knownEstimatedMinor, 100000);
          assert.equal(
            generated.trip.days[0]!.activities[0]!.estimatedCost.confidence,
            'catalog_reference',
          );
          saved = (
            await read<{ trip: TripDto }>(
              await call('/trips', 'POST', { trip }, customer),
            )
          ).trip;
          assert.equal(saved.budgetSummary!.knownEstimatedMinor, 100000);
          assert.deepEqual(
            saved.days[0]!.activities[0]!.estimatedCost,
            trip.days[0]!.activities[0]!.estimatedCost,
          );
          assert.equal(
            (await call(`/trips/${saved.id}`, 'GET', undefined, admin)).status,
            404,
          );
        },
      );
      await t.test(
        'catalog changes do not rewrite saved estimates; new and changed group totals are correct',
        async () => {
          input.referencePrice!.amountMinor = 80000;
          await product.explore.models.Place.updateOne(
            { _id: place.id },
            {
              $set: {
                mapLocation: {
                  latitude: 15.88,
                  longitude: 108.33,
                  precision: 'area',
                  label: 'Old test address',
                  sourceUrl: 'https://example.invalid/map',
                  checkedAt: catalogToday(),
                },
              },
            },
          );
          input.locationQuery = 'New test address';
          place = (
            await read<{ place: AdminPlaceDto }>(
              await call(
                `/admin/places/${place.id}`,
                'PATCH',
                {
                  place: { ...input, publicationStatus: 'published' },
                  expectedRevision: place.revision,
                },
                admin,
              ),
            )
          ).place;
          const reloaded = (
            await read<{ trip: TripDto }>(
              await call(`/trips/${saved.id}`, 'GET', undefined, customer),
            )
          ).trip;
          assert.equal(reloaded.budgetSummary!.knownEstimatedMinor, 100000);
          const changed = { ...trip, travelers: { totalCount: 3 } };
          saved = (
            await read<{ trip: TripDto }>(
              await call(
                `/trips/${saved.id}`,
                'PATCH',
                { trip: changed, expectedRevision: saved.revision },
                customer,
              ),
            )
          ).trip;
          assert.equal(saved.budgetSummary!.knownEstimatedMinor, 150000);
          assert.equal(
            (await call('/trips', 'POST', { trip }, customer)).status,
            409,
          );
          const freshPlace = (
            await read<{ place: PlaceDto }>(await call(`/places/${place.id}`))
          ).place;
          assert.equal(freshPlace.mapLocation, undefined);
          trip.days[0]!.activities[0]!.estimatedCost = catalogCost(freshPlace);
          const second = (
            await read<{ trip: TripDto }>(
              await call('/trips', 'POST', { trip }, customer),
            )
          ).trip;
          assert.equal(second.budgetSummary!.knownEstimatedMinor, 160000);
          const forged = structuredClone(trip);
          forged.days[0]!.activities[0]!.estimatedCost.reference!.sourceUrl =
            'https://example.invalid/forged';
          assert.equal(
            (await call('/trips', 'POST', { trip: forged }, customer)).status,
            409,
          );
          trip.days[0]!.activities[0]!.estimatedCost = {
            amountMinor: 90000,
            basis: 'group_total',
            currency: 'VND',
            quantity: 1,
            confidence: 'user_entered',
          };
          const manual = (
            await read<{ trip: TripDto }>(
              await call('/trips', 'POST', { trip }, customer),
            )
          ).trip;
          assert.equal(manual.budgetSummary!.knownEstimatedMinor, 90000);
        },
      );
      await t.test('unknown vs free, group limits and expired prices', () => {
        const clone = structuredClone(trip);
        const p = structuredClone(publicPlace);
        p.referencePrice!.basis = 'group_total';
        p.referencePrice!.maxTravelers = 2;
        clone.days[0]!.activities[0]!.estimatedCost = catalogCost(p);
        assert.equal(calculateBudget(clone).knownEstimatedMinor, 50000);
        clone.travelers.totalCount = 3;
        assert.equal(calculateBudget(clone).missingCostCount, 1);
        assert.equal(calculateBudget(clone).knownEstimatedMinor, 0);
        p.referencePrice!.amountMinor = 0;
        p.referencePrice!.maxTravelers = 10;
        clone.days[0]!.activities[0]!.estimatedCost = catalogCost(p);
        assert.equal(calculateBudget(clone).missingCostCount, 0);
        p.referencePrice!.reviewAfter = '2000-01-01';
        assert.equal(catalogCost(p).amountMinor, null);
        assert.equal(catalogCost({}).amountMinor, null);
      });
      await t.test(
        'audit failure rolls back catalog and receipt; retry succeeds',
        async () => {
          const audit = harness.connection.collection('audit_logs');
          await audit.createIndex(
            { action: 1 },
            {
              unique: true,
              partialFilterExpression: { action: 'catalog.created' },
              name: 'catalog_test_failure',
            },
          );
          const key = randomUUID();
          try {
            assert.equal(
              (
                await call(
                  '/admin/places',
                  'POST',
                  { place: { ...input, name: 'Rollback fixture' } },
                  admin,
                  key,
                )
              ).status,
              500,
            );
            assert.equal(
              await product.explore.models.Place.countDocuments(),
              1,
            );
            assert.equal(
              await product.trips.models.Key.countDocuments({ key }),
              0,
            );
          } finally {
            await audit.dropIndex('catalog_test_failure');
          }
          assert.equal(
            (
              await call(
                '/admin/places',
                'POST',
                { place: { ...input, name: 'Rollback fixture' } },
                admin,
                key,
              )
            ).status,
            201,
          );
        },
      );
      await t.test(
        'archive hides public/AI catalog but preserves trip; revoking admin takes effect immediately',
        async () => {
          await read(
            await call(
              `/admin/places/${place.id}`,
              'PATCH',
              {
                place: { ...input, publicationStatus: 'archived' },
                expectedRevision: place.revision,
              },
              admin,
            ),
          );
          assert.equal((await call(`/places/${place.id}`)).status, 404);
          assert.equal(
            (await read<{ items: PlaceDto[] }>(await call('/places'))).items
              .length,
            0,
          );
          assert.equal(
            (
              await read<{ trip: TripDto }>(
                await call(`/trips/${saved.id}`, 'GET', undefined, customer),
              )
            ).trip.budgetSummary!.knownEstimatedMinor,
            150000,
          );
          const detail = await read<{ history: unknown[] }>(
            await call(`/admin/places/${place.id}`, 'GET', undefined, admin),
          );
          assert.equal(detail.history.length, 4);
          await product.auth.models.User.updateOne(
            { _id: adminUser!._id },
            { $set: { roles: ['traveler'] } },
          );
          assert.equal(
            (await call('/admin/places', 'GET', undefined, admin)).status,
            403,
          );
        },
      );
    } finally {
      server.close();
      await once(server, 'close');
      await harness.stop();
    }
  },
);
