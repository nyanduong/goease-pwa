import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  adminPlaceInputSchema,
  approvedPhoto,
  approvedCover,
  catalogCapabilities,
  catalogGallery,
  type AdminPlaceInput,
  type CatalogImage,
} from '@goease/contracts';
import { fixturePhoto } from './support/photo.js';
const ai: CatalogImage = {
  url: 'https://res.cloudinary.com/fixture/image/upload/ai.webp',
  sourceUrl: 'https://example.com/generated/fixture',
  credit: 'GoEase AI fixture',
  license: 'owned',
  reviewed: true,
  kind: 'ai_illustration',
};
const input: AdminPlaceInput = {
  destinationId: '000000000000000000000004',
  name: 'Ảnh minh họa fixture',
  category: 'culture',
  venueType: 'place',
  description: 'Giới thiệu có nguồn của địa điểm.',
  locationQuery: 'Đà Nẵng',
  durationMinutes: 60,
  openingHoursNote: '',
  sourceUrl: 'https://example.com/place',
  referencePrice: null,
  publicationStatus: 'published',
  images: [ai],
};
test('explicit AI cover is disclosed metadata, not a verified photograph or a verified price', () => {
  assert.equal(approvedPhoto(ai), false);
  assert.equal(approvedCover(ai), true);
  assert.equal(adminPlaceInputSchema.safeParse(input).success, true);
  assert.equal(catalogCapabilities(input).discovery, true);
  assert.equal(catalogCapabilities(input).budgeting, false);
  const { kind: _kind, ...untyped } = ai;
  void _kind;
  assert.equal(approvedCover(untyped), false);
  assert.equal(approvedCover({ ...ai, license: 'CC-BY-SA-4.0' }), false);
  assert.equal(
    approvedCover({
      ...ai,
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:fake.png',
    }),
    false,
  );
});
test('gallery accepts up to five real photos or one AI illustration, never a mixed gallery', () => {
  const photos = Array.from({ length: 6 }, (_, i) => ({
    ...fixturePhoto,
    url: `https://example.com/photo-${i}.webp`,
  }));
  assert.equal(
    adminPlaceInputSchema.safeParse({ ...input, images: photos.slice(0, 5) })
      .success,
    true,
  );
  for (const images of [photos, [ai, ai], [ai, fixturePhoto]])
    assert.equal(
      adminPlaceInputSchema.safeParse({ ...input, images }).success,
      false,
    );
  assert.deepEqual(catalogGallery([ai, fixturePhoto]), [fixturePhoto]);
  assert.equal(catalogGallery(photos).length, 5);
  assert.deepEqual(catalogGallery([ai, ai]), [ai]);
});

test('cached supplemental originals become source links, while the stored cover stays cached', () => {
  assert.equal(
    adminPlaceInputSchema.safeParse({
      ...input,
      images: [{ ...fixturePhoto, storage: 'cloudinary', url: 'invalid-url' }],
    }).success,
    false,
  );
  const cover: CatalogImage = {
    ...fixturePhoto,
    storage: 'cloudinary',
    url: 'https://res.cloudinary.com/fixture/image/upload/cover.webp',
    originalUrl: fixturePhoto.url,
  };
  const extra: CatalogImage = {
    ...cover,
    url: 'https://res.cloudinary.com/fixture/image/upload/extra.webp',
    originalUrl:
      'https://upload.wikimedia.org/wikipedia/commons/b/bb/extra.jpg',
  };
  const gallery = catalogGallery([
    cover,
    { ...cover, url: cover.originalUrl!, storage: 'source' },
    extra,
  ]);
  assert.equal(gallery.length, 2);
  assert.deepEqual(gallery[0], cover);
  assert.equal(gallery[1]!.storage, 'source');
  assert.equal(gallery[1]!.url, extra.originalUrl);
  assert.equal(
    adminPlaceInputSchema.safeParse({
      ...input,
      images: [{ ...cover, url: 'https://example.com/forged.webp' }],
    }).success,
    false,
  );
});
