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
  'date rescheduling API: ownership, revisions, AI provenance, quota-free persistence and failure atomicity',
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

      input.endDate = input.startDate;
      input.days = input.days.slice(0, 1);
      const runId = randomUUID();
      input.generationMode = 'ai';
      input.aiRunId = runId;
      input.days[0]!.activities = [
        {
          activityId: randomUUID(),
          placeId,
          kind: 'visit',
          title: 'Phố cổ',
          startLocalTime: '09:00',
          endLocalTime: '12:00',
          timezone: 'Asia/Ho_Chi_Minh',
          order: 0,
          notes: 'Ghi chú riêng',
          source: 'ai',
          estimatedCost: {
            amountMinor: null,
            currency: 'VND',
            quantity: 1,
            basis: 'group_total',
            confidence: 'user_entered',
          },
        },
      ];
      const owner = await product.auth.models.User.findOne({
        emailNormalized: 'hoian-a@example.invalid',
      });
      await harness.connection.collection('ai_runs').insertOne({
        runId,
        userId: owner!._id,
        key: randomUUID(),
        provider: 'gemini',
        status: 'succeeded',
        proposal: { runId, trip: input, warnings: [] },
      });
      await product.explore.models.Place.updateOne(
        { _id: placeId },
        {
          $set: {
            openingHoursNote: '07:30–21:30; đóng cửa ngày 03 và 16 hằng tháng',
          },
        },
      );
      const request = {
        trip: input,
        startDate: '2026-11-16',
        endDate: '2026-11-16',
      };
      assert.equal(
        (await call('/trips/reschedule-dates', 'POST', request)).status,
        401,
      );
      assert.equal(
        (await call('/trips/reschedule-dates', 'POST', request, b)).status,
        409,
      );
      const response = await call(
        '/trips/reschedule-dates',
        'POST',
        request,
        a,
      );
      assert.equal(response.status, 200);
      const result = await payload(response);
      const changed = result.data.trip;
      assert.notEqual(changed.days[0]!.activities[0]!.placeId, placeId);
      assert.equal(
        changed.days[0]!.activities[0]!.activityId,
        input.days[0]!.activities[0]!.activityId,
      );
      assert.notEqual(changed.aiRunId, runId);
      assert.equal(
        await harness.connection.collection('usage_buckets').countDocuments(),
        0,
      );
      const storedRun = await harness.connection
        .collection('ai_runs')
        .findOne({ runId: changed.aiRunId });
      assert.equal(storedRun!.provider, 'catalog');
      const savedResponse = await call('/trips', 'POST', { trip: changed }, a);
      assert.equal(savedResponse.status, 201);
      const saved = (await payload(savedResponse)).data.trip;
      const next = {
        ...request,
        trip: changed,
        tripId: saved.id,
        expectedRevision: saved.revision,
      };
      assert.equal(
        (await call('/trips/reschedule-dates', 'POST', next, b)).status,
        404,
      );
      assert.equal(
        (
          await call(
            '/trips/reschedule-dates',
            'POST',
            { ...next, expectedRevision: saved.revision + 1 },
            a,
          )
        ).status,
        409,
      );
      const nextResponse = await call(
        '/trips/reschedule-dates',
        'POST',
        { ...next, startDate: '2026-11-17', endDate: '2026-11-17' },
        a,
      );
      assert.equal(nextResponse.status, 200);
      const nextTrip = (await payload(nextResponse)).data.trip;
      assert.equal(
        (
          await call(
            `/trips/${saved.id}`,
            'PATCH',
            { trip: nextTrip, expectedRevision: saved.revision },
            a,
          )
        ).status,
        200,
      );
      await product.explore.models.Place.updateMany(
        {},
        { $set: { openingHoursNote: 'tạm đóng cửa' } },
      );
      assert.equal(
        (await call('/trips/reschedule-dates', 'POST', request, a)).status,
        409,
      );
      assert.equal(
        (await payload(await call(`/trips/${saved.id}`, 'GET', undefined, a)))
          .data.trip.startDate,
        '2026-11-17',
      );
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await harness.stop();
    }
  },
);
