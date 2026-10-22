import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';
import type { AccountDto } from '@goease/contracts';
import { createApp } from '../src/app.js';
import { createProduct } from '../src/product.js';
import { parseConfig } from '../src/config.js';
import { createLogger } from '../src/observability/logger.js';
import { seedDestinations } from '../src/features/trips/destination-seed.js';
import { startTestReplicaSet } from './support/replica-set.js';

test(
  'account profile password ownership retries revocation and rollback',
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
      const a = await register('account-a'),
        b = await register('account-b');

      const read = async (cookie: string) => {
        const r = await call('/me/profile', 'GET', undefined, cookie);
        assert.equal(r.status, 200);
        return ((await r.json()) as { data: AccountDto }).data;
      };
      const original = await read(a),
        other = await read(b);
      const login = async (password: string) =>
        call('/auth/login', 'POST', {
          email: 'account-a@example.invalid',
          password,
        });
      const login2 = await login('Expense-test-only-2026');
      assert.equal(login2.status, 200);
      const second = login2.headers.get('set-cookie')!.split(';')[0]!;
      let profile = original;
      await t.test(
        'profile auth validation revision conflict and same-payload recovery',
        async () => {
          assert.equal((await call('/me/profile')).status, 401);
          assert.equal(
            (
              await call(
                '/me/profile',
                'PATCH',
                {
                  displayName: 'forged',
                  avatarUrl: null,
                  expectedRevision: 0,
                  userId: other.user.id,
                },
                a,
              )
            ).status,
            400,
          );
          const payload = {
            displayName: 'PRIVATE_PROFILE_SENTINEL',
            avatarUrl: 'https://example.com/traveler.png',
            expectedRevision: profile.revision,
          };
          for (let i = 0; i < 2; i++)
            assert.equal(
              (await call('/me/profile', 'PATCH', payload, a)).status,
              200,
            );
          profile = await read(a);
          assert.equal(profile.revision, original.revision + 1);
          assert.equal(profile.user.displayName, payload.displayName);
          assert.equal(
            (await read(b)).user.displayName,
            other.user.displayName,
          );
          assert.equal(
            (
              await call(
                '/me/profile',
                'PATCH',
                { ...payload, displayName: 'Stale' },
                a,
              )
            ).status,
            409,
          );
          assert.equal(
            (
              await call(
                '/me/profile',
                'PATCH',
                {
                  ...payload,
                  avatarUrl: 'http://bad.test',
                  expectedRevision: profile.revision,
                },
                a,
              )
            ).status,
            400,
          );
        },
      );
      const password = 'Changed-secret-only-2026';
      const change = {
        currentPassword: 'Expense-test-only-2026',
        newPassword: password,
      };
      await t.test(
        'wrong old password fails; successful retry preserves current session and revokes others',
        async () => {
          assert.equal(
            (
              await call(
                '/me/password',
                'POST',
                { ...change, currentPassword: 'Wrong-secret-only-2026' },
                a,
              )
            ).status,
            400,
          );
          assert.equal((await read(second)).user.id, original.user.id);
          const key = randomUUID();
          const replies = await Promise.all([
            call('/me/password', 'POST', change, a, key),
            call('/me/password', 'POST', change, a, key),
          ]);
          assert.deepEqual(
            replies.map((r) => r.status),
            [200, 200],
          );
          assert.equal(
            (
              await call(
                '/me/password',
                'POST',
                { ...change, newPassword: 'Different-secret-2026' },
                a,
                key,
              )
            ).status,
            409,
          );
          assert.equal(
            (await call('/me/profile', 'GET', undefined, second)).status,
            401,
          );
          assert.equal((await read(a)).user.id, original.user.id);
          assert.equal((await login('Expense-test-only-2026')).status, 401);
          assert.equal((await login(password)).status, 200);
          const audits = await harness.connection
            .collection('audit_logs')
            .find({ action: 'password.changed' })
            .toArray();
          assert.equal(audits.length, 1);
          const users = await product.auth.models.User.findById(
            original.user.id,
          );
          assert.equal(users?.securityVersion, 2);
        },
      );
      await t.test(
        'audit failures roll back profile and password including revocation',
        async () => {
          const audit = harness.connection.collection('audit_logs');
          const existing = await audit.findOne({ action: 'password.changed' });
          const reqId = existing!.requestId as string;
          await audit.createIndex(
            { requestId: 1 },
            {
              unique: true,
              partialFilterExpression: { requestId: reqId },
              name: 'account_audit_failure',
            },
          );
          const before = await read(a);
          const fresh = await login(password);
          const freshCookie = fresh.headers.get('set-cookie')!.split(';')[0]!;
          try {
            assert.equal(
              (
                await call(
                  '/me/profile',
                  'PATCH',
                  {
                    displayName: 'Should rollback',
                    avatarUrl: null,
                    expectedRevision: before.revision,
                  },
                  a,
                  randomUUID(),
                  reqId,
                )
              ).status,
              500,
            );
            assert.equal(
              (
                await call(
                  '/me/password',
                  'POST',
                  {
                    currentPassword: password,
                    newPassword: 'Rollback-secret-2026',
                  },
                  a,
                  randomUUID(),
                  reqId,
                )
              ).status,
              500,
            );
            assert.equal(
              (await read(a)).user.displayName,
              before.user.displayName,
            );
            assert.equal((await read(freshCookie)).user.id, before.user.id);
            assert.equal((await login(password)).status, 200);
            assert.equal((await login('Rollback-secret-2026')).status, 401);
          } finally {
            await audit.dropIndex('account_audit_failure');
          }
        },
      );
      await t.test(
        'login racing password change cannot leave an old-password session usable',
        async () => {
          const next = 'Concurrent-secret-2026';
          const [changed, logged] = await Promise.all([
            call(
              '/me/password',
              'POST',
              { currentPassword: password, newPassword: next },
              a,
            ),
            login(password),
          ]);
          assert.equal(changed.status, 200);
          assert.ok([200, 401].includes(logged.status));
          if (logged.status === 200) {
            const oldCookie = logged.headers.get('set-cookie')!.split(';')[0]!;
            assert.equal(
              (await call('/me/profile', 'GET', undefined, oldCookie)).status,
              401,
            );
          }
          assert.equal((await login(password)).status, 401);
          assert.equal((await login(next)).status, 200);
          assert.equal((await read(a)).user.id, original.user.id);
        },
      );
      await t.test(
        'Google-only profile editable but password endpoint cannot create credential; logs exclude secrets',
        async () => {
          await product.auth.models.Identity.updateOne(
            { userId: other.user.id },
            {
              $set: {
                provider: 'google',
                issuer: 'https://accounts.google.com',
                providerSubject: 'test-only-subject',
              },
              $unset: { passwordHash: 1, loginEmailNormalized: 1 },
            },
          );
          assert.equal((await read(b)).canChangePassword, false);
          assert.equal(
            (await call('/me/password', 'POST', change, b)).status,
            400,
          );
          const before = await read(a);
          assert.equal(
            (
              await call(
                '/me/profile',
                'PATCH',
                {
                  displayName: before.user.displayName,
                  avatarUrl: null,
                  expectedRevision: before.revision,
                },
                a,
              )
            ).status,
            200,
          );
          assert.equal((await read(a)).user.avatarUrl, null);
          const output =
            logs.join('') +
            JSON.stringify(
              await harness.connection
                .collection('audit_logs')
                .find({})
                .toArray(),
            );
          for (const secret of [
            'PRIVATE_PROFILE_SENTINEL',
            password,
            change.currentPassword,
            'Rollback-secret-2026',
            'https://example.com/traveler.png',
          ])
            assert.equal(output.includes(secret), false);
        },
      );
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await harness.stop();
    }
  },
);
