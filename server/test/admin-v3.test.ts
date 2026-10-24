import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  campaignInputSchema,
  bulkPreviewSchema,
  adminMapQuerySchema,
  sourceSnapshotSchema,
} from '@goease/contracts';
import {
  evaluateDraftHours,
  initialSourceProvenance,
} from '../src/features/explore/catalog-rules.js';
import { scopeKey } from '../src/features/explore/ingestion-scope.js';
import { geoapifyProvider } from '../src/features/explore/geoapify.js';

test('campaign, map and frozen bulk contracts reject implicit scopes and unbounded page selections', () => {
  assert.throws(() => scopeKey(), /Chọn điểm đến/);
  assert.equal(
    campaignInputSchema.safeParse({ destinationIds: [], group: 'mixed' })
      .success,
    false,
  );
  const destinationId = '000000000000000000000004';
  assert.equal(
    campaignInputSchema.safeParse({
      destinationIds: [destinationId, destinationId],
      group: 'mixed',
    }).success,
    false,
  );
  assert.equal(
    bulkPreviewSchema.safeParse({
      action: 'archive_destination',
      selection: { mode: 'filter', filter: {} },
    }).success,
    false,
  );
  assert.equal(
    bulkPreviewSchema.safeParse({
      action: 'publish',
      selection: { mode: 'filter', filter: { destinationId } },
    }).success,
    true,
  );
  assert.equal(
    adminMapQuerySchema.safeParse({
      west: 110,
      east: 100,
      south: 10,
      north: 20,
    }).success,
    false,
  );
});

test('low-risk evaluator preserves locks and refuses important changes, missing evidence and public auto-apply', () => {
  const previous = sourceSnapshotSchema.parse({
    name: 'Fixture place',
    address: 'Fixture address',
    latitude: 15.88,
    longitude: 108.328,
    category: 'culture',
    venueType: 'place',
    categories: ['tourism.attraction'],
    openingHoursNote: '08:00-18:00',
    closed: null,
    sourceUrl: 'https://example.invalid/place',
  });
  const input = {
    enabled: true,
    publicationStatus: 'draft',
    locks: [],
    currentHours: previous.openingHoursNote,
    previous,
    incoming: { ...previous, openingHoursNote: '09:00-18:00' },
    hasConflict: false,
  };
  assert.equal(evaluateDraftHours(input).eligible, true);
  assert.equal(
    evaluateDraftHours({ ...input, enabled: false }).eligible,
    false,
  );
  assert.equal(
    evaluateDraftHours({ ...input, locks: ['openingHoursNote'] }).eligible,
    false,
  );
  assert.equal(
    evaluateDraftHours({ ...input, publicationStatus: 'published' }).eligible,
    false,
  );
  assert.equal(
    evaluateDraftHours({ ...input, previous: null }).eligible,
    false,
  );
  assert.equal(
    evaluateDraftHours({
      ...input,
      incoming: { ...input.incoming, latitude: 16 },
    }).eligible,
    false,
  );
  assert.equal(
    evaluateDraftHours({
      ...input,
      incoming: { ...input.incoming, openingHoursNote: '' },
    }).eligible,
    false,
  );
  assert.equal(
    evaluateDraftHours({
      ...input,
      currentHours: 'Giờ do người biên tập xác nhận',
    }).eligible,
    false,
  );
  assert.equal(
    evaluateDraftHours({ ...input, hasConflict: true }).eligible,
    false,
  );
});

test('provider cannot silently use a default city', async () => {
  let requested = false;
  const provider = geoapifyProvider('fixture-safe-key', async () => {
    requested = true;
    throw new Error('fixture must never call network');
  });
  await assert.rejects(provider('sights', 50), /Chọn phạm vi/);
  assert.equal(requested, false);
});
test('source receipt is observed while price and editorial estimates remain unknown', () => {
  const fields = initialSourceProvenance(
    {
      name: 'Fixture',
      address: 'Fixture address',
      openingHoursNote: '',
      sourceUrl: 'https://example.invalid/source',
    },
    '2026-10-24T00:00:00.000Z',
  );
  assert.equal(fields.find((p) => p.field === 'name')!.state, 'observed');
  assert.equal(
    fields.find((p) => p.field === 'openingHoursNote')!.state,
    'unknown',
  );
  assert.equal(
    fields.find((p) => p.field === 'referencePrice')!.state,
    'unknown',
  );
  assert.equal(
    fields.find((p) => p.field === 'durationMinutes')!.state,
    'unknown',
  );
  assert.equal(fields.find((p) => p.field === 'description')!.state, 'unknown');
  assert.ok(fields.every((p) => p.verifiedAt === null));
});
