import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { parseConfig } from '../src/config.js';
import { plannerProvider } from '../src/features/ai/gemini.js';
import { HttpError } from '../src/http-error.js';

const env = {
  CLIENT_ORIGIN: 'http://localhost:5180',
  MONGODB_URI: 'mongodb://localhost/test',
  AI_PROVIDER: 'fulldichvu',
  FULLDICHVU_API_KEY: 'test-only-full-key',
  GEMINI_API_KEY: 'test-only-google-key',
};
const config = parseConfig(env);
const plan = {
  days: [
    {
      date: '2026-11-12',
      stops: [
        { placeId: '100000000000000000000001', start: '09:00', end: '11:00' },
      ],
    },
  ],
};
const completion = (content: string, finish_reason = 'stop') => ({
  choices: [{ finish_reason, message: { content } }],
});

test('ranking deduplicates repeated venues in preference order before schedule validation', async () => {
  const ids = [1, 2, 3, 4, 5].map((n) => `10000000000000000000000${n}`);
  const stub = mock.method(globalThis, 'fetch', async () =>
    Response.json(
      completion(JSON.stringify({ placeIds: [...ids, ids[1], ids[2]] })),
    ),
  );
  try {
    assert.deepEqual(await plannerProvider(config)({ selectionOnly: true }), {
      placeIds: ids,
    });
    assert.equal(stub.mock.callCount(), 1);
  } finally {
    stub.mock.restore();
  }
});

test('ranking uses request-local short references and rejects invented references without guessing', async () => {
  const ids = [1, 2, 3, 4].map((n) => `10000000000000000000000${n}`);
  for (const unknown of [false, true]) {
    const stub = mock.method(
      globalThis,
      'fetch',
      async (_url: unknown, init?: RequestInit) => {
        const payload = JSON.parse(
          JSON.parse(String(init?.body)).messages[1].content,
        );
        assert.deepEqual(
          payload.catalog.map((p: { id: string }) => p.id),
          ['P01', 'P02', 'P03', 'P04'],
        );
        assert.ok(ids.every((id) => !String(init?.body).includes(id)));
        return Response.json(
          completion(
            JSON.stringify({
              placeIds: ['P03', 'P01', 'P04', unknown ? 'P99' : 'P02', 'P03'],
            }),
          ),
        );
      },
    );
    try {
      const result = plannerProvider(config)({
        selectionOnly: true,
        catalog: ids.map((id) => ({ id, name: 'Public venue' })),
      });
      if (unknown)
        await assert.rejects(
          result,
          (e) => e instanceof HttpError && e.code === 'AI_UNKNOWN_SELECTION',
        );
      else
        assert.deepEqual(await result, {
          placeIds: [ids[2], ids[0], ids[3], ids[1]],
        });
      assert.equal(stub.mock.callCount(), 1);
    } finally {
      stub.mock.restore();
    }
  }
});

test('ranking normalization still rejects malformed IDs, too few unique venues and oversized output', async () => {
  const ids = [1, 2, 3, 4].map((n) => `10000000000000000000000${n}`);
  for (const placeIds of [
    [ids[0], ids[1], ids[2], ids[0]],
    [...ids, 'invalid-id'],
    Array.from({ length: 31 }, (_, i) => ids[i % 4]),
  ]) {
    const stub = mock.method(globalThis, 'fetch', async () =>
      Response.json(completion(JSON.stringify({ placeIds }))),
    );
    try {
      await assert.rejects(
        plannerProvider(config)({ selectionOnly: true }),
        (e) => e instanceof HttpError && e.code === 'AI_INVALID_OUTPUT',
      );
      assert.equal(stub.mock.callCount(), 1);
    } finally {
      stub.mock.restore();
    }
  }
});

test('ranking mode requests IDs only and rejects invented output fields or duplicate IDs', async () => {
  const placeIds = [1, 2, 3, 4].map((n) => `10000000000000000000000${n}`);
  for (const output of [
    { placeIds },
    { placeIds, price: 1000 },
    { placeIds: [placeIds[0], placeIds[0], placeIds[2], placeIds[3]] },
  ]) {
    const stub = mock.method(
      globalThis,
      'fetch',
      async (_url: unknown, init?: RequestInit) => {
        const request = JSON.parse(String(init?.body));
        assert.equal(request.max_tokens, 4096);
        assert.match(
          request.messages[0].content,
          /server handles opening hours/,
        );
        return Response.json(completion(JSON.stringify(output)));
      },
    );
    try {
      const call = plannerProvider(config)({ selectionOnly: true });
      if (!('price' in output) && new Set(output.placeIds).size === 4)
        assert.deepEqual(await call, { placeIds });
      else
        await assert.rejects(
          call,
          (e) => e instanceof HttpError && e.code === 'AI_INVALID_OUTPUT',
        );
    } finally {
      stub.mock.restore();
    }
  }
});

test('FULLDICHVU uses fixed endpoint, separate bearer key, model and strict JSON output', async () => {
  for (const content of [
    JSON.stringify(plan),
    '```json\n' + JSON.stringify(plan) + '\n```',
  ]) {
    const stub = mock.method(
      globalThis,
      'fetch',
      async (url: string | URL | Request, init?: RequestInit) => {
        assert.equal(
          url,
          'https://fulldichvu.com/call-api/v1/chat/completions',
        );
        assert.equal(init?.redirect, 'error');
        assert.equal(
          new Headers(init?.headers).get('Authorization'),
          'Bearer test-only-full-key',
        );
        assert.equal(new Headers(init?.headers).get('x-goog-api-key'), null);
        const body = JSON.parse(String(init?.body));
        assert.equal(body.model, 'fulldichvu/haiku-4.5');
        assert.equal(body.stream, false);
        assert.equal(body.max_tokens, 8192);
        assert.equal(body.messages[0].role, 'system');
        assert.match(body.messages[0].content, /Output JSON only/);
        assert.deepEqual(JSON.parse(body.messages[1].content), { catalog: [] });
        assert.equal(body.response_format, undefined);
        return Response.json(completion(content));
      },
    );
    try {
      assert.deepEqual(await plannerProvider(config)({ catalog: [] }), plan);
      assert.equal(stub.mock.callCount(), 1);
    } finally {
      stub.mock.restore();
    }
  }
});

test('FULLDICHVU failures are sanitized, bounded and never retried through another provider', async () => {
  const cases: [() => Promise<Response>, string][] = [
    [
      async () => new Response('secret-key', { status: 401 }),
      'AI_PROVIDER_REJECTED',
    ],
    [
      async () => new Response('secret-key', { status: 429 }),
      'AI_PROVIDER_REJECTED',
    ],
    [
      async () => new Response('secret-key', { status: 503 }),
      'AI_OUTCOME_UNKNOWN',
    ],
    [
      async () => {
        throw new Error('secret-key');
      },
      'AI_OUTCOME_UNKNOWN',
    ],
    [
      async () => Response.json(completion(JSON.stringify(plan), 'length')),
      'AI_OUTPUT_TRUNCATED',
    ],
    [async () => Response.json(completion('not JSON')), 'AI_INVALID_OUTPUT'],
    [
      async () => Response.json(completion(JSON.stringify({ days: [] }))),
      'AI_INVALID_OUTPUT',
    ],
    [async () => Response.json({ choices: [] }), 'AI_INVALID_OUTPUT'],
    [async () => new Response('x'.repeat(256001)), 'AI_INVALID_OUTPUT'],
  ];
  for (const [reply, code] of cases) {
    const stub = mock.method(globalThis, 'fetch', reply);
    try {
      await assert.rejects(
        plannerProvider(config)({}),
        (e) =>
          e instanceof HttpError &&
          e.code === code &&
          !e.message.includes('secret-key'),
      );
      assert.equal(stub.mock.callCount(), 1);
    } finally {
      stub.mock.restore();
    }
  }
});

test('provider config defaults to Google; invalid provider/model never leaks secrets', () => {
  assert.equal(
    parseConfig({
      CLIENT_ORIGIN: env.CLIENT_ORIGIN,
      MONGODB_URI: env.MONGODB_URI,
    }).AI_PROVIDER,
    'gemini',
  );
  assert.throws(
    () => parseConfig({ ...env, AI_PROVIDER: 'secret-key' }),
    /^Error: Invalid environment: AI_PROVIDER$/,
  );
  assert.throws(
    () => parseConfig({ ...env, FULLDICHVU_MODEL: 'https://secret-key' }),
    /^Error: Invalid environment: FULLDICHVU_MODEL$/,
  );
});
