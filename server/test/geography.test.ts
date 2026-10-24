import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  destinationInputSchema,
  destinationWriteSchema,
  destinationQuerySchema,
  tourismRegions,
  travelRegionOf,
  placeQuerySchema,
  adminSettingsSchema,
} from '@goease/contracts';

test('Vietnam travel taxonomy has eight disjoint areas under three regions; Mekong belongs to South', () => {
  assert.equal(new Set(tourismRegions.map((r) => r.code)).size, 8);
  assert.deepEqual(
    ['north', 'central', 'south'].map(
      (region) => tourismRegions.filter((r) => r.region === region).length,
    ),
    [3, 3, 2],
  );
  assert.equal(travelRegionOf('mekong-delta'), 'south');
  assert.equal(travelRegionOf(null), null);
  assert.equal(travelRegionOf('unknown'), null);
  for (const schema of [destinationQuerySchema, placeQuerySchema]) {
    assert.equal(
      schema.safeParse({ region: 'north', tourismRegion: 'mekong-delta' })
        .success,
      false,
    );
    assert.equal(
      schema.safeParse({ region: 'south', tourismRegion: 'mekong-delta' })
        .success,
      true,
    );
    assert.equal(schema.safeParse({ region: 'unknown' }).success, false);
  }
});

test('national ingestion settings remain bounded at 100 unique destination scopes', () => {
  const region = (n: number) => ({
    destinationId: n.toString(16).padStart(24, '0'),
    latitude: 21,
    longitude: 105,
    radiusMeters: 5000,
    enabled: false,
  });
  const settings = {
    expectedRevision: 0,
    defaultDestinationId: null,
    freshnessDays: 90,
    showQualityAlerts: true,
    autoApplyDraftHours: false,
  };
  assert.ok(
    adminSettingsSchema.safeParse({
      ...settings,
      regions: Array.from({ length: 100 }, (_, n) => region(n + 1)),
    }).success,
  );
  assert.equal(
    adminSettingsSchema.safeParse({
      ...settings,
      regions: Array.from({ length: 101 }, (_, n) => region(n + 1)),
    }).success,
    false,
  );
  assert.equal(
    adminSettingsSchema.safeParse({
      ...settings,
      regions: [region(1), region(1)],
    }).success,
    false,
  );
});
test('destination contracts bound editorial inputs and do not accept forged country, identity or parent region', () => {
  const destination = {
    name: 'Điểm đến fixture',
    slug: 'fixture',
    tourismRegion: 'northwest',
    publicationStatus: 'draft',
  };
  assert.ok(destinationInputSchema.safeParse(destination).success);
  for (const extra of [
    { countryCode: 'TH' },
    { region: 'south' },
    { ownerId: 'forged' },
    { revision: 10 },
    { source: { provider: 'forged' } },
  ])
    assert.equal(
      destinationInputSchema.safeParse({ ...destination, ...extra }).success,
      false,
    );
  for (const invalid of [
    { slug: '../private' },
    { name: 'a'.repeat(101) },
    { tourismRegion: 'mien-tay' },
  ])
    assert.equal(
      destinationInputSchema.safeParse({ ...destination, ...invalid }).success,
      false,
    );
  assert.equal(
    destinationWriteSchema.safeParse({ destination, expectedRevision: -1 })
      .success,
    false,
  );
});
