import { test } from 'node:test';
import assert from 'node:assert/strict';
import { destinationCovers } from '@goease/media';
import { destinationCover } from '../client/src/destination-cover.js';

test('every configured destination resolves its own cover even with an unrelated legacy name', () => {
  for (const [slug, url] of Object.entries(destinationCovers)) {
    assert.equal(destinationCover('Hội An / Sa Pa', slug), url);
    assert.ok(url.includes(`/destinations/${slug}-`));
  }
  assert.equal(
    new Set(Object.values(destinationCovers)).size,
    Object.keys(destinationCovers).length,
  );
});

test('unknown and missing destination photos never substitute another province or a name substring', () => {
  assert.equal(destinationCover('Sa Pa', 'unknown-province'), null);
  assert.equal(destinationCover('Tour Hội An và Sa Pa'), null);
  assert.equal(destinationCover('Tỉnh chưa có ảnh'), null);
  assert.equal(destinationCover('Cần Thơ'), destinationCovers['can-tho']);
  assert.equal(destinationCover('  ĐÀ NẴNG  '), destinationCovers['da-nang']);
});
