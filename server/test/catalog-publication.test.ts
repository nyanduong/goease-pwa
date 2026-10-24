import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  adminPlaceInputSchema,
  catalogCapabilities,
  catalogCost,
  catalogQuality,
  catalogToday,
  plannerHoursReady,
  type AdminPlaceInput,
} from '@goease/contracts';
import {
  catalogProvenance,
  preserveCatalogLocks,
} from '../src/features/explore/catalog-provenance.js';
import { validatePublicationMigrationUri } from '../src/features/explore/catalog-publication-migration.js';

test('publication migration refuses application, remote, credentialed and production targets', () => {
  const safe =
    'mongodb://127.0.0.1:27021/goease_admin_v3_test_fixture?replicaSet=fixture';
  assert.equal(validatePublicationMigrationUri(safe, 'test'), safe);
  for (const uri of [
    '',
    safe.replace('127.0.0.1', 'db.example.com'),
    safe.replace('goease_admin_v3_test_fixture', 'goease'),
    safe.replace('127.0.0.1', 'user:password@127.0.0.1'),
    safe.replace('?replicaSet=fixture', ''),
  ])
    assert.throws(() => validatePublicationMigrationUri(uri, 'test'));
  assert.throws(() => validatePublicationMigrationUri(safe, 'production'));
});

test('discovery accepts unknown price without turning it into a free or schedulable place', () => {
  const place: AdminPlaceInput = {
    destinationId: '000000000000000000000004',
    name: 'Bảo tàng fixture',
    description: 'Giới thiệu có nguồn',
    category: 'culture',
    venueType: 'place',
    locationQuery: 'Địa chỉ fixture',
    durationMinutes: 60,
    openingHoursNote: '',
    sourceUrl: 'https://example.invalid/place',
    referencePrice: null,
    publicationStatus: 'published',
  };
  assert.ok(adminPlaceInputSchema.safeParse(place).success);
  assert.deepEqual(catalogCapabilities(place), {
    discovery: true,
    scheduling: false,
    budgeting: false,
  });
  assert.equal(
    catalogCost({ referencePrice: null, revision: 3 }).amountMinor,
    null,
  );
  assert.equal(
    adminPlaceInputSchema.safeParse({ ...place, name: 'Cần đối chiếu nguồn' })
      .success,
    false,
  );
  const expired = {
    ...place,
    referencePrice: {
      label: 'Vé có nguồn nhưng quá hạn',
      amountMinor: 0,
      basis: 'per_person' as const,
      maxTravelers: 10,
      conditions: 'Điều kiện',
      inclusions: 'Vào cửa',
      exclusions: 'Dịch vụ thêm',
      sourceUrl: place.sourceUrl,
      checkedAt: '1999-01-01',
      reviewAfter: '2000-01-01',
    },
  };
  const quality = catalogQuality({
    ...expired,
    updatedAt: new Date().toISOString(),
    imageCredit: 'Ảnh có nguồn',
  });
  assert.equal(quality.completeness, 100);
  assert.ok(quality.issues.some((issue) => issue.code === 'price'));
  assert.equal(quality.verification, 'unknown');
  const priced = {
    ...expired,
    referencePrice: {
      ...expired.referencePrice,
      checkedAt: catalogToday(),
      reviewAfter: '2099-01-01',
    },
  };
  for (const openingHoursNote of [
    'nonsense',
    '24/7',
    'Chưa xác minh 08:00-17:00',
    'Tạm đóng cửa 08:00–17:00',
  ]) {
    assert.equal(plannerHoursReady(openingHoursNote), false);
    assert.equal(
      catalogCapabilities({ ...priced, openingHoursNote }).scheduling,
      false,
    );
  }
  assert.equal(
    catalogCapabilities({ ...priced, openingHoursNote: '08:00–17:00' })
      .scheduling,
    true,
  );
});

test('source observations preserve locks and never acquire verification from receivedAt', () => {
  const current = {
    name: 'Tên admin',
    fieldLocks: ['name', 'locationQuery'],
    planning: { locationQuery: 'Địa chỉ admin', durationMinutes: 60 },
  };
  const proposed = preserveCatalogLocks(current, {
    ...current,
    name: 'Tên nguồn',
    planning: { locationQuery: 'Địa chỉ nguồn', durationMinutes: 90 },
  });
  assert.equal(proposed.name, 'Tên admin');
  assert.deepEqual(proposed.planning, {
    locationQuery: 'Địa chỉ admin',
    durationMinutes: 90,
  });
  const provenance = catalogProvenance(
    null,
    proposed,
    'geoapify',
    null,
    '2026-10-24T00:00:00.000Z',
  );
  assert.ok(provenance.every((p) => p.verifiedAt === null));
  assert.equal(provenance.find((p) => p.field === 'name')?.state, 'observed');
  assert.equal(
    provenance.find((p) => p.field === 'referencePrice')?.state,
    'unknown',
  );
  const unchanged = catalogProvenance(
    current,
    proposed,
    'geoapify',
    null,
    '2026-10-24T00:00:00.000Z',
  );
  assert.equal(unchanged.find((p) => p.field === 'name')?.origin, 'legacy');
  assert.equal(unchanged.find((p) => p.field === 'name')?.receivedAt, null);
});
