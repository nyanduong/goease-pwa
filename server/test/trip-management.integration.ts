import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { shiftTripDays, tripLifecycle } from '@goease/contracts';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';
import type {
  ExpenseInput,
  ExpenseListDto,
  TripInput,
  TripDto,
} from '@goease/contracts';
import { createApp } from '../src/app.js';
import { createProduct } from '../src/product.js';
import { parseConfig } from '../src/config.js';
import { createLogger } from '../src/observability/logger.js';
import { seedDestinations } from '../src/features/trips/destination-seed.js';
import { startTestReplicaSet } from './support/replica-set.js';

test(
  'trip management preserves itinerary expenses and ownership with atomic retries',
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
    const logs: string[] = [];
    const server = createApp(
      config,
      async () => {},
      createLogger('test', (v) => logs.push(v)),
      product.router,
    ).listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
    const call = (
      path: string,
      method = 'GET',
      body?: unknown,
      cookie = '',
      key: string = randomUUID(),
      reqId: string = randomUUID(),
    ) =>
      fetch(base + path, {
        method,
        headers: {
          Origin: config.CLIENT_ORIGIN,
          'X-GoEase-Client': 'web',
          'Content-Type': 'application/json',
          'Idempotency-Key': key,
          'X-Request-Id': reqId,
          Cookie: cookie,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    try {
      const register = async (name: string) => {
        const r = await call('/auth/register', 'POST', {
          email: `${name}@example.invalid`,
          password: 'Expense-test-only-2026',
          displayName: 'Traveler',
        });
        assert.equal(r.status, 201);
        return r.headers.get('set-cookie')!.split(';')[0]!;
      };
      const a = await register('manage-a'),
        b = await register('manage-b');
      const destinationId = '000000000000000000000004';
      const input: TripInput = {
        title: 'Expense test',
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
        preferences: { interestCodes: [], pace: 'relaxed', transportModes: [] },
        generationMode: 'manual',
        notes: '',
        days: [0, 1, 2].map((i) => ({
          dayId: randomUUID(),
          date: `2026-11-${12 + i}`,
          destinationId,
          activities: [
            {
              activityId: randomUUID(),
              kind: 'visit' as const,
              title: `Stop ${i}`,
              timezone: 'Asia/Ho_Chi_Minh' as const,
              order: 0,
              notes: 'private note',
              source: 'manual' as const,
              estimatedCost: {
                amountMinor: 100000,
                currency: 'VND' as const,
                basis: 'per_person' as const,
                quantity: 1 as const,
                confidence: 'user_entered' as const,
              },
            },
          ],
        })),
      };
      const r = await call('/trips', 'POST', { trip: input }, a);
      assert.equal(r.status, 201);
      const trip = ((await r.json()) as { data: { trip: TripDto } }).data.trip;

      const readJson = async <T>(response: Response) =>
        ((await response.json()) as { data: T }).data;
      const path = `/trips/${trip.id}`;
      const expense: ExpenseInput = {
        description: 'Expense retained',
        category: 'meal',
        amountMinor: 240000,
        currency: 'VND',
        spentOn: '2026-11-11',
        timezone: 'Asia/Ho_Chi_Minh',
      };
      assert.equal(
        (await call(path + '/expenses', 'POST', { expense }, a)).status,
        201,
      );
      let current = trip;
      await t.test(
        'reschedule preserves IDs contents and expense dates; shortening with stops rejected',
        async () => {
          const shifted = shiftTripDays(
            input,
            '2027-02-01',
            '2027-02-03',
            randomUUID,
          );
          assert.deepEqual(
            shifted.days.map((d) => d.activities),
            input.days.map((d) => d.activities),
          );
          assert.deepEqual(
            shifted.days.map((d) => d.dayId),
            input.days.map((d) => d.dayId),
          );
          assert.throws(() =>
            shiftTripDays(input, '2027-02-01', '2027-02-02', randomUUID),
          );
          const bad = {
            ...shifted,
            endDate: '2027-02-02',
            days: shifted.days.slice(0, 2),
          };
          assert.equal(
            (
              await call(
                path,
                'PATCH',
                { trip: bad, expectedRevision: trip.revision },
                a,
              )
            ).status,
            400,
          );
          const saved = await call(
            path,
            'PATCH',
            {
              trip: {
                ...shifted,
                title: 'Rescheduled',
                travelers: { totalCount: 5 },
                budget: { ...shifted.budget, amountMinor: 2000000 },
              },
              expectedRevision: trip.revision,
            },
            a,
          );
          assert.equal(saved.status, 200);
          current = (await readJson<{ trip: TripDto }>(saved)).trip;
          const costs = await readJson<ExpenseListDto>(
            await call(path + '/expenses', 'GET', undefined, a),
          );
          assert.equal(costs.items[0]!.spentOn, expense.spentOn);
          assert.equal(costs.actual.amountMinor, 240000);
          assert.equal(costs.actual.remainingMinor, 1760000);
          assert.equal(costs.budget.knownEstimatedMinor, 1500000);
          const longer = shiftTripDays(
            {
              ...input,
              days: [
                ...input.days,
                {
                  ...input.days[0]!,
                  dayId: randomUUID(),
                  date: '2026-11-15',
                  activities: [],
                },
              ],
            },
            '2027-03-01',
            '2027-03-03',
            randomUUID,
          );
          assert.equal(longer.days.length, 3);
        },
      );
      let copy: TripDto;
      await t.test(
        'duplicate is owner scoped revision checked and concurrent retries produce one new trip without expenses',
        async () => {
          const payload = {
              expectedRevision: current.revision,
              startDate: '2027-04-01',
            },
            key = randomUUID();
          assert.equal(
            (await call(path + '/duplicate', 'POST', payload, b)).status,
            404,
          );
          assert.equal(
            (
              await call(
                path + '/duplicate',
                'POST',
                { ...payload, expectedRevision: 999 },
                a,
              )
            ).status,
            409,
          );
          assert.equal(
            (
              await call(
                path + '/duplicate',
                'POST',
                { ...payload, startDate: '2027-02-30' },
                a,
              )
            ).status,
            400,
          );
          const replies = await Promise.all([
            call(path + '/duplicate', 'POST', payload, a, key),
            call(path + '/duplicate', 'POST', payload, a, key),
          ]);
          assert.deepEqual(
            replies.map((r) => r.status),
            [201, 201],
          );
          const first = (await readJson<{ trip: TripDto }>(replies[0]!)).trip;
          const second = (await readJson<{ trip: TripDto }>(replies[1]!)).trip;
          assert.equal(first.id, second.id);
          copy = first;
          assert.equal(copy.revision, 0);
          assert.equal(copy.startDate, '2027-04-01');
          assert.equal(copy.endDate, '2027-04-03');
          assert.notEqual(copy.days[0]!.dayId, current.days[0]!.dayId);
          assert.notEqual(
            copy.days[0]!.activities[0]!.activityId,
            current.days[0]!.activities[0]!.activityId,
          );
          assert.equal(copy.days[0]!.activities[0]!.notes, 'private note');
          assert.equal(
            copy.summaryTotals.knownEstimatedMinor,
            current.summaryTotals.knownEstimatedMinor,
          );
          assert.equal(
            await product.expenses.models.Expense.countDocuments({
              tripId: copy.id,
            }),
            0,
          );
          assert.equal(
            (
              await product.trips.models.Trip.findById(copy.id)
            )?.clonedFromTripId?.toString(),
            trip.id,
          );
          assert.equal(
            (
              await call(
                path + '/duplicate',
                'POST',
                { ...payload, startDate: '2027-05-01' },
                a,
                key,
              )
            ).status,
            409,
          );
          assert.equal(
            (await product.trips.models.Trip.findById(trip.id))?.revision,
            current.revision,
          );
        },
      );
      await t.test(
        'phase filters and pagination use date boundaries; no expense or title exposure to another owner',
        async () => {
          const today = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Ho_Chi_Minh',
          }).format(new Date());
          assert.equal(
            tripLifecycle({ startDate: today, endDate: today }, today),
            'ongoing',
          );
          await product.trips.models.Trip.updateOne(
            { _id: copy.id },
            {
              $set: {
                startDate: today,
                endDate: new Date(Date.parse(today) + 2 * 86400000)
                  .toISOString()
                  .slice(0, 10),
                days: copy.days.map((d, i) => ({
                  ...d,
                  date: new Date(Date.parse(today) + i * 86400000)
                    .toISOString()
                    .slice(0, 10),
                })),
              },
            },
          );
          const ongoing = await readJson<{
            items: TripDto[];
            hasMore: boolean;
          }>(await call('/trips?phase=ongoing', 'GET', undefined, a));
          assert.deepEqual(
            ongoing.items.map((v: TripDto) => v.id),
            [copy.id],
          );
          const paged = await readJson<{ items: TripDto[]; hasMore: boolean }>(
            await call('/trips?limit=1', 'GET', undefined, a),
          );
          assert.equal(paged.items.length, 1);
          assert.equal(paged.hasMore, true);
          assert.equal(
            (await call('/trips?phase=bogus', 'GET', undefined, a)).status,
            400,
          );
          assert.equal(
            (
              await readJson<{ items: TripDto[]; hasMore: boolean }>(
                await call('/trips', 'GET', undefined, b),
              )
            ).items.length,
            0,
          );
          await product.trips.models.Trip.updateOne(
            { _id: copy.id },
            {
              $set: {
                startDate: copy.startDate,
                endDate: copy.endDate,
                days: copy.days,
              },
            },
          );
        },
      );
      await t.test(
        'audit failure rolls back delete and duplicate, then same keys safely retry',
        async () => {
          const audit = harness.connection.collection('audit_logs');
          // Reuse an existing request id to force only management audit writes to fail.
          const reqId = randomUUID();
          const createdKey = randomUUID();
          assert.equal(
            (
              await call(
                path + '/duplicate',
                'POST',
                { expectedRevision: current.revision, startDate: '2027-06-01' },
                a,
                createdKey,
                reqId,
              )
            ).status,
            201,
          );
          await audit.createIndex(
            { requestId: 1 },
            {
              unique: true,
              partialFilterExpression: { requestId: reqId },
              name: 'management_audit_failure',
            },
          );
          const deleteKey = randomUUID(),
            duplicateKey = randomUUID();
          const before = await product.trips.models.Trip.countDocuments();
          try {
            assert.equal(
              (
                await call(
                  path,
                  'DELETE',
                  { expectedRevision: current.revision },
                  a,
                  deleteKey,
                  reqId,
                )
              ).status,
              500,
            );
            assert.equal(
              (
                await call(
                  path + '/duplicate',
                  'POST',
                  {
                    expectedRevision: current.revision,
                    startDate: '2027-07-01',
                  },
                  a,
                  duplicateKey,
                  reqId,
                )
              ).status,
              500,
            );
            assert.equal(
              (await product.trips.models.Trip.findById(trip.id))?.deletedAt,
              null,
            );
            assert.equal(
              await product.trips.models.Trip.countDocuments(),
              before,
            );
            assert.equal(
              await product.trips.models.Key.countDocuments({
                key: { $in: [deleteKey, duplicateKey] },
              }),
              0,
            );
          } finally {
            await audit.dropIndex('management_audit_failure');
          }
          assert.equal(
            (
              await call(
                path + '/duplicate',
                'POST',
                { expectedRevision: current.revision, startDate: '2027-07-01' },
                a,
                duplicateKey,
              )
            ).status,
            201,
          );
        },
      );
      await t.test(
        'AI source clone becomes independent manual snapshot even with unavailable place links',
        async () => {
          const placeId = '000000000000000000009999';
          const aiDays = current.days.map((d) => ({
            ...d,
            activities: d.activities.map((a) => ({
              ...a,
              source: 'ai',
              placeId,
            })),
          }));
          await product.trips.models.Trip.updateOne(
            { _id: trip.id },
            {
              $set: {
                generationMode: 'ai',
                aiRunId: randomUUID(),
                days: aiDays,
              },
            },
          );
          try {
            const result = await call(
              path + '/duplicate',
              'POST',
              { expectedRevision: current.revision, startDate: '2027-09-01' },
              a,
            );
            assert.equal(result.status, 201);
            const clone = (await readJson<{ trip: TripDto }>(result)).trip;
            assert.equal(clone.generationMode, 'manual');
            assert.equal(clone.aiRunId, undefined);
            assert.equal(clone.days[0]!.activities[0]!.source, 'manual');
            assert.equal(clone.days[0]!.activities[0]!.placeId, placeId);
            const {
              id: cloneId,
              revision,
              destinationName,
              updatedAt,
              summaryTotals,
              budgetSummary,
              ...cloneInput
            } = clone;
            void destinationName;
            void updatedAt;
            void summaryTotals;
            void budgetSummary;
            assert.equal(
              (
                await call(
                  `/trips/${cloneId}`,
                  'PATCH',
                  {
                    trip: { ...cloneInput, title: 'Independent clone' },
                    expectedRevision: revision,
                  },
                  a,
                )
              ).status,
              200,
            );
          } finally {
            await product.trips.models.Trip.updateOne(
              { _id: trip.id },
              {
                $set: {
                  generationMode: current.generationMode,
                  days: current.days,
                },
                $unset: { aiRunId: 1 },
              },
            );
          }
        },
      );
      await t.test(
        'delete soft hides trip and expenses and old saves cannot resurrect it',
        async () => {
          const payload = { expectedRevision: current.revision },
            key = randomUUID();
          assert.equal((await call(path, 'DELETE', payload, b)).status, 404);
          assert.equal(
            (await call(path, 'DELETE', { expectedRevision: 999 }, a)).status,
            409,
          );
          for (let i = 0; i < 2; i++)
            assert.equal(
              (await call(path, 'DELETE', payload, a, key)).status,
              200,
            );
          assert.equal((await call(path, 'GET', undefined, a)).status, 404);
          assert.equal(
            (await call(path + '/expenses', 'GET', undefined, a)).status,
            404,
          );
          assert.equal(
            (
              await call(
                path,
                'PATCH',
                { trip: input, expectedRevision: current.revision },
                a,
              )
            ).status,
            404,
          );
          assert.equal(
            (
              await call(
                path + '/duplicate',
                'POST',
                { ...payload, startDate: '2027-08-01' },
                a,
              )
            ).status,
            404,
          );
          assert.equal(
            await product.expenses.models.Expense.countDocuments({
              tripId: trip.id,
            }),
            1,
          );
          assert.equal(
            await product.trips.models.Revision.countDocuments({
              tripId: trip.id,
              action: 'deleted',
            }),
            1,
          );
          const list = (
            await readJson<{ items: TripDto[]; hasMore: boolean }>(
              await call('/trips', 'GET', undefined, a),
            )
          ).items;
          assert.equal(
            list.some((v: TripDto) => v.id === trip.id),
            false,
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
