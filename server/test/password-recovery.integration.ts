import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';
import { resetRequestMessage } from '@goease/contracts';
import type { ResetEmail } from '../src/features/auth/reset-email.js';
import { tokenHash } from '../src/features/auth/security.js';
import { createApp } from '../src/app.js';
import { createProduct } from '../src/product.js';
import { parseConfig } from '../src/config.js';
import { createLogger } from '../src/observability/logger.js';
import { seedDestinations } from '../src/features/trips/destination-seed.js';
import { startTestReplicaSet } from './support/replica-set.js';

test(
  'password recovery with injected mail delivery: expiry single-use races and revocation',
  { timeout: 90000 },
  async (t) => {
    const harness = await startTestReplicaSet();
    const config = parseConfig({
      NODE_ENV: 'development',
      CLIENT_ORIGIN: 'http://localhost:5180',
      MONGODB_URI: `mongodb://127.0.0.1:27021/${harness.connection.name}?replicaSet=${harness.setName}`,
      AUTH_MAX_ATTEMPTS: '100',
    });
    const sent: ResetEmail[] = [];
    const logs: string[] = [];
    let fail = false;
    const sender = {
      configured: true,
      send: async (message: ResetEmail) => {
        sent.push(message);
        if (fail) throw new Error('PRIVATE_SMTP_SECRET');
      },
    };
    const logger = createLogger('test', (v) => logs.push(v));
    const product = createProduct(harness.connection, config, {
      resetEmail: sender,
      logger,
    });
    await product.initialize();
    await seedDestinations(product.trips.models.Destination);
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
      const email = 'recovery-a@example.invalid',
        password = 'Recovery-old-password-2026';
      const register = async (address: string) => {
        const r = await call('/auth/register', 'POST', {
          email: address,
          password,
          displayName: 'Recovery test',
        });
        assert.equal(r.status, 201);
        return r.headers.get('set-cookie')!.split(';')[0]!;
      };
      const a = await register(email),
        b = await register('recovery-b@example.invalid');
      const login = async (value: string) =>
        call('/auth/login', 'POST', { email, password: value });
      const second = (await login(password)).headers
        .get('set-cookie')!
        .split(';')[0]!;
      const user = (await product.auth.models.User.findOne({
        emailNormalized: email,
      }))!;
      const identity = (await product.auth.models.Identity.findOne({
        userId: user._id,
        provider: 'password',
      }))!;
      const { Challenge, User, Session } = product.auth.models;
      const request = async (address = email) => {
        const response = await call('/auth/forgot-password', 'POST', {
          email: address,
        });
        await product.recovery.waitForDeliveries();
        return response;
      };
      const token = () => new URL(sent.at(-1)!.url).hash.slice(1);
      const reset = (
        value: string,
        newPassword = 'Recovery-new-password-2026',
        reqId: string = randomUUID(),
      ) =>
        call(
          '/auth/reset-password',
          'POST',
          { token: value, newPassword },
          '',
          randomUUID(),
          reqId,
        );
      const allowNext = () =>
        harness.connection
          .collection('auth_challenges')
          .updateMany(
            { userId: user._id },
            { $set: { createdAt: new Date(Date.now() - 61000) } },
          );
      const issue = async () => {
        await allowNext();
        assert.equal((await request()).status, 202);
        return token();
      };
      let liveToken = '';
      await t.test(
        'same response for known unknown Google-only locked accounts; cooldown and strict input',
        async () => {
          assert.equal(
            (
              await call('/auth/forgot-password', 'POST', {
                email,
                userId: String(user._id),
              })
            ).status,
            400,
          );
          const good = await request();
          assert.equal(good.status, 202);
          assert.deepEqual(await good.json(), {
            ok: true,
            data: { accepted: true, message: resetRequestMessage },
          });
          liveToken = token();
          assert.match(liveToken, /^[a-zA-Z0-9_-]{43}$/);
          assert.equal(sent[0]!.to, email);
          assert.equal(sent[0]!.minutes, 15);
          assert.equal(new URL(sent[0]!.url).origin, config.CLIENT_ORIGIN);
          const unknown = await request('unknown@example.invalid');
          assert.deepEqual(await unknown.json(), {
            ok: true,
            data: { accepted: true, message: resetRequestMessage },
          });
          assert.equal((await request()).status, 202);
          assert.equal(sent.length, 1);
          await product.auth.models.Identity.updateOne(
            { loginEmailNormalized: 'recovery-b@example.invalid' },
            {
              $set: {
                provider: 'google',
                issuer: 'https://accounts.google.com',
                providerSubject: 'fixture-google',
              },
            },
          );
          assert.equal(
            (await request('recovery-b@example.invalid')).status,
            202,
          );
          assert.equal(sent.length, 1);
          await User.updateOne(
            { _id: user._id },
            { $set: { status: 'suspended' } },
          );
          assert.equal((await request()).status, 202);
          assert.equal(sent.length, 1);
          await User.updateOne(
            { _id: user._id },
            { $set: { status: 'active' } },
          );
          const challenge = await Challenge.findOne({
            userId: user._id,
          }).select('+tokenHash');
          assert.equal(challenge!.tokenHash, tokenHash(liveToken));
          assert.equal(JSON.stringify(challenge).includes(liveToken), false);
          assert.equal(challenge!.context.deliveryState, 'sent');
          assert.equal(
            (await call('/me/profile', 'GET', undefined, a)).status,
            200,
          );
        },
      );
      await t.test(
        'atomic single use across concurrent resets; all old sessions revoked and password works',
        async () => {
          const results = await Promise.all([
            reset(liveToken),
            reset(liveToken),
          ]);
          assert.deepEqual(results.map((r) => r.status).sort(), [200, 400]);
          assert.equal((await reset(liveToken)).status, 400);
          assert.equal(
            (await call('/me/profile', 'GET', undefined, a)).status,
            401,
          );
          assert.equal(
            (await call('/me/profile', 'GET', undefined, second)).status,
            401,
          );
          assert.equal((await login(password)).status, 401);
          assert.equal((await login('Recovery-new-password-2026')).status, 200);
          assert.equal(
            await Session.countDocuments({
              userId: user._id,
              revocationReason: 'password_reset',
            }),
            2,
          );
          assert.equal(
            await harness.connection
              .collection('audit_logs')
              .countDocuments({ action: 'password.reset' }),
            1,
          );
          assert.equal((await User.findById(user._id))!.emailVerifiedAt, null);
        },
      );
      await t.test(
        'expired pending revoked wrong-purpose and superseded-security-version tokens rejected',
        async () => {
          const expired = await issue();
          await Challenge.updateOne(
            { tokenHash: tokenHash(expired) },
            { $set: { expiresAt: new Date(0) } },
          );
          assert.equal((await reset(expired)).status, 400);
          const pending = await issue();
          await Challenge.updateOne(
            { tokenHash: tokenHash(pending) },
            { $set: { 'context.deliveryState': 'pending' } },
          );
          assert.equal((await reset(pending)).status, 400);
          const newer = await issue();
          assert.equal((await reset(pending)).status, 400);
          await Challenge.updateOne(
            { tokenHash: tokenHash(newer) },
            { $set: { purpose: 'oauth_state' } },
          );
          assert.equal((await reset(newer)).status, 400);
          const stale = await issue();
          const session = (await login('Recovery-new-password-2026')).headers
            .get('set-cookie')!
            .split(';')[0]!;
          assert.equal(
            (
              await call(
                '/me/password',
                'POST',
                {
                  currentPassword: 'Recovery-new-password-2026',
                  newPassword: 'Changed-in-account-2026',
                },
                session,
              )
            ).status,
            200,
          );
          assert.equal((await reset(stale)).status, 400);
          assert.equal((await reset('x'.repeat(43))).status, 400);
          assert.equal(
            (
              await call('/auth/reset-password', 'POST', {
                token: stale,
                newPassword: 'short',
              })
            ).status,
            400,
          );
        },
      );
      await t.test(
        'delivery failure revokes token, no unavailable configuration success, no secrets in logs',
        async () => {
          fail = true;
          const failed = await issue();
          assert.equal((await reset(failed)).status, 400);
          const record = await Challenge.findOne({
            tokenHash: tokenHash(failed),
          });
          assert.equal(record!.context.deliveryState, 'failed');
          assert.ok(record!.revokedAt);
          assert.ok(logs.join('').includes('email.reset_failed'));
          sender.configured = false;
          assert.equal((await request()).status, 503);
          assert.equal((await request('missing@example.invalid')).status, 503);
          sender.configured = true;
          fail = false;
          const auditText = JSON.stringify(
            await harness.connection
              .collection('audit_logs')
              .find({})
              .toArray(),
          );
          for (const secret of [
            email,
            password,
            'PRIVATE_SMTP_SECRET',
            ...sent.map((v) => new URL(v.url).hash.slice(1)),
          ])
            assert.equal((logs.join('') + auditText).includes(secret), false);
        },
      );
      await t.test(
        'audit failure rolls back consume password and session revocation; retry then succeeds',
        async () => {
          const current = (await login('Changed-in-account-2026')).headers
            .get('set-cookie')!
            .split(';')[0]!;
          const link = await issue();
          const audit = harness.connection.collection('audit_logs');
          const existing = (await audit.findOne({ action: 'password.reset' }))!;
          const reqId = existing.requestId as string;
          await audit.createIndex(
            { requestId: 1 },
            {
              unique: true,
              partialFilterExpression: { requestId: reqId },
              name: 'recovery_failure',
            },
          );
          try {
            assert.equal(
              (await reset(link, 'Final-recovered-password-2026', reqId))
                .status,
              500,
            );
            assert.equal(
              (await Challenge.findOne({ tokenHash: tokenHash(link) }))!
                .consumedAt,
              null,
            );
            assert.equal(
              (await call('/me/profile', 'GET', undefined, current)).status,
              200,
            );
            assert.equal((await login('Changed-in-account-2026')).status, 200);
          } finally {
            await audit.dropIndex('recovery_failure');
          }
          assert.equal(
            (await reset(link, 'Final-recovered-password-2026')).status,
            200,
          );
          assert.equal(
            (await login('Final-recovered-password-2026')).status,
            200,
          );
          assert.equal(
            (await call('/me/profile', 'GET', undefined, current)).status,
            401,
          );
        },
      );
      await t.test(
        'issuance race sends one message; reset cannot target another identity or suspended account',
        async () => {
          await allowNext();
          const before = sent.length;
          const requests = await Promise.all([request(), request()]);
          requests.forEach((r) => assert.equal(r.status, 202));
          assert.equal(sent.length, before + 1);
          const link = token();
          await User.updateOne(
            { _id: user._id },
            { $set: { status: 'suspended' } },
          );
          assert.equal((await reset(link)).status, 400);
          await User.updateOne(
            { _id: user._id },
            { $set: { status: 'active' } },
          );
          const other = (await product.auth.models.Identity.findOne({
            userId: { $ne: user._id },
          }))!;
          await Challenge.updateOne(
            { tokenHash: tokenHash(link) },
            { $set: { 'context.identityId': other._id } },
          );
          assert.equal((await reset(link)).status, 400);
          await Challenge.updateOne(
            { tokenHash: tokenHash(link) },
            { $set: { 'context.identityId': identity._id } },
          );
          assert.equal((await reset(link)).status, 200);
          // Other account remains intact; this cookie is Google fixture linked to the same identity.
          assert.equal(
            (await call('/me/profile', 'GET', undefined, b)).status,
            200,
          );
        },
      );
    } finally {
      await product.recovery.drain();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await harness.stop();
    }
  },
);
