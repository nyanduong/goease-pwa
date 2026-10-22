import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';
import type { TripInput, TripDto } from '@goease/contracts';
import { createApp } from '../src/app.js';
import { createProduct } from '../src/product.js';
import { parseConfig } from '../src/config.js';
import { createLogger } from '../src/observability/logger.js';
import { seedDestinations } from '../src/features/trips/destination-seed.js';
import { startTestReplicaSet } from './support/replica-set.js';

test(
  'read-only trip sharing protects private data and enforces lifecycle',
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
        notes: 'PRIVATE_TRIP_NOTE',
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

      assert.equal(
        (
          await call(
            `/trips/${trip.id}/expenses`,
            'POST',
            {
              expense: {
                description: 'PRIVATE_EXPENSE',
                category: 'meal',
                amountMinor: 765432,
                currency: 'VND',
                spentOn: '2026-11-12',
                timezone: 'Asia/Ho_Chi_Minh',
              },
            },
            a,
          )
        ).status,
        201,
      );
      const path = `/trips/${trip.id}/shares`;
      const token = 'a'.repeat(64),
        body = { token, expiresInDays: 7 };
      const publicRead = (value = token) =>
        fetch(base + '/shared-trip', {
          headers: { Authorization: `Bearer ${value}` },
        });
      const data = async <T>(r: Response) =>
        ((await r.json()) as { data: T }).data;
      await t.test(
        'owner guards validation retries and allowlist',
        async () => {
          assert.equal((await call(path, 'POST', body)).status, 401);
          assert.equal((await call(path, 'POST', body, b)).status, 404);
          assert.equal(
            (await call(path, 'POST', { ...body, ownerId: 'forged' }, a))
              .status,
            400,
          );
          assert.equal(
            (await call(path, 'POST', { ...body, expiresInDays: 0 }, a)).status,
            400,
          );
          const responses = await Promise.all([
            call(path, 'POST', body, a),
            call(path, 'POST', body, a),
          ]);
          responses.forEach((v) => assert.equal(v.status, 201));
          const first = await data<{
            share: { id: string; expiresAt: string };
          }>(responses[0]!);
          const second = await data<{
            share: { id: string; expiresAt: string };
          }>(responses[1]!);
          assert.deepEqual(first, second);
          assert.equal(await product.sharing.models.Share.countDocuments(), 1);
          assert.equal(
            (await call(path, 'POST', { ...body, expiresInDays: 30 }, a))
              .status,
            409,
          );
          assert.equal((await call(path, 'GET', undefined, b)).status, 404);
          const read = await publicRead();
          assert.equal(read.status, 200);
          assert.equal(read.headers.get('cache-control'), 'no-store');
          const shared = await data<{ trip: Record<string, unknown> }>(read);
          assert.deepEqual(
            Object.keys(shared.trip).sort(),
            [
              'title',
              'destinationName',
              'startDate',
              'endDate',
              'expiresAt',
              'days',
            ].sort(),
          );
          const text = JSON.stringify(shared);
          for (const forbidden of [
            'PRIVATE_TRIP_NOTE',
            'PRIVATE_EXPENSE',
            '765432',
            'private note',
            'notes',
            'estimatedCost',
            'budget',
            'ownerId',
            'email',
            'expenses',
            'summaryTotals',
            'aiRunId',
            token,
          ])
            assert.equal(text.includes(forbidden), false);
          const activity = (
            shared.trip.days as { activities: Record<string, unknown>[] }[]
          )[0]!.activities[0]!;
          assert.deepEqual(
            Object.keys(activity).sort(),
            ['activityId', 'kind', 'title', 'timezone', 'order'].sort(),
          );
          assert.equal((await publicRead('invalid')).status, 404);
          assert.equal(
            (
              await fetch(base + '/shared-trip', {
                method: 'PATCH',
                headers: {
                  Origin: config.CLIENT_ORIGIN,
                  'X-GoEase-Client': 'web',
                  Authorization: `Bearer ${token}`,
                },
              })
            ).status,
            404,
          );
          const record = await product.sharing.models.Share.findOne();
          assert.notEqual(record!.tokenHash, token);
          assert.equal(JSON.stringify(record).includes(token), false);
        },
      );
      await t.test('active link cap and current saved itinerary', async () => {
        const extra = [];
        for (let i = 1; i <= 9; i++) {
          const r = await call(
            path,
            'POST',
            { token: i.toString(16).padStart(64, '0'), expiresInDays: 1 },
            a,
          );
          assert.equal(r.status, 201);
          extra.push((await data<{ share: { id: string } }>(r)).share.id);
        }
        assert.equal(
          (
            await call(
              path,
              'POST',
              { token: 'e'.repeat(64), expiresInDays: 1 },
              a,
            )
          ).status,
          409,
        );
        for (const id of extra)
          assert.equal(
            (await call(`${path}/${id}`, 'DELETE', undefined, a)).status,
            200,
          );
        // Simulate another saved update; public projection reads current state rather than copying a private snapshot.
        await product.trips.models.Trip.updateOne(
          { _id: trip.id },
          { $set: { title: 'Updated shared title' } },
        );
        assert.equal(
          (await data<{ trip: { title: string } }>(await publicRead())).trip
            .title,
          'Updated shared title',
        );
        assert.equal(
          (await product.trips.models.Trip.findById(trip.id))!.revision,
          0,
        );
        assert.equal(
          await harness.connection.collection('trip_expenses').countDocuments(),
          1,
        );
      });
      await t.test(
        'audit failure rolls back issuance and revocation',
        async () => {
          const audit = harness.connection.collection('audit_logs');
          const existing = await audit.findOne({
            action: 'trip.share_created',
          });
          const reqId = existing!.requestId as string;
          await audit.createIndex(
            { requestId: 1 },
            {
              unique: true,
              partialFilterExpression: { requestId: reqId },
              name: 'share_audit_failure',
            },
          );
          try {
            const share = (await product.sharing.models.Share.findOne())!;
            assert.equal(
              (
                await call(
                  path,
                  'POST',
                  { token: 'd'.repeat(64), expiresInDays: 1 },
                  a,
                  randomUUID(),
                  reqId,
                )
              ).status,
              500,
            );
            assert.equal(
              await product.sharing.models.Share.countDocuments(),
              10,
            );
            assert.equal(
              (
                await call(
                  `${path}/${share.id}`,
                  'DELETE',
                  undefined,
                  a,
                  randomUUID(),
                  reqId,
                )
              ).status,
              500,
            );
            assert.equal((await publicRead()).status, 200);
          } finally {
            await audit.dropIndex('share_audit_failure');
          }
        },
      );
      await t.test(
        'expiry revocation deletion and restoration never reactivate links',
        async () => {
          const record = (await product.sharing.models.Share.findOne())!;
          assert.equal(
            (await call(`${path}/${record.id}`, 'DELETE', undefined, b)).status,
            404,
          );
          assert.equal(
            (await call(`${path}/${record.id}`, 'DELETE', undefined, a)).status,
            200,
          );
          assert.equal(
            (await call(`${path}/${record.id}`, 'DELETE', undefined, a)).status,
            200,
          );
          assert.equal((await publicRead()).status, 404);
          assert.equal((await call(path, 'POST', body, a)).status, 404);
          const expiredToken = 'b'.repeat(64);
          assert.equal(
            (
              await call(
                path,
                'POST',
                { token: expiredToken, expiresInDays: 1 },
                a,
              )
            ).status,
            201,
          );
          await product.sharing.models.Share.updateOne(
            { revokedAt: null },
            { $set: { expiresAt: new Date(0) } },
          );
          assert.equal((await publicRead(expiredToken)).status, 404);
          const liveToken = 'c'.repeat(64);
          assert.equal(
            (
              await call(
                path,
                'POST',
                { token: liveToken, expiresInDays: 30 },
                a,
              )
            ).status,
            201,
          );
          assert.equal((await publicRead(liveToken)).status, 200);
          assert.equal(
            (
              await call(
                `/trips/${trip.id}`,
                'DELETE',
                { expectedRevision: 0 },
                a,
              )
            ).status,
            200,
          );
          assert.equal((await publicRead(liveToken)).status, 404);
          await product.trips.models.Trip.updateOne(
            { _id: trip.id },
            { $set: { deletedAt: null } },
          );
          assert.equal((await publicRead(liveToken)).status, 404);
          assert.equal(
            (
              await product.sharing.list(
                new (await import('mongoose')).Types.ObjectId(
                  (await product.trips.models.Trip.findById(trip.id))!.ownerId,
                ),
                trip.id,
              )
            ).items.length,
            0,
          );
          for (const forbidden of [
            token,
            expiredToken,
            liveToken,
            'private note',
          ])
            assert.equal(logs.join('').includes(forbidden), false);
        },
      );
    } finally {
      server.close();
      await once(server, 'close');
      await harness.stop();
    }
  },
);
