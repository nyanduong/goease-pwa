import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mapLocationSchema } from '@goease/contracts';
test('map location contract rejects invalid coordinates and unsafe provenance', () => {
  const point = {
    latitude: 15.9,
    longitude: 108.3,
    precision: 'area',
    label: 'Test area',
    sourceUrl: 'https://www.openstreetmap.org/node/1',
    checkedAt: '2026-10-23',
  };
  assert.ok(mapLocationSchema.safeParse(point).success);
  for (const patch of [
    { latitude: 91 },
    { longitude: -181 },
    { latitude: NaN },
    { longitude: Infinity },
    { sourceUrl: 'javascript:alert(1)' },
    { checkedAt: 'yesterday' },
    { precision: 'entrance' },
    { ownerId: 'spoof' },
  ])
    assert.equal(
      mapLocationSchema.safeParse({ ...point, ...patch }).success,
      false,
    );
});
