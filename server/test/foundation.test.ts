import assert from 'node:assert/strict';
import { once } from 'node:events';
import { type AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';
import { apiErrorSchema, healthSchema } from '@goease/contracts';
import { createApp } from '../src/app.js';
import { readConfig } from '../src/config.js';
import type { log } from '../src/logger.js';

const events: Parameters<typeof log>[] = [];
const app = createApp((...entry) => events.push(entry));
let origin: string;
const server = app.listen(0, '127.0.0.1');

before(async () => {
  await once(server, 'listening');
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

test('liveness matches the Traveler contract and carries a server-generated request ID', async () => {
  const headers = { 'X-Request-Id': 'client-supplied-value' };
  const response = await fetch(`${origin}/api/v1/health`, { headers });
  assert.equal(response.status, 200);
  assert.deepEqual(healthSchema.parse(await response.json()), {
    ok: true,
    data: { status: 'up', service: 'goease-api' },
  });
  const requestId = response.headers.get('x-request-id') ?? '';
  assert.match(requestId, /^[0-9a-f-]{36}$/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.ok(
    events.some(
      ([, event, fields]) =>
        event === 'http.completed' &&
        fields?.requestId === requestId &&
        fields.method === 'GET' &&
        fields.statusCode === 200,
    ),
  );

  const second = await fetch(`${origin}/api/v1/health`);
  assert.notEqual(second.headers.get('x-request-id'), requestId);
  await second.body?.cancel();
});

test('database status reports an unconfigured database', async () => {
  const response = await fetch(`${origin}/api/v1/health/db`);
  assert.equal(response.status, 503);
  assert.equal(
    apiErrorSchema.parse(await response.json()).error.code,
    'DATABASE_NOT_CONFIGURED',
  );
});

test('unknown paths and invalid JSON return safe error envelopes', async () => {
  const unknown = await fetch(
    `${origin}/example-private-path?query=example-private-query`,
  );
  assert.equal(unknown.status, 404);
  assert.equal(
    apiErrorSchema.parse(await unknown.json()).error.code,
    'NOT_FOUND',
  );

  const malformed = await fetch(`${origin}/api/v1/health`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{invalid-example-body',
  });
  assert.equal(malformed.status, 400);
  assert.equal(
    apiErrorSchema.parse(await malformed.json()).error.code,
    'INVALID_REQUEST',
  );

  const oversized = await fetch(`${origin}/api/v1/health`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify('x'.repeat(17_000)),
  });
  assert.equal(oversized.status, 413);
  assert.equal(
    apiErrorSchema.parse(await oversized.json()).error.code,
    'PAYLOAD_TOO_LARGE',
  );
  assert.doesNotMatch(
    JSON.stringify(events),
    /example-private|invalid-example|client-supplied/,
  );
});

test('configuration defaults to loopback, validates port boundaries and hides invalid input', () => {
  assert.deepEqual(readConfig({}), { host: 'localhost', port: 3000 });
  assert.equal(readConfig({ GOEASE_API_PORT: '65535' }).port, 65535);
  for (const port of ['', '0', '65536', '1e3', 'example-invalid-value']) {
    assert.throws(
      () => readConfig({ GOEASE_API_PORT: port }),
      /^Error: GOEASE_API_PORT must be an integer between 1 and 65535\.$/,
    );
  }
});
