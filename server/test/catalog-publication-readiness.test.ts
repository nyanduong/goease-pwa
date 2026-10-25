import assert from 'node:assert/strict';
import { test } from 'node:test';
import { publicationReadiness } from '../src/features/explore/catalog-publication-readiness.js';
import { fixturePhoto } from './support/photo.js';
import {
  importedDescriptionPlaceholder,
  type AdminPlaceInput,
} from '@goease/contracts';
const place: AdminPlaceInput = {
  destinationId: '000000000000000000000004',
  name: 'Địa điểm kiểm thử',
  category: 'culture',
  venueType: 'place',
  description: 'Nội dung giới thiệu kiểm thử có nguồn.',
  locationQuery: 'Địa chỉ kiểm thử',
  durationMinutes: 60,
  openingHoursNote: '',
  sourceUrl: 'https://example.com/place',
  referencePrice: null,
  publicationStatus: 'draft',
  images: [fixturePhoto],
};
const context = {
  destinationVisible: true,
  archiving: false,
  blockingKind: null,
  closedUnconfirmed: false,
  staleProposal: false,
  alreadyPublished: false,
} as const;
test('publication hint accepts discovery without guessing price/hours and rejects incomplete content', () => {
  assert.equal(
    publicationReadiness(
      { ...place, images: [{ ...fixturePhoto, storage: 'source' }] },
      context,
    ).ready,
    false,
    'a new source-linked cover needs a backup before bulk publication',
  );
  assert.deepEqual(publicationReadiness(place, context), {
    ready: true,
    label: 'Đủ để xuất bản',
  });
  for (const patch of [
    { images: [] },
    { description: '' },
    { description: importedDescriptionPlaceholder },
    { name: '' },
    { locationQuery: '' },
    { sourceUrl: 'javascript:alert(1)' },
    { durationMinutes: 0 },
  ])
    assert.equal(
      publicationReadiness({ ...place, ...patch }, context).ready,
      false,
    );
  assert.equal(
    publicationReadiness({ ...place, description: '' }, context).label,
    'Thiếu giới thiệu',
  );
  assert.equal(
    publicationReadiness({ ...place, images: [] }, context).label,
    'Thiếu ảnh bìa hợp lệ',
  );
});
test('publication hint fails closed for scope, source, duplicate, closed and stale proposal blockers', () => {
  for (const patch of [
    { destinationVisible: false },
    { archiving: true },
    { blockingKind: 'source' as const },
    { blockingKind: 'duplicate' as const },
    { closedUnconfirmed: true },
    { staleProposal: true },
    { alreadyPublished: true },
  ])
    assert.equal(
      publicationReadiness(place, { ...context, ...patch }).ready,
      false,
    );
  assert.equal(
    publicationReadiness(place, { ...context, blockingKind: 'duplicate' })
      .label,
    'Có thể trùng địa điểm',
  );
  assert.equal(
    publicationReadiness(place, { ...context, alreadyPublished: true }).label,
    'Đang công khai',
  );
});
