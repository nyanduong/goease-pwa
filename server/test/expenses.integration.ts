import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
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
  'expense CRUD uses owner, revision, atomic audit and shared idempotency',
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
      const a = await register('expense-a'),
        b = await register('expense-b');
      const destinationId = '000000000000000000000004';
      const input: TripInput = {
        title: 'Expense test',
        destinations: [{ destinationId, order: 0 }],
        startDate: '2026-11-12',
        endDate: '2026-11-12',
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
        days: [
          {
            dayId: randomUUID(),
            date: '2026-11-12',
            destinationId,
            activities: [],
          },
        ],
      };
      const r = await call('/trips', 'POST', { trip: input }, a);
      assert.equal(r.status, 201);
      const trip = ((await r.json()) as { data: { trip: TripDto } }).data.trip;
      const path = `/trips/${trip.id}/expenses`;
      const read = async (query = '') => {
        const response = await call(path + query, 'GET', undefined, a);
        assert.equal(response.status, 200);
        return ((await response.json()) as { data: ExpenseListDto }).data;
      };
      const expense: ExpenseInput = {
        description: 'PRIVATE_EXPENSE_SENTINEL',
        category: 'meal',
        amountMinor: 240000,
        currency: 'VND',
        spentOn: '2026-11-11',
        timezone: 'Asia/Ho_Chi_Minh',
      };
      const key = randomUUID();
      let expenseId = '';
      await t.test(
        'auth, validation and concurrent create retries persist once',
        async () => {
          assert.equal((await call(path)).status, 401);
          assert.equal((await call(path, 'GET', undefined, b)).status, 404);
          assert.equal((await call(path, 'POST', { expense }, b)).status, 404);
          for (const bad of [
            { amountMinor: -1 },
            { amountMinor: 0 },
            { amountMinor: 1.5 },
            { amountMinor: 1e12 + 1 },
            { currency: 'USD' },
            { spentOn: '2026-02-30' },
            { ownerId: trip.id },
          ])
            assert.equal(
              (await call(path, 'POST', { expense: { ...expense, ...bad } }, a))
                .status,
              400,
            );
          const race = await Promise.all([
            call(path, 'POST', { expense }, a, key),
            call(path, 'POST', { expense }, a, key),
          ]);
          assert.deepEqual(
            race.map((v) => v.status),
            [201, 201],
          );
          let list = await read();
          assert.equal(list.totalCount, 1);
          expenseId = list.items[0]!.id;
          assert.equal(list.actual.amountMinor, 240000);
          assert.equal(list.actual.perPersonMinor, 60000);
          assert.equal(list.actual.remainingMinor, 760000);
          assert.equal(
            (
              await call(
                path,
                'POST',
                { expense: { ...expense, amountMinor: 250000 } },
                a,
                key,
              )
            ).status,
            409,
          );
          assert.equal(
            (await call(path, 'POST', { expense }, b, key)).status,
            404,
          );
          list = await read();
          assert.equal(list.tripRevision, trip.revision);
        },
      );
      await t.test(
        'edit races, same-key recovery and owner isolation',
        async () => {
          const body = {
            expense: { ...expense, amountMinor: 1200000 },
            expectedRevision: 1,
          };
          assert.equal(
            (await call(`${path}/${expenseId}`, 'PATCH', body, b)).status,
            404,
          );
          const editKey = randomUUID();
          assert.equal(
            (await call(`${path}/${expenseId}`, 'PATCH', body, a, editKey))
              .status,
            200,
          );
          assert.equal(
            (await call(`${path}/${expenseId}`, 'PATCH', body, a, editKey))
              .status,
            200,
          );
          assert.equal(
            (await call(`${path}/${expenseId}`, 'PATCH', body, a)).status,
            409,
          );
          assert.equal((await read()).actual.remainingMinor, -200000);
          const race = await Promise.all(
            [400000, 500000].map((amountMinor) =>
              call(
                `${path}/${expenseId}`,
                'PATCH',
                { expense: { ...expense, amountMinor }, expectedRevision: 2 },
                a,
              ),
            ),
          );
          assert.deepEqual(race.map((v) => v.status).sort(), [200, 409]);
          assert.equal((await read()).items[0]!.revision, 3);
        },
      );
      await t.test(
        'audit failure rolls back expense, key and serialization revision',
        async () => {
          const audit = harness.connection.collection('audit_logs');
          const existing = await audit.findOne({ entityId: expenseId });
          assert.ok(existing);
          await audit.createIndex(
            { requestId: 1 },
            {
              name: 'expense_audit_failure',
              unique: true,
              partialFilterExpression: { entityType: 'trip_expense' },
            },
          );
          const retryKey = randomUUID();
          const before = await product.trips.models.Trip.findById(trip.id);
          try {
            assert.equal(
              (
                await call(
                  path,
                  'POST',
                  { expense },
                  a,
                  retryKey,
                  String(existing.requestId),
                )
              ).status,
              500,
            );
            assert.equal((await read()).totalCount, 1);
            assert.equal(
              await product.trips.models.Key.countDocuments({ key: retryKey }),
              0,
            );
            assert.equal(
              (await product.trips.models.Trip.findById(trip.id))
                ?.expenseRevision,
              before?.expenseRevision,
            );
          } finally {
            await audit.dropIndex('expense_audit_failure');
          }
          assert.equal(
            (await call(path, 'POST', { expense }, a, retryKey)).status,
            201,
          );
          assert.equal((await read()).totalCount, 2);
        },
      );
      await t.test(
        'pagination summaries, zero/unset budget and itinerary edits preserve expenses',
        async () => {
          const before = await read();
          const page = await read('?offset=1&limit=1');
          assert.equal(page.items.length, 1);
          assert.equal(page.totalCount, 2);
          assert.equal(page.hasMore, false);
          assert.equal(page.actual.amountMinor, before.actual.amountMinor);
          assert.equal(
            (await call(path + '?limit=101', 'GET', undefined, a)).status,
            400,
          );
          let revision = trip.revision;
          for (const amountMinor of [0, null]) {
            const response = await call(
              `/trips/${trip.id}`,
              'PATCH',
              {
                trip: {
                  ...input,
                  budget: { ...input.budget, amountMinor },
                  title: 'Changed itinerary',
                },
                expectedRevision: revision,
              },
              a,
            );
            assert.equal(response.status, 200);
            revision++;
            const list = await read();
            assert.equal(list.totalCount, 2);
            assert.equal(
              list.actual.remainingMinor,
              amountMinor === null ? null : -list.actual.amountMinor,
            );
          }
        },
      );
      await t.test(
        'delete is scoped, revision checked, idempotent and never resurrected',
        async () => {
          assert.equal(
            (
              await call(
                `${path}/${expenseId}`,
                'DELETE',
                { expectedRevision: 3 },
                b,
              )
            ).status,
            404,
          );
          assert.equal(
            (
              await call(
                `${path}/${expenseId}`,
                'DELETE',
                { expectedRevision: 2 },
                a,
              )
            ).status,
            409,
          );
          const deleteKey = randomUUID();
          assert.equal(
            (
              await call(
                `${path}/${expenseId}`,
                'DELETE',
                { expectedRevision: 3 },
                a,
                deleteKey,
              )
            ).status,
            200,
          );
          assert.equal(
            (
              await call(
                `${path}/${expenseId}`,
                'DELETE',
                { expectedRevision: 3 },
                a,
                deleteKey,
              )
            ).status,
            200,
          );
          assert.equal(
            (await call(path, 'POST', { expense }, a, key)).status,
            201,
          );
          assert.equal((await read()).totalCount, 1);
          assert.ok(
            (await product.expenses.models.Expense.findById(expenseId))
              ?.deletedAt,
          );
          const other = (await read()).items[0]!;
          assert.equal(
            (
              await call(
                `${path}/${other.id}`,
                'DELETE',
                { expectedRevision: other.revision },
                a,
              )
            ).status,
            200,
          );
          assert.equal((await read()).actual.amountMinor, 0);
          await product.trips.models.Trip.updateOne(
            { _id: trip.id },
            { $set: { deletedAt: new Date() } },
          );
          assert.equal((await call(path, 'GET', undefined, a)).status, 404);
          assert.equal(
            (await call(path, 'POST', { expense }, a, key)).status,
            404,
          );
          assert.ok(!logs.join('').includes(expense.description));
          assert.ok(
            !JSON.stringify(
              await harness.connection
                .collection('audit_logs')
                .find({ entityType: 'trip_expense' })
                .toArray(),
            ).includes(expense.description),
          );
        },
      );
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await harness.stop();
    }
  },
);
