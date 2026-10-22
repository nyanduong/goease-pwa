import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';
import type {
  TripDto,
  TripInput,
  BudgetSummary,
  PlaceDto,
} from '@goease/contracts';
import { createApp } from '../src/app.js';
import { createProduct } from '../src/product.js';
import { parseConfig } from '../src/config.js';
import { createLogger } from '../src/observability/logger.js';
import { seedDestinations } from '../src/features/trips/destination-seed.js';
import { seedPlaces } from '../src/features/explore/explore.seed.js';
import { startTestReplicaSet } from './support/replica-set.js';

async function payload(response: Response) {
  return (await response.json()) as {
    data: { items: PlaceDto[]; trip: TripDto; budget: BudgetSummary };
  };
}

test(
  'Hoi An: catalog links, server budget, persistence, authorization and non-destructive seed',
  { timeout: 90000 },
  async () => {
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
    await seedPlaces(product.explore.models.Place);
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
    try {
      const register = async (email: string) => {
        const r = await call('/auth/register', 'POST', {
          email,
          password: 'HoiAn-integration-only-2026',
          displayName: 'Traveler',
        });
        assert.equal(r.status, 201);
        return r.headers.get('set-cookie')!.split(';')[0]!;
      };
      const a = await register('hoian-a@example.invalid'),
        b = await register('hoian-b@example.invalid');
      const placeId = '100000000000000000000001',
        destinationId = '000000000000000000000004';
      await product.explore.models.Place.updateOne(
        { _id: placeId },
        { $set: { tip: 'Keep curated edit' } },
      );
      await seedPlaces(product.explore.models.Place);
      assert.equal(await product.explore.models.Place.countDocuments(), 7);
      assert.equal(
        (await product.explore.models.Place.findById(placeId))?.tip,
        'Keep curated edit',
      );
      const catalog = await payload(
        await call(`/places?destinationId=${destinationId}`),
      );
      assert.equal(catalog.data.items.length, 7);
      assert.equal(
        catalog.data.items[0]!.planning!.priceOptions[0]!.amountMinor,
        80000,
      );
      assert.equal(
        (
          await payload(
            await call('/places?destinationId=000000000000000000000001'),
          )
        ).data.items.length,
        0,
      );
      assert.equal((await call('/places?destinationId=bad')).status, 400);
      const input: TripInput = {
        title: 'Hội An 3 ngày',
        destinations: [{ destinationId, order: 0 }],
        startDate: '2026-11-12',
        endDate: '2026-11-14',
        timezone: 'Asia/Ho_Chi_Minh',
        travelers: { totalCount: 4 },
        budget: {
          amountMinor: 1000000,
          currency: 'VND',
          scope: 'group_total',
          includedCategories: [],
        },
        preferences: {
          interestCodes: ['culture'],
          pace: 'relaxed',
          transportModes: [],
        },
        generationMode: 'manual',
        notes: '',
        days: [12, 13, 14].map((n) => ({
          dayId: randomUUID(),
          date: `2026-11-${n}`,
          destinationId,
          activities: [],
        })),
      };
      const cost = {
        currency: 'VND' as const,
        quantity: 1 as const,
        confidence: 'user_entered' as const,
      };
      input.days[0]!.activities = [
        {
          activityId: randomUUID(),
          placeId,
          kind: 'visit',
          title: 'Phố cổ',
          timezone: 'Asia/Ho_Chi_Minh',
          order: 0,
          notes: '',
          source: 'manual',
          estimatedCost: { ...cost, amountMinor: 80000, basis: 'per_person' },
        },
        {
          activityId: randomUUID(),
          kind: 'lodging',
          title: 'Lưu trú dự kiến',
          timezone: 'Asia/Ho_Chi_Minh',
          order: 1,
          notes: '',
          source: 'manual',
          estimatedCost: { ...cost, amountMinor: 300000, basis: 'group_total' },
        },
        {
          activityId: randomUUID(),
          placeId: '100000000000000000000002',
          kind: 'meal',
          title: 'Cơm gà',
          timezone: 'Asia/Ho_Chi_Minh',
          order: 2,
          notes: '',
          source: 'manual',
          estimatedCost: { ...cost, amountMinor: null, basis: 'group_total' },
        },
      ];
      assert.equal(
        (await call('/trips/budget-preview', 'POST', { trip: input })).status,
        401,
      );
      assert.equal(
        (
          await call(
            '/trips/budget-preview',
            'POST',
            { trip: input, ownerId: 'forged' },
            a,
          )
        ).status,
        400,
      );
      const preview = await call(
        '/trips/budget-preview',
        'POST',
        { trip: input },
        a,
      );
      assert.equal(preview.status, 200);
      const summary = (await payload(preview)).data.budget;
      assert.equal(summary.knownEstimatedMinor, 620000);
      assert.equal(summary.missingCostCount, 1);
      assert.equal(summary.remainingMinor, 380000);
      assert.equal(
        await product.trips.models.Trip.countDocuments(),
        0,
        'preview has no side effects',
      );
      const key = randomUUID();
      const created = await call('/trips', 'POST', { trip: input }, a, key);
      assert.equal(created.status, 201);
      let trip = (await payload(created)).data.trip;
      assert.deepEqual(trip.budgetSummary, summary);
      assert.equal(trip.days[0]!.activities[0]!.placeId, placeId);
      assert.equal(
        (await call('/trips', 'POST', { trip: input }, a, key)).status,
        201,
      );
      assert.equal(await product.trips.models.Trip.countDocuments(), 1);
      assert.equal(
        (await call(`/trips/${trip.id}`, 'GET', undefined, b)).status,
        404,
      );
      assert.equal(
        (
          await call(
            `/trips/${trip.id}`,
            'PATCH',
            { trip: input, expectedRevision: trip.revision },
            b,
          )
        ).status,
        404,
      );
      input.travelers.totalCount = 5;
      const changed = await call(
        `/trips/${trip.id}`,
        'PATCH',
        { trip: input, expectedRevision: trip.revision },
        a,
      );
      assert.equal(changed.status, 200);
      assert.equal(
        (
          await call(
            `/trips/${trip.id}`,
            'PATCH',
            { trip: input, expectedRevision: trip.revision },
            a,
          )
        ).status,
        409,
      );
      trip = (await payload(changed)).data.trip;
      assert.equal(trip.budgetSummary?.knownEstimatedMinor, 700000);
      assert.equal(
        (await payload(await call(`/trips/${trip.id}`, 'GET', undefined, a)))
          .data.trip.budgetSummary?.knownEstimatedMinor,
        700000,
      );
      const invalid = structuredClone(input);
      invalid.days[0]!.activities[0]!.placeId = 'ffffffffffffffffffffffff';
      assert.equal(
        (await call('/trips', 'POST', { trip: invalid }, a)).status,
        400,
      );
      const wrong = structuredClone(input);
      wrong.destinations[0]!.destinationId = '000000000000000000000001';
      wrong.days.forEach((d) => (d.destinationId = '000000000000000000000001'));
      assert.equal(
        (await call('/trips', 'POST', { trip: wrong }, a)).status,
        400,
      );
      await product.explore.models.Place.updateOne(
        { _id: placeId },
        { $set: { publicationStatus: 'archived' } },
      );
      assert.equal(
        (
          await call(
            `/trips/${trip.id}`,
            'PATCH',
            { trip: input, expectedRevision: trip.revision },
            a,
          )
        ).status,
        200,
        'existing archived link preserves the itinerary',
      );
      assert.equal(
        (await call('/trips', 'POST', { trip: input }, a)).status,
        400,
        'new archived links rejected',
      );
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await harness.stop();
    }
  },
);
