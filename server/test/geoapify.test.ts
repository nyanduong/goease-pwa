import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  geoapifyProvider,
  normalizeGeoapify,
} from '../src/features/explore/geoapify.js';
import { HttpError } from '../src/http-error.js';
const feature = (
  properties: Record<string, unknown> = {},
  coordinates = [108.328, 15.88],
) => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates },
  properties: {
    place_id: 'fixture-only-1',
    name: 'Quán kiểm thử',
    formatted: 'Hội An',
    categories: ['catering.cafe'],
    country_code: 'vn',
    datasource: {
      sourcename: 'openstreetmap',
      raw: { osm_type: 'n', osm_id: 123 },
    },
    ...properties,
  },
});
const collection = (...features: unknown[]) => ({
  type: 'FeatureCollection',
  features,
});
test('Geoapify fixtures: reject unnamed, invalid coordinates, outside area/country/category; missing data stays unknown', () => {
  const batch = normalizeGeoapify(
    collection(
      feature(),
      feature({ name: undefined }),
      feature({}, [999, 15.88]),
      feature({}, [108.5, 16.1]),
      feature({ country_code: 'us' }),
      feature({ categories: ['commercial.supermarket'] }),
    ),
    'cafe',
  );
  assert.equal(batch.received, 6);
  assert.equal(batch.rejected, 5);
  assert.equal(batch.items.length, 1);
  assert.equal(batch.items[0]!.openingHoursNote, '');
  assert.ok(batch.items[0]!.flags.includes('unknown_price'));
  assert.ok(batch.items[0]!.flags.includes('missing_hours'));
  assert.equal(
    normalizeGeoapify(
      collection(
        feature({
          datasource: {
            sourcename: 'unknown-provider',
            raw: { osm_type: 'n', osm_id: 123 },
          },
        }),
      ),
      'cafe',
    ).items.length,
    0,
  );
  const original = normalizeGeoapify(collection(feature()), 'cafe').items[0]!;
  const moved = normalizeGeoapify(
    collection(feature({ place_id: 'changed-provider-id' }, [108.329, 15.88])),
    'cafe',
  ).items[0]!;
  assert.equal(original.externalId, moved.externalId);
});
test('Geoapify fixtures: OSM compact types produce public permalinks and allowlisted fields', () => {
  for (const [osm_type, path] of [
    ['n', 'node'],
    ['w', 'way'],
    ['r', 'relation'],
  ]) {
    const batch = normalizeGeoapify(
      collection(
        feature({
          datasource: {
            sourcename: 'openstreetmap',
            raw: {
              osm_type,
              osm_id: 123,
              opening_hours: 'Mo-Su 08:00-17:00',
              phone: 'excluded-phone',
            },
          },
          secret: 'excluded',
        }),
      ),
      'cafe',
    );
    assert.equal(
      batch.items[0]!.sourceUrl,
      `https://www.openstreetmap.org/${path}/123`,
    );
    assert.equal(batch.items[0]!.openingHoursNote, 'Mo-Su 08:00-17:00');
    assert.ok(!JSON.stringify(batch).includes('excluded'));
  }
});
test('Geoapify fixtures: fixed provider origin, bounded scope and limit', async () => {
  let calls = 0;
  const get = geoapifyProvider('fixture-secret', async (input, init) => {
    calls++;
    const url = new URL(String(input));
    assert.equal(url.origin, 'https://api.geoapify.com');
    assert.equal(url.pathname, '/v2/places');
    assert.equal(url.searchParams.get('filter'), 'circle:108.328,15.88,5000');
    assert.equal(url.searchParams.get('limit'), '30');
    assert.equal(init?.redirect, 'error');
    return Response.json(collection(feature()));
  });
  await get('cafe', 30);
  assert.equal(calls, 1);
  await assert.rejects(get('cafe', 51));
  assert.equal(calls, 1);
  await assert.rejects(
    geoapifyProvider(undefined, async () => {
      throw new Error('must not call');
    })('cafe', 30),
    (e: unknown) =>
      e instanceof HttpError && e.code === 'GEOAPIFY_NOT_CONFIGURED',
  );
});
test('Geoapify fixtures: provider failure, malformed/oversized output and timeout never leak secrets or succeed', async () => {
  const requests: (typeof fetch)[] = [
    async () => new Response('fixture-secret', { status: 429 }),
    async () => {
      throw new Error('https://api.geoapify.com/?apiKey=fixture-secret');
    },
    async () => new Response('invalid JSON fixture-secret'),
    async () => new Response('x'.repeat(512001)),
    async () =>
      Response.json({
        type: 'FeatureCollection',
        features: new Array(51).fill(feature()),
      }),
  ];
  for (const request of requests)
    await assert.rejects(
      geoapifyProvider('fixture-secret', request)('cafe', 30),
      (e: unknown) =>
        e instanceof HttpError && !String(e).includes('fixture-secret'),
    );
  const empty = await geoapifyProvider('fixture-secret', async () =>
    Response.json(collection()),
  )('cafe', 30);
  assert.equal(empty.items.length, 0);
});
