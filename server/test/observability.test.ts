import assert from 'node:assert/strict';
import { fork, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { test } from 'node:test';
import { createLogger } from '../src/observability/logger.js';
import {
  getRequestContext,
  uuidPattern,
} from '../src/observability/context.js';
import { validateProbe } from '../src/features/audit/audit.service.js';
import { validateIntegrationUri } from './support/replica-set.js';
import { createDatabase } from '../src/database.js';

test(
  'actual application stdout/stderr: IDs, concurrent contexts, nested/query/header/error secrets and F0 envelopes',
  { timeout: 20_000 },
  async () => {
    const secret =
      'F1B_PRIVATE_passwordHash_token_cookie_email@example.invalid_notes';
    const child = fork(
      new URL('./fixtures/logging-child.ts', import.meta.url),
      [],
      {
        execArgv: ['--import', 'tsx'],
        silent: true,
        env: { ...process.env, F1B_TEST_SECRET: secret },
      },
    );
    let stdout = '';
    let stderr = '';
    child.stdout!.on('data', (v: Buffer) => {
      stdout += v.toString();
    });
    child.stderr!.on('data', (v: Buffer) => {
      stderr += v.toString();
    });
    const contexts: {
      before: { requestId: string };
      after: { requestId: string };
    }[] = [];
    const ready = new Promise<number>((resolve, reject) => {
      child.on(
        'message',
        (message: {
          address?: { port: number };
          before?: { requestId: string };
          after?: { requestId: string };
        }) => {
          if (message.address) resolve(message.address.port);
          if (message.before && message.after)
            contexts.push({ before: message.before, after: message.after });
        },
      );
      child.once('error', reject);
      child.once('exit', () =>
        reject(new Error('Logging fixture exited before readiness')),
      );
    });
    const responses: { id: string; status: number }[] = [];
    try {
      const base = `http://127.0.0.1:${await ready}`;
      for (const input of [
        undefined,
        secret,
        'a'.repeat(300),
        `${randomUUID()}, ${randomUUID()}`,
        randomUUID().toUpperCase(),
      ]) {
        const response = await fetch(
          `${base}/api/v1/health?token=${encodeURIComponent(secret)}`,
          {
            headers: input
              ? { 'X-Request-Id': input, 'X-Correlation-Id': secret }
              : {},
          },
        );
        const id = response.headers.get('x-request-id')!;
        assert.match(id, uuidPattern);
        if (input?.length === 36) assert.equal(id, input.toLowerCase());
        else assert.notEqual(id, input);
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), {
          ok: true,
          data: { status: 'up', service: 'goease-api' },
        });
        responses.push({ id, status: response.status });
      }
      const ids = Array.from({ length: 12 }, () => randomUUID());
      await Promise.all(
        ids.map(async (id) => {
          const response = await fetch(
            `${base}/api/v1/health/db?password=${secret}`,
            {
              headers: {
                'X-Request-Id': id,
                'X-Correlation-Id': id,
                Authorization: secret,
                Cookie: secret,
                'X-Actor-Id': secret,
                'X-Role': 'admin',
              },
            },
          );
          assert.equal(response.status, 503);
          assert.equal(response.headers.get('x-request-id'), id);
          assert.deepEqual(await response.json(), {
            ok: false,
            error: {
              code: 'DATABASE_UNAVAILABLE',
              message: 'Database is unavailable. Please retry.',
            },
          });
          responses.push({ id, status: 503 });
        }),
      );
      for (const [path, body, status, headers] of [
        [
          `/missing/${secret}?token=${secret}`,
          JSON.stringify({
            actor: { userId: secret, role: 'admin' },
            password: { nested: secret },
            notes: secret,
          }),
          404,
          {},
        ],
        ['/api/v1/health', `{"password":"${secret}",`, 400, {}],
        [
          '/api/v1/health',
          JSON.stringify({ notes: secret.repeat(500) }),
          413,
          {},
        ],
        [
          '/api/v1/health',
          JSON.stringify({ cause: { token: secret } }),
          500,
          { 'Content-Encoding': 'unsupported' },
        ],
      ] as const) {
        const response = await fetch(`${base}${path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...headers },
          body,
        });
        assert.equal(response.status, status);
        const id = response.headers.get('x-request-id')!;
        assert.match(id, uuidPattern);
        assert.ok(!JSON.stringify(await response.json()).includes(secret));
        responses.push({ id, status });
      }
    } finally {
      const exited = once(child, 'exit');
      child.send('stop');
      await exited;
    }
    assert.equal(stderr, '');
    assert.ok(!stdout.includes(secret));
    const logs = stdout
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    for (const response of responses)
      assert.ok(
        logs.some(
          (v) =>
            v.event === 'http.completed' &&
            v.requestId === response.id &&
            v.statusCode === response.status,
        ),
      );
    assert.ok(logs.some((v) => v.event === 'http.error'));
    assert.ok(
      logs.every((v) =>
        Object.keys(v).every((key) =>
          [
            'timestamp',
            'level',
            'event',
            'service',
            'environment',
            'appVersion',
            'requestId',
            'correlationId',
            'method',
            'route',
            'statusCode',
            'durationMs',
          ].includes(key),
        ),
      ),
    );
    assert.equal(contexts.length, 12);
    assert.equal(new Set(contexts.map((v) => v.before.requestId)).size, 12);
    for (const context of contexts) {
      assert.deepEqual(context.before, context.after);
      assert.deepEqual(Object.keys(context.before).sort(), [
        'correlationId',
        'requestId',
      ]);
    }
    assert.equal(getRequestContext(), undefined);
  },
);

test('logger allowlist, malformed fields, Error/cause and failing sink cannot leak or recurse', () => {
  const lines: string[] = [];
  const logger = createLogger('test', (line) => {
    lines.push(line);
  });
  const secret = 'private_sentinel@example.invalid';
  for (const fields of [
    {
      body: { password: secret, deeper: { token: secret } },
      headers: { Authorization: secret },
      notes: secret,
    },
    new Error(secret, { cause: new Error(secret) }),
    { route: secret },
    { requestId: secret },
    { durationMs: Infinity },
    null,
  ])
    logger.write('http.error', fields);
  assert.equal(lines.length, 6);
  assert.ok(lines.every((line) => !line.includes(secret)));
  for (const line of lines)
    assert.equal(typeof JSON.parse(line).event, 'string');
  let attempts = 0;
  createLogger('test', () => {
    attempts++;
    throw new Error(secret);
  }).write('api.started');
  assert.equal(attempts, 1);
});

test('startup failure output is JSON, never configuration or error text', () => {
  const secret = 'mongodb://private:password@example.invalid/app';
  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', 'src/index.ts'],
    {
      encoding: 'utf8',
      env: { ...process.env, CLIENT_ORIGIN: secret, MONGODB_URI: secret },
    },
  );
  assert.equal(result.status, 1);
  assert.equal(result.stderr, '');
  assert.equal(JSON.parse(result.stdout.trim()).event, 'api.startup_failed');
  assert.ok(!result.stdout.includes(secret));
});

test('database connection errors use fixed JSON codes without URI or raw error', async () => {
  const lines: string[] = [];
  const secret = 'invalid-uri-private@example.invalid';
  const database = createDatabase(
    secret,
    createLogger('test', (line) => {
      lines.push(line);
    }),
  );
  try {
    await database.start();
  } finally {
    await database.close();
  }
  assert.ok(lines.some((line) => JSON.parse(line).event === 'database.retry'));
  assert.ok(lines.every((line) => !line.includes(secret)));
});

test('integration URI and probe validation refuse remote/production/app targets and forged actor', () => {
  const id = 'a'.repeat(32);
  const uri = `mongodb://127.0.0.1:27021/goease_f1b_test_${id}?replicaSet=f1b_${id}`;
  assert.equal(validateIntegrationUri(uri, 'test'), uri);
  assert.throws(() => validateIntegrationUri(uri, 'production'));
  assert.throws(() => validateIntegrationUri(uri, 'test', uri));
  for (const bad of [
    uri.replace('127.0.0.1', 'remote'),
    uri.replace('27021', '27019'),
    uri.replace(`goease_f1b_test_${id}`, 'goease'),
    uri.replace('mongodb://', 'mongodb+srv://'),
    uri + '&authSource=admin',
    uri.replace('127.0.0.1', 'user:secret@127.0.0.1'),
  ])
    assert.throws(() => validateIntegrationUri(bad, 'test'));
  assert.throws(() => validateProbe({ actor: { type: 'user', userId: id } }), {
    message: 'Invalid audit probe',
  });
});
