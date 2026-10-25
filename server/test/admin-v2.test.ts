import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  adminPlaceInputSchema,
  adminSettingsSchema,
  catalogImageSchema,
  catalogQuality,
  catalogToday,
  type AdminPlaceDto,
} from '@goease/contracts';

test('quality is a defined completeness measure, not fabricated confidence; optional hours and location do not inflate required fields', () => {
  const place: AdminPlaceDto = {
    id: '000000000000000000000011',
    revision: 1,
    updatedAt: new Date().toISOString(),
    destinationId: '000000000000000000000004',
    name: 'Điểm tham quan',
    description: 'Giới thiệu',
    category: 'culture',
    venueType: 'place',
    locationQuery: 'Địa chỉ',
    durationMinutes: 60,
    openingHoursNote: '',
    sourceUrl: 'https://example.com/venue',
    publicationStatus: 'draft',
    imageCredit: 'Ảnh minh họa AI',
    referencePrice: null,
  };
  assert.equal(catalogQuality(place).completeness, 83);
  assert.deepEqual(
    catalogQuality(place).issues.map((i) => i.code),
    ['price', 'location', 'hours', 'image'],
  );
  const price = {
    label: 'Vé',
    amountMinor: 0,
    basis: 'per_person' as const,
    maxTravelers: 10,
    conditions: 'Miễn phí đã đối chiếu',
    inclusions: 'Vào cửa',
    exclusions: 'Dịch vụ khác',
    sourceUrl: 'https://example.com/venue',
    checkedAt: catalogToday(),
    reviewAfter: '2099-01-01',
  };
  assert.equal(
    catalogQuality({ ...place, referencePrice: price }).completeness,
    100,
  );
  assert.ok(
    catalogQuality(
      { ...place, updatedAt: '2020-01-01T00:00:00Z' },
      30,
    ).issues.some((i) => i.code === 'freshness'),
  );
  const { id, revision, updatedAt, imageCredit, ...input } = place;
  void id;
  void revision;
  void updatedAt;
  void imageCredit;
  assert.equal(
    adminPlaceInputSchema.safeParse({
      ...input,
      name: 'Điểm cần đối chiếu',
      referencePrice: price,
      publicationStatus: 'published',
    }).success,
    false,
  );
});
test('image attribution and region guardrails reject unsafe or unbounded settings', () => {
  const image = {
    url: 'https://example.com/photo.jpg',
    credit: 'Tác giả',
    license: 'permission',
    sourceUrl: 'https://example.com/permission',
  };
  assert.ok(catalogImageSchema.safeParse(image).success);
  assert.equal(
    catalogImageSchema.safeParse({
      ...image,
      url: 'http://example.com/photo.jpg',
    }).success,
    false,
  );
  assert.equal(
    catalogImageSchema.safeParse({ ...image, credit: '' }).success,
    false,
  );
  assert.equal(
    catalogImageSchema.safeParse({
      ...image,
      url: 'https://secret:password@example.com/photo.jpg',
    }).success,
    false,
  );
  const settings = {
    expectedRevision: 0,
    defaultDestinationId: null,
    freshnessDays: 90,
    showQualityAlerts: true,
    autoApplyDraftHours: false,
  };
  assert.ok(adminSettingsSchema.safeParse(settings).success);
  assert.equal(
    adminSettingsSchema.safeParse({
      ...settings,
      regions: [
        {
          destinationId: '000000000000000000000004',
          latitude: 15.88,
          longitude: 108.328,
          radiusMeters: 10001,
          enabled: true,
        },
      ],
    }).success,
    false,
  );
});
