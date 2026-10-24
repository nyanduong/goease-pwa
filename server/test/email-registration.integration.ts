import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';
import { verify } from '@node-rs/argon2';
import type { RegistrationPending, UserDto } from '@goease/contracts';
import { createApp } from '../src/app.js';
import { parseConfig } from '../src/config.js';
import { createProduct } from '../src/product.js';
import { createLogger } from '../src/observability/logger.js';
import { tokenHash } from '../src/features/auth/security.js';
import { emailRegistration } from '../src/features/auth/email-registration.js';
import type { RegistrationEmail } from '../src/features/auth/registration-email.js';
import { startTestReplicaSet } from './support/replica-set.js';

test(
  'email registration: real HTTP and owned MongoDB, injected SMTP only',
  { timeout: 90000 },
  async (t) => {
    const harness = await startTestReplicaSet();
    const config = parseConfig({
      NODE_ENV: 'test',
      CLIENT_ORIGIN: 'http://localhost:5180',
      MONGODB_URI: `mongodb://127.0.0.1:27021/${harness.connection.name}?replicaSet=${harness.setName}`,
      REGISTRATION_OTP_REQUIRED: 'true',
      AUTH_MAX_ATTEMPTS: '100',
    });
    const sent: RegistrationEmail[] = [],
      logs: string[] = [];
    let fail = false;
    const sender = {
      configured: true,
      async send(message: RegistrationEmail) {
        sent.push(message);
        if (fail) throw new Error('PRIVATE_SMTP_FAILURE');
      },
    };
    const logger = createLogger('test', (value) => logs.push(value));
    const product = createProduct(harness.connection, config, {
      registrationEmail: sender,
      logger,
    });
    await product.initialize();
    const server = createApp(
      config,
      async () => {},
      logger,
      product.router,
    ).listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
    const call = (
      path: string,
      body?: unknown,
      cookie = '',
      origin = config.CLIENT_ORIGIN,
    ) =>
      fetch(base + path, {
        method: body ? 'POST' : 'GET',
        headers: {
          Origin: origin,
          'X-GoEase-Client': 'web',
          'Content-Type': 'application/json',
          Cookie: cookie,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    const password = 'Registration-password-2026';
    const credentials = (email: string) => ({
      email,
      password,
      displayName: 'Người kiểm thử',
    });
    const request = (email: string) =>
      call('/auth/register', credentials(email));
    const data = async <T>(response: Response) =>
      ((await response.json()) as { data: T }).data;
    const confirm = (pending: RegistrationPending, code = sent.at(-1)!.code) =>
      call('/auth/registration/verify', { challenge: pending.challenge, code });
    const issue = async (email: string) => {
      const response = await request(email);
      assert.equal(response.status, 202);
      assert.equal(response.headers.get('set-cookie'), null);
      return data<RegistrationPending>(response);
    };
    const { User, Identity, Session, Challenge } = product.auth.models;
    const allowResend = (email: string) =>
      Challenge.updateOne(
        { targetEmailNormalized: email },
        {
          $set: {
            'context.registrationRequestedAt': new Date(Date.now() - 61000),
          },
        },
      );
    try {
      await t.test(
        'pending has no account/session; verification creates verified account, cookie and audit atomically',
        async () => {
          const email = 'otp-success@example.invalid',
            pending = await issue(email);
          assert.match(sent.at(-1)!.code, /^\d{6}$/);
          assert.equal(sent.at(-1)!.minutes, 10);
          assert.equal(await User.countDocuments(), 0);
          assert.equal(await Identity.countDocuments(), 0);
          assert.equal(await Session.countDocuments(), 0);
          const raw = await harness.connection
            .collection('auth_challenges')
            .findOne({ tokenHash: tokenHash(pending.challenge) });
          assert.equal(
            raw!.context.registrationOtpHash,
            tokenHash(`${pending.challenge}:${sent.at(-1)!.code}`),
          );
          assert.equal(
            await verify(raw!.context.registrationPasswordHash, password),
            true,
          );
          assert.equal(JSON.stringify(raw).includes(pending.challenge), false);
          assert.equal(JSON.stringify(raw).includes(password), false);
          assert.equal(
            (await call('/auth/login', { email, password })).status,
            401,
          );
          const response = await confirm(pending);
          assert.equal(response.status, 201);
          assert.equal(
            (await data<{ user: UserDto }>(response)).user.emailVerified,
            true,
          );
          const cookie = response.headers.get('set-cookie')!;
          assert.match(cookie, /HttpOnly/);
          const me = await call('/auth/me', undefined, cookie.split(';')[0]);
          assert.equal(
            (await data<{ user: UserDto }>(me)).user.emailVerified,
            true,
          );
          assert.equal(
            (await call('/auth/login', { email, password })).status,
            200,
          );
          assert.equal((await confirm(pending)).status, 400);
          assert.equal((await request(email)).status, 409);
          const consumed = await harness.connection
            .collection('auth_challenges')
            .findOne({ tokenHash: tokenHash(pending.challenge) });
          assert.ok(consumed!.consumedAt);
          assert.equal(consumed!.context.registrationPasswordHash, undefined);
          assert.equal(consumed!.context.registrationOtpHash, undefined);
          assert.equal(consumed!.context.registrationDisplayName, undefined);
          assert.equal(
            await harness.connection
              .collection('audit_logs')
              .countDocuments({ action: 'auth.email_verified' }),
            1,
          );
        },
      );
      await t.test(
        'durable five-attempt cap, including after a service restart',
        async () => {
          const email = 'otp-cap@example.invalid',
            pending = await issue(email);
          const code = sent.at(-1)!.code,
            wrong = code === '000000' ? '000001' : '000000';
          for (let i = 0; i < 5; i++)
            assert.equal((await confirm(pending, wrong)).status, 400);
          const restarted = emailRegistration(
            harness.connection,
            config,
            product.auth,
            sender,
            logger,
          );
          const fakeRequest = {
            socket: { remoteAddress: '127.0.0.1' },
          } as Parameters<typeof restarted.verify>[0];
          await assert.rejects(
            restarted.verify(fakeRequest, {
              challenge: pending.challenge,
              code,
            }),
            /Mã không đúng/,
          );
          assert.equal(
            (await Challenge.findOne({
              tokenHash: tokenHash(pending.challenge),
            }))!.attemptCount,
            5,
          );
          assert.equal(
            await User.countDocuments({ emailNormalized: email }),
            0,
          );
        },
      );
      await t.test(
        'expiry and wrong browser binding cannot create an account',
        async () => {
          const pending = await issue('otp-expiry@example.invalid');
          assert.equal(
            (await confirm({ ...pending, challenge: 'X'.repeat(43) })).status,
            400,
          );
          await Challenge.updateOne(
            { tokenHash: tokenHash(pending.challenge) },
            { $set: { expiresAt: new Date(Date.now() - 1000) } },
          );
          assert.equal((await confirm(pending)).status, 400);
        },
      );
      await t.test(
        'resend waits sixty seconds, rotates binding, and invalidates previous code',
        async () => {
          const email = 'otp-resend@example.invalid',
            old = await issue(email),
            oldCode = sent.at(-1)!.code;
          const count = sent.length;
          assert.equal((await request(email)).status, 429);
          assert.equal(sent.length, count);
          await allowResend(email);
          const next = await issue(email),
            nextCode = sent.at(-1)!.code;
          assert.notEqual(next.challenge, old.challenge);
          assert.equal((await confirm(old, oldCode)).status, 400);
          assert.equal((await confirm(next, nextCode)).status, 201);
        },
      );
      await t.test(
        'concurrent issuance sends one mail; concurrent consumes create one user/session',
        async () => {
          const email = 'otp-race@example.invalid',
            before = sent.length;
          const responses = await Promise.all([request(email), request(email)]);
          assert.deepEqual(responses.map((r) => r.status).sort(), [202, 429]);
          assert.equal(sent.length, before + 1);
          const pending = await data<RegistrationPending>(
            responses.find((r) => r.status === 202)!,
          );
          const code = sent.at(-1)!.code;
          const confirmed = await Promise.all([
            confirm(pending, code),
            confirm(pending, code),
          ]);
          assert.deepEqual(confirmed.map((r) => r.status).sort(), [201, 400]);
          const user = (await User.findOne({ emailNormalized: email }))!;
          assert.equal(await Session.countDocuments({ userId: user._id }), 1);
        },
      );
      await t.test(
        'SMTP rejection revokes pending code, never creates a user or pretends success',
        async () => {
          fail = true;
          const email = 'otp-fail@example.invalid';
          const response = await request(email);
          fail = false;
          assert.equal(response.status, 503);
          assert.equal(response.headers.get('set-cookie'), null);
          assert.equal(
            await User.countDocuments({ emailNormalized: email }),
            0,
          );
          const challenge = (await Challenge.findOne({
            targetEmailNormalized: email,
          }))!;
          assert.ok(challenge.revokedAt);
          assert.equal(challenge.context.deliveryState, 'failed');
        },
      );
      await t.test(
        'missing SMTP gives 503 with no fallback; input overposting and cross-origin requests rejected',
        async () => {
          sender.configured = false;
          assert.equal(
            (await request('otp-unavailable@example.invalid')).status,
            503,
          );
          sender.configured = true;
          assert.equal(
            (
              await call('/auth/register', {
                ...credentials('overpost@example.invalid'),
                emailVerified: true,
              })
            ).status,
            400,
          );
          assert.equal(
            (
              await call(
                '/auth/register',
                credentials('origin@example.invalid'),
                '',
                'https://evil.invalid',
              )
            ).status,
            403,
          );
          assert.equal(
            (
              await call('/auth/registration/verify', {
                challenge: 'X'.repeat(43),
                code: '123456',
                userId: 'injected',
              })
            ).status,
            400,
          );
        },
      );
      await t.test(
        'audit failure rolls back user/identity/session and consumption; retry succeeds',
        async () => {
          const email = 'otp-rollback@example.invalid',
            pending = await issue(email),
            code = sent.at(-1)!.code;
          // Test-only validator rejects verification audit inside the same transaction.
          await harness.connection.db!.command({
            collMod: 'audit_logs',
            validator: { action: { $ne: 'auth.email_verified' } },
            validationLevel: 'strict',
          });
          try {
            assert.equal((await confirm(pending, code)).status, 500);
            assert.equal(
              await User.countDocuments({ emailNormalized: email }),
              0,
            );
            assert.equal(
              await Identity.countDocuments({ loginEmailNormalized: email }),
              0,
            );
            assert.equal(
              (await Challenge.findOne({
                tokenHash: tokenHash(pending.challenge),
              }))!.consumedAt,
              null,
            );
          } finally {
            await harness.connection.db!.command({
              collMod: 'audit_logs',
              validator: {},
              validationLevel: 'off',
            });
          }
          assert.equal((await confirm(pending, code)).status, 201);
        },
      );
      await t.test(
        'OTP, password, binding and raw mail failures stay out of logs/audit',
        async () => {
          const audit = JSON.stringify(
            await harness.connection
              .collection('audit_logs')
              .find({})
              .toArray(),
          );
          const output = logs.join('\n') + audit;
          assert.equal(output.includes(password), false);
          assert.equal(output.includes('PRIVATE_SMTP_FAILURE'), false);
          assert.equal(output.includes('otp-success@example.invalid'), false);
          for (const mail of sent)
            assert.equal(output.includes(`"${mail.code}"`), false);
          assert.equal(output.includes('registrationPasswordHash'), false);
        },
      );
      await t.test(
        'fifth correct attempt works and explicit rollout-off keeps legacy contract',
        async () => {
          const pending = await issue('otp-last-attempt@example.invalid'),
            code = sent.at(-1)!.code;
          const wrong = code === '000000' ? '000001' : '000000';
          for (let i = 0; i < 4; i++)
            assert.equal((await confirm(pending, wrong)).status, 400);
          assert.equal((await confirm(pending, code)).status, 201);
          config.REGISTRATION_OTP_REQUIRED = false;
          try {
            assert.equal((await confirm(pending, code)).status, 409);
            const response = await request(
              'legacy-after-rollout@example.invalid',
            );
            assert.equal(response.status, 201);
            assert.equal(
              (await data<{ user: UserDto }>(response)).user.emailVerified,
              false,
            );
          } finally {
            config.REGISTRATION_OTP_REQUIRED = true;
          }
        },
      );
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await harness.stop();
    }
  },
);
