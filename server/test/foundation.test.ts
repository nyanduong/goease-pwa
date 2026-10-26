import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AddressInfo } from 'node:net';
import { Router } from 'express';
import { createApp } from '../src/app.js';
import { authLimiter } from '../src/features/auth/security.js';
import { parseConfig } from '../src/config.js';
import { validateTestUri } from '../scripts/test-database.js';
import {
  apiErrorSchema,
  databaseHealthSchema,
  healthSchema,
} from '@goease/contracts';

test('HTTP liveness, real dependency failure contract, recovery, CORS and safe errors', async () => {
  let available = true;
  const app = createApp(
    { CLIENT_ORIGIN: 'http://localhost:5173' },
    async () => {
      if (!available) throw new Error('mongodb://secret:password@private-host');
    },
  );
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const health = await fetch(`${base}/api/v1/health`, {
      headers: { Origin: 'http://localhost:5173' },
    });
    assert.equal(health.status, 200);
    healthSchema.parse(await health.json());
    assert.equal(
      health.headers.get('access-control-allow-origin'),
      'http://localhost:5173',
    );
    assert.equal(health.headers.get('cache-control'), 'no-store');
    const db = await fetch(`${base}/api/v1/health/db`);
    databaseHealthSchema.parse(await db.json());
    available = false;
    const unavailable = await fetch(`${base}/api/v1/health/db`);
    assert.equal(unavailable.status, 503);
    const failure = apiErrorSchema.parse(await unavailable.json());
    assert.equal(failure.error.code, 'DATABASE_UNAVAILABLE');
    assert.doesNotMatch(
      JSON.stringify(failure),
      /secret|password|private-host/,
    );
    assert.equal((await fetch(`${base}/api/v1/health`)).status, 200);
    available = true;
    assert.equal((await fetch(`${base}/api/v1/health/db`)).status, 200);
    const missing = await fetch(`${base}/missing`);
    assert.equal(missing.status, 404);
    apiErrorSchema.parse(await missing.json());
    const invalid = await fetch(`${base}/api/v1/health`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid',
    });
    assert.equal(invalid.status, 400);
    apiErrorSchema.parse(await invalid.json());
    const large = await fetch(`${base}/api/v1/health`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: 'a'.repeat(17000) }),
    });
    assert.equal(large.status, 413);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('environment validation fails without leaking values', () => {
  const valid = {
    CLIENT_ORIGIN: 'http://localhost:5173',
    MONGODB_URI: 'mongodb://127.0.0.1:27017/goease',
  };
  assert.equal(parseConfig(valid).PORT, 3000);
  for (const env of [
    { ...valid, PORT: 'no' },
    { ...valid, PORT: '65536' },
    { ...valid, CLIENT_ORIGIN: 'http://localhost:5173/path' },
    { ...valid, MONGODB_URI: 'secret-value' },
    {},
  ]) {
    assert.throws(
      () => parseConfig(env),
      (error: unknown) =>
        error instanceof Error &&
        /Invalid environment/.test(error.message) &&
        !error.message.includes('secret-value'),
    );
  }
});

test('Atlas SRV config is accepted without weakening HTTPS or test-database guards', () => {
  const env = {
    NODE_ENV: 'production',
    CLIENT_ORIGIN: 'https://test.example.com',
    MONGODB_URI:
      'mongodb+srv://test-user:test-password@cluster.example.com/goease_test?retryWrites=true&w=majority',
  };
  assert.equal(parseConfig(env).MONGODB_URI, env.MONGODB_URI);
  assert.equal(parseConfig(env).TRUST_PROXY_LOOPBACK, false);
  assert.equal(parseConfig(env).BACKGROUND_WORKERS_ENABLED, true);
  assert.equal(
    parseConfig({ ...env, BACKGROUND_WORKERS_ENABLED: 'false' })
      .BACKGROUND_WORKERS_ENABLED,
    false,
  );
  assert.throws(() =>
    parseConfig({ ...env, BACKGROUND_WORKERS_ENABLED: 'disabled' }),
  );
  assert.equal(
    parseConfig({ ...env, TRUST_PROXY_LOOPBACK: 'true' }).TRUST_PROXY_LOOPBACK,
    true,
  );
  assert.throws(() => parseConfig({ ...env, TRUST_PROXY_LOOPBACK: 'yes' }));
  assert.throws(() =>
    parseConfig({ ...env, CLIENT_ORIGIN: 'http://test.example.com' }),
  );
  assert.throws(() => validateTestUri(env.MONGODB_URI, 'development'));
  assert.throws(
    () =>
      parseConfig({
        ...env,
        MONGODB_URI: 'https://test-user:test-password@cluster.example.com',
      }),
    (error: unknown) =>
      error instanceof Error &&
      error.message === 'Invalid environment: MONGODB_URI',
  );
});

test('proxy client IPs remain isolated and untrusted forwarded headers cannot bypass auth limits', async () => {
  for (const trusted of [false, true]) {
    const router = Router();
    const limit = authLimiter(1, 60);
    let account = 0;
    router.get('/probe', (req, res) => {
      limit(req, `fixture-${account++}@example.com`);
      res.json({ ip: req.ip });
    });
    const app = createApp(
      {
        CLIENT_ORIGIN: 'https://test.example.com',
        TRUST_PROXY_LOOPBACK: trusted,
      },
      async () => {},
      undefined,
      router,
    );
    const server = app.listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1/probe`;
    try {
      assert.equal(
        (await fetch(url, { headers: { 'X-Forwarded-For': '198.51.100.1' } }))
          .status,
        200,
      );
      const second = await fetch(url, {
        headers: { 'X-Forwarded-For': '198.51.100.2' },
      });
      assert.equal(second.status, trusted ? 200 : 429);
      if (trusted) {
        assert.deepEqual(await second.json(), { ip: '198.51.100.2' });
        // Express stops at the first untrusted hop; a prepended fake IP cannot reset the bucket.
        assert.equal(
          (
            await fetch(url, {
              headers: { 'X-Forwarded-For': '203.0.113.99, 198.51.100.2' },
            })
          ).status,
          429,
        );
      }
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }
});

test('database smoke guard refuses application, remote and production targets', () => {
  assert.throws(() =>
    validateTestUri(
      'mongodb://localhost:27019/goease_f0_test',
      'development',
      'mongodb://localhost:27019/goease_f0_test',
    ),
  );
  assert.equal(
    validateTestUri(
      'mongodb://127.0.0.1:27017/goease_f0_test?replicaSet=rs0',
      'development',
    ),
    'mongodb://127.0.0.1:27017/goease_f0_test?replicaSet=rs0',
  );
  for (const uri of [
    undefined,
    'mongodb://127.0.0.1:27017/goease',
    'mongodb://remote:27017/goease_f0_test',
    'mongodb+srv://host/goease_f0_test',
    'mongodb://127.0.0.1:27017/goease_f0_test?authSource=admin',
  ]) {
    assert.throws(() => validateTestUri(uri, 'development'));
  }
  assert.throws(() =>
    validateTestUri('mongodb://localhost:27017/goease_f0_test', 'production'),
  );
});
