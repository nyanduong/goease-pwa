import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app.js';
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
