import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import mongoose from 'mongoose';
import { test } from 'node:test';
import type { TripDto, TripInput } from '@goease/contracts';
import { createApp } from '../src/app.js';
import { parseConfig } from '../src/config.js';
import { createProduct } from '../src/product.js';
import { createLogger } from '../src/observability/logger.js';
import { seedDestinations } from '../src/features/trips/destination-seed.js';
import { startTestReplicaSet } from './support/replica-set.js';

test(
  'real account and owner trip journey with verification, persistence, conflicts and audit rollback',
  { timeout: 90000 },
  async (t) => {
    const harness = await startTestReplicaSet();
    const { connection } = harness;
    const config = parseConfig({
      NODE_ENV: 'development',
      CLIENT_ORIGIN: 'http://localhost:5180',
      MONGODB_URI: `mongodb://127.0.0.1:27021/${connection.name}?replicaSet=${harness.setName}`,
      AUTH_MAX_ATTEMPTS: '100',
    });
    const logs: string[] = [];
    const product = createProduct(connection, config);
    await product.initialize();
    await seedDestinations(product.trips.models.Destination);
    const app = createApp(
      config,
      async () => {},
      createLogger('test', (line) => {
        logs.push(line);
      }),
      product.router,
    );
    const server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
    async function call(
      path: string,
      method = 'GET',
      body?: unknown,
      cookie = '',
      headers: Record<string, string> = {},
    ) {
      return fetch(base + path, {
        method,
        headers: {
          Origin: config.CLIENT_ORIGIN,
          'X-GoEase-Client': 'web',
          'Content-Type': 'application/json',
          Cookie: cookie,
          ...headers,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        redirect: 'manual',
      });
    }
    const suffix = randomUUID().slice(0, 8);
    const password = 'F1-product-private-sentinel-2026';
    const emailA = `a-${suffix}@example.invalid`;
    const emailB = `b-${suffix}@example.invalid`;
    async function register(email: string) {
      assert.equal(
        (
          await call('/auth/register', 'POST', {
            email,
            password,
            displayName: 'Traveler',
          })
        ).status,
        201,
      );
      assert.equal(
        (await call('/auth/login', 'POST', { email, password })).status,
        403,
      );
      const mailbox = (await (await call('/dev/mailbox')).json()) as {
        data: { items: { to: string; url: string }[] };
      };
      const mail = mailbox.data.items.find((m) => m.to === email);
      assert.ok(mail);
      const token = new URL(mail.url).searchParams.get('token');
      assert.equal(
        (await call('/auth/verify-email', 'POST', { token })).status,
        200,
      );
      assert.equal(
        (await call('/auth/verify-email', 'POST', { token })).status,
        400,
      );
      const response = await call('/auth/login', 'POST', { email, password });
      assert.equal(response.status, 200);
      const setCookie = response.headers.get('set-cookie') ?? '';
      assert.ok(
        setCookie.includes('HttpOnly') &&
          setCookie.includes('SameSite=Lax') &&
          setCookie.includes('Path=/api/v1'),
      );
      return setCookie.split(';')[0]!;
    }
    let cookieA = '';
    let cookieB = '';
    let trip!: TripDto;
    const input: TripInput = {
      title: 'Manual trip persisted in MongoDB',
      destinations: [{ destinationId: '000000000000000000000001', order: 0 }],
      startDate: '2026-11-01',
      endDate: '2026-11-01',
      timezone: 'Asia/Ho_Chi_Minh',
      travelers: { totalCount: 2 },
      budget: {
        amountMinor: 3000000,
        currency: 'VND',
        scope: 'group_total',
        includedCategories: [],
      },
      preferences: {
        interestCodes: ['nature'],
        pace: 'relaxed',
        transportModes: [],
      },
      generationMode: 'manual',
      notes: 'private-trip-notes-sentinel',
      days: [
        {
          dayId: randomUUID(),
          date: '2026-11-01',
          destinationId: '000000000000000000000001',
          activities: [
            {
              activityId: randomUUID(),
              kind: 'visit',
              title: 'Walk on the beach',
              startLocalTime: '08:00',
              endLocalTime: '09:00',
              timezone: 'Asia/Ho_Chi_Minh',
              order: 0,
              source: 'manual',
              notes: 'private-activity-note-sentinel',
              estimatedCost: {
                amountMinor: null,
                currency: 'VND',
                basis: 'group_total',
                quantity: 1,
                confidence: 'user_entered',
              },
            },
          ],
        },
      ],
    };
    try {
      await t.test(
        'registration verifies one-time challenge before login, PHC hash, no fake Google',
        async () => {
          cookieA = await register(emailA);
          cookieB = await register(emailB);
          const identity = await product.auth.models.Identity.findOne({
            loginEmailNormalized: emailA,
          }).select('+passwordHash');
          assert.ok(
            identity?.passwordHash?.startsWith('$argon2id$') &&
              !identity.passwordHash.includes(password),
          );
          const me = (await (
            await call('/auth/me', 'GET', undefined, cookieA)
          ).json()) as { data: { user: { emailVerified: boolean } } };
          assert.ok(me.data.user.emailVerified);
          assert.equal((await call('/auth/google')).status, 503);
          assert.equal(
            (await call('/trips', 'POST', { trip: input }, '')).status,
            401,
          );
        },
      );
      const key = randomUUID();
      await t.test(
        'create+retry persist once, source snapshots, history/audit and unknown cost',
        async () => {
          const response = await call(
            '/trips',
            'POST',
            { trip: input },
            cookieA,
            { 'Idempotency-Key': key },
          );
          assert.equal(response.status, 201);
          trip = ((await response.json()) as { data: { trip: TripDto } }).data
            .trip;
          assert.equal(trip.generationMode, 'manual');
          assert.equal(trip.summaryTotals.missingCostCount, 1);
          assert.equal(trip.revision, 0);
          const retry = await call('/trips', 'POST', { trip: input }, cookieA, {
            'Idempotency-Key': key,
          });
          assert.equal(retry.status, 201);
          assert.equal(
            ((await retry.json()) as { data: { trip: TripDto } }).data.trip.id,
            trip.id,
          );
          assert.equal(
            await product.trips.models.Revision.countDocuments({
              tripId: trip.id,
            }),
            1,
          );
          assert.equal(
            await connection
              .db!.collection('audit_logs')
              .countDocuments({ entityId: trip.id, action: 'trip.created' }),
            1,
          );
          const stored = await product.trips.models.Trip.findById(trip.id);
          assert.equal(stored?.destinations[0]?.nameSnapshot, 'Đà Nẵng');
          assert.equal(
            (
              await call(
                '/trips',
                'POST',
                { trip: { ...input, title: 'Changed' } },
                cookieA,
                { 'Idempotency-Key': key },
              )
            ).status,
            409,
          );
        },
      );
      await t.test(
        'owner B cannot read/update A; forged ownership/role inputs fail validation',
        async () => {
          assert.equal(
            (await call(`/trips/${trip.id}`, 'GET', undefined, cookieB)).status,
            404,
          );
          assert.equal(
            (
              await call(
                `/trips/${trip.id}`,
                'PATCH',
                { trip: input, expectedRevision: 0 },
                cookieB,
                { 'Idempotency-Key': randomUUID() },
              )
            ).status,
            404,
          );
          assert.equal(
            (
              await call(
                '/trips',
                'POST',
                {
                  trip: {
                    ...input,
                    ownerId: new mongoose.Types.ObjectId().toHexString(),
                  },
                },
                cookieA,
                { 'Idempotency-Key': randomUUID() },
              )
            ).status,
            400,
          );
          assert.equal(
            (
              await call('/auth/login', 'POST', {
                email: emailA,
                password,
                role: 'admin',
              })
            ).status,
            400,
          );
          assert.equal(
            (
              await call(
                '/trips',
                'POST',
                { trip: { ...input, travelers: { totalCount: 0 } } },
                cookieA,
                { 'Idempotency-Key': randomUUID() },
              )
            ).status,
            400,
          );
          for (const invalid of [
            { ...input, destinations: [] },
            {
              ...input,
              days: [
                {
                  ...input.days[0]!,
                  activities: [
                    { ...input.days[0]!.activities[0]!, endLocalTime: '07:00' },
                  ],
                },
              ],
            },
          ]) {
            assert.equal(
              (
                await call('/trips', 'POST', { trip: invalid }, cookieA, {
                  'Idempotency-Key': randomUUID(),
                })
              ).status,
              400,
            );
          }
          const evil = await fetch(base + '/auth/logout', {
            method: 'POST',
            headers: {
              Origin: 'https://untrusted.invalid',
              Cookie: cookieA,
              'X-GoEase-Client': 'web',
            },
          });
          assert.equal(evil.status, 403);
        },
      );
      await t.test(
        'concurrent saves reject stale revision, history remains append-only',
        async () => {
          const responses = await Promise.all(
            ['Version one', 'Version two'].map((title) =>
              call(
                `/trips/${trip.id}`,
                'PATCH',
                { trip: { ...input, title }, expectedRevision: 0 },
                cookieA,
                { 'Idempotency-Key': randomUUID() },
              ),
            ),
          );
          assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409]);
          trip = (
            (await (
              await call(`/trips/${trip.id}`, 'GET', undefined, cookieA)
            ).json()) as { data: { trip: TripDto } }
          ).data.trip;
          assert.equal(trip.revision, 1);
          assert.equal(
            await product.trips.models.Revision.countDocuments({
              tripId: trip.id,
            }),
            2,
          );
        },
      );
      await t.test(
        'real audit insert failure rolls back trip/revision/key, retry then commits',
        async () => {
          const collection = connection.db!.collection('audit_logs');
          const existing = await collection.findOne({ entityId: trip.id });
          assert.ok(existing);
          await collection.createIndex(
            { requestId: 1 },
            { name: 'test_only_audit_failure', unique: true },
          );
          const patch = {
            trip: { ...input, title: 'After safe retry' },
            expectedRevision: trip.revision,
          };
          const retryKey = randomUUID();
          try {
            const failed = await call(
              `/trips/${trip.id}`,
              'PATCH',
              patch,
              cookieA,
              {
                'Idempotency-Key': retryKey,
                'X-Request-Id': String(existing.requestId),
              },
            );
            assert.equal(failed.status, 500);
            const after = await product.trips.models.Trip.findById(trip.id);
            assert.equal(after?.revision, trip.revision);
            assert.equal(after?.title, trip.title);
            assert.equal(
              await product.trips.models.Revision.countDocuments({
                tripId: trip.id,
              }),
              2,
            );
            assert.equal(
              await product.trips.models.Key.countDocuments({ key: retryKey }),
              0,
            );
          } finally {
            await collection.dropIndex('test_only_audit_failure');
          }
          assert.equal(
            (
              await call(`/trips/${trip.id}`, 'PATCH', patch, cookieA, {
                'Idempotency-Key': retryKey,
              })
            ).status,
            200,
          );
        },
      );
      await t.test(
        'logout/relogin and fresh API connection read the same persisted trip',
        async () => {
          const previousCookie = cookieA;
          assert.equal(
            (await call('/auth/logout', 'POST', {}, cookieA)).status,
            200,
          );
          assert.equal(
            (await call(`/trips/${trip.id}`, 'GET', undefined, previousCookie))
              .status,
            401,
          );
          const response = await call('/auth/login', 'POST', {
            email: emailA,
            password,
          });
          assert.equal(response.status, 200);
          cookieA = response.headers.get('set-cookie')!.split(';')[0]!;
          const other = await mongoose
            .createConnection(config.MONGODB_URI, {
              autoCreate: false,
              autoIndex: false,
            })
            .asPromise();
          try {
            const fresh = createProduct(other, config);
            await fresh.initialize();
            const owner = await fresh.auth.models.User.findOne({
              emailNormalized: emailA,
            });
            assert.ok(owner);
            const restored = await fresh.trips.read(trip.id, owner._id);
            assert.equal(restored.trip.title, 'After safe retry');
            assert.equal(
              restored.trip.days[0]?.activities[0]?.activityId,
              input.days[0]?.activities[0]?.activityId,
            );
            const production = createProduct(
              await mongoose
                .createConnection(config.MONGODB_URI, {
                  autoCreate: false,
                  autoIndex: false,
                })
                .asPromise(),
              { ...config, NODE_ENV: 'production' },
            );
            try {
              await assert.rejects(production.auth.mailbox.list());
              await production.initialize();
              const productionApp = createApp(
                { ...config, NODE_ENV: 'production' },
                async () => {},
                createLogger('test', () => {}),
                production.router,
              );
              const productionServer = productionApp.listen(0, '127.0.0.1');
              await once(productionServer, 'listening');
              const productionBase = `http://127.0.0.1:${(productionServer.address() as AddressInfo).port}/api/v1`;
              try {
                assert.equal(
                  (
                    await fetch(productionBase + '/dev/mailbox', {
                      headers: { 'X-GoEase-Client': 'web' },
                    })
                  ).status,
                  404,
                );
                const me = (await (
                  await fetch(productionBase + '/auth/me', {
                    headers: { Cookie: cookieA },
                  })
                ).json()) as { data: { user: unknown } };
                assert.equal(me.data.user, null);
                assert.equal(
                  (
                    await fetch(productionBase + '/auth/login', {
                      method: 'POST',
                      headers: {
                        Origin: config.CLIENT_ORIGIN,
                        'X-GoEase-Client': 'web',
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({ email: emailA, password }),
                    })
                  ).status,
                  503,
                );
              } finally {
                await new Promise<void>((resolve) =>
                  productionServer.close(() => resolve()),
                );
              }
            } finally {
              await production.auth.models.User.db.close();
            }
          } finally {
            await other.close();
          }
        },
      );
      await t.test(
        'idle expiry and securityVersion invalidate sessions before TTL; logs/audit exclude secrets',
        async () => {
          await product.auth.models.Session.updateMany(
            { revokedAt: null },
            {
              $set: {
                idleExpiresAt: new Date(Date.now() - 1000),
                expiresAt: new Date(Date.now() + 60000),
              },
            },
          );
          assert.equal(
            (await call(`/trips/${trip.id}`, 'GET', undefined, cookieA)).status,
            401,
          );
          const again = await call('/auth/login', 'POST', {
            email: emailA,
            password,
          });
          assert.equal(again.status, 200);
          const freshCookie = again.headers.get('set-cookie')!.split(';')[0]!;
          await product.auth.models.User.updateOne(
            { emailNormalized: emailA },
            { $inc: { securityVersion: 1 } },
          );
          assert.equal(
            (await call(`/trips/${trip.id}`, 'GET', undefined, freshCookie))
              .status,
            401,
          );
          const output =
            logs.join('') +
            JSON.stringify(
              await connection.db!.collection('audit_logs').find().toArray(),
            );
          for (const value of [
            password,
            emailA,
            emailB,
            input.notes,
            input.days[0]!.activities[0]!.notes,
          ])
            assert.ok(!output.includes(value));
          assert.ok(logs.every((line) => JSON.parse(line).requestId));
        },
      );
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await harness.stop();
    }
  },
);
