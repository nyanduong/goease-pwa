import assert from 'node:assert/strict';
import { test } from 'node:test';
import { provinceGeocoder } from '../src/features/explore/province-geocoder.js';

test('province geocoder constrains country, localities, name and response shape', async () => {
  const result = {
    lat: 21.03,
    lon: 105.85,
    country_code: 'vn',
    city: 'Hà Nội',
    result_type: 'city',
  };
  let rows: unknown[] = [result];
  const resolve = provinceGeocoder('fixture-key', async (url) => {
    assert.equal(new URL(String(url)).origin, 'https://api.geoapify.com');
    assert.equal(
      new URL(String(url)).searchParams.get('filter'),
      'countrycode:vn',
    );
    return Response.json({ results: rows });
  });
  assert.deepEqual(await resolve('Hà Nội'), {
    latitude: 21.03,
    longitude: 105.85,
    radiusMeters: 10000,
  });
  for (const invalid of [
    [],
    [result, { ...result, lat: 22.03 }],
    [{ ...result, country_code: 'us' }],
    [{ ...result, city: 'Đà Nẵng' }],
    [{ ...result, result_type: 'amenity' }],
  ]) {
    rows = invalid;
    await assert.rejects(resolve('Hà Nội'), { code: 'AREA_LOOKUP_AMBIGUOUS' });
  }
  rows = [{ ...result, lat: 100 }];
  await assert.rejects(resolve('Hà Nội'), { code: 'AREA_LOOKUP_FAILED' });
});
test('geocoder rejects missing key, oversized/error/secret payloads without leaking provider details', async () => {
  await assert.rejects(provinceGeocoder(undefined)('Hà Nội'), {
    code: 'GEOAPIFY_NOT_CONFIGURED',
  });
  for (const response of [
    new Response('key-is-secret', { status: 403 }),
    new Response('a'.repeat(64001)),
    Response.json({ results: [], secret: 'key-is-secret' }),
  ]) {
    await assert.rejects(
      provinceGeocoder('key-is-secret', async () => response)('Hà Nội'),
      (error) =>
        error instanceof Error && !error.message.includes('key-is-secret'),
    );
  }
});

test('named tourism areas use parent province to exclude namesakes and accept ward labels', async () => {
  let rows = [
    {
      name: 'Hội An',
      city: 'Hội An',
      country_code: 'vn',
      lat: 15.88,
      lon: 108.33,
      result_type: 'city',
      state: 'Thành phố Đà Nẵng',
    },
    {
      name: 'Hội An',
      city: 'Hội An',
      country_code: 'vn',
      lat: 10.43,
      lon: 105.55,
      result_type: 'city',
      state: 'Tỉnh An Giang',
    },
  ];
  const resolve = provinceGeocoder('fixture-key', async () =>
    Response.json({ results: rows }),
  );
  assert.equal((await resolve('Hội An', 'Đà Nẵng')).latitude, 15.88);
  rows = [
    {
      name: 'Phường Sa Pa',
      city: 'Phường Sa Pa',
      country_code: 'vn',
      lat: 22.33,
      lon: 103.84,
      result_type: 'city',
      state: 'Tỉnh Lào Cai',
    },
  ];
  assert.equal((await resolve('Sa Pa', 'Lào Cai')).latitude, 22.33);
  rows.push({ ...rows[0]!, name: 'Sa Pa', lat: 22.333 });
  assert.equal((await resolve('Sa Pa', 'Lào Cai')).latitude, 22.33);
  await assert.rejects(resolve('Sa Pa', 'Đà Nẵng'), {
    code: 'AREA_LOOKUP_AMBIGUOUS',
  });
});
