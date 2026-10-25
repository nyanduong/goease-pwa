import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  sharedPriceBudget,
  synchronizeSharedPrice,
  visitInfoForEditor,
  visitPriceLabel,
  priceReady,
  catalogToday,
  type VisitInfo,
  type ReferencePrice,
} from '@goease/contracts';
import { preserveCatalogLocks } from '../src/features/explore/catalog-provenance.js';
const price: NonNullable<VisitInfo['price']> = {
  amount: 40000,
  currency: 'VND',
  unit: 'person',
  conditions: 'Vé người lớn',
  sourceUrl: 'https://example.com/tickets',
  observedAt: new Date().toISOString(),
  reviewed: true,
  terms: {
    audience: 'standard',
    minTravelers: 1,
    maxTravelers: 10,
    inclusions: 'Vé vào cửa',
    exclusions: 'Hướng dẫn viên',
    checkedAt: catalogToday(),
    reviewAfter: '2099-12-31',
  },
};
test('one confirmed ordinary price supplies display and budget without trusting a second amount', () => {
  const projected = sharedPriceBudget(price, 'place');
  assert.equal(projected.referencePrice?.amountMinor, 40000);
  assert.equal(visitPriceLabel(price), 'Từ 40.000đ/người');
  const merged = synchronizeSharedPrice({
    visitInfo: { hours: null, price } as VisitInfo,
    referencePrice: { ...projected.referencePrice!, amountMinor: 1 },
    venueType: 'place',
  });
  assert.equal(merged.referencePrice?.amountMinor, 40000);
  assert.equal(merged.visitInfo.pricingVersion, 1);
  assert.equal(
    synchronizeSharedPrice({
      ...merged,
      visitInfo: { ...merged.visitInfo, price: null },
    }).referencePrice,
    null,
  );
});
test('unclear, special, item, expired and incomplete prices remain display-only', () => {
  for (const candidate of [
    { ...price, reviewed: false },
    { ...price, unit: 'item' as const },
    { ...price, unit: 'unspecified' as const },
    { ...price, terms: { ...price.terms, audience: 'restricted' as const } },
    { ...price, terms: { ...price.terms, audience: 'unknown' as const } },
    { ...price, terms: { ...price.terms, inclusions: '' } },
    { ...price, terms: { ...price.terms, exclusions: '' } },
    { ...price, terms: { ...price.terms, reviewAfter: '2000-01-01' } },
    { ...price, terms: { ...price.terms, checkedAt: '2099-01-01' } },
    {
      ...price,
      unit: 'group' as const,
      terms: { ...price.terms, maxTravelers: undefined },
    },
  ]) {
    const r = sharedPriceBudget(candidate, 'place');
    assert.equal(r.referencePrice, null);
    assert.ok(r.reasons.length);
  }
  assert.equal(sharedPriceBudget(price, 'food_idea').referencePrice, null);
  assert.equal(
    sharedPriceBudget({ ...price, reviewed: false, terms: undefined }, 'place')
      .referencePrice,
    null,
    'source observation cannot generate a usable budget',
  );
});
test('free, group minimums and legacy bundles preserve their existing money semantics', () => {
  const free = sharedPriceBudget(
    { ...price, amount: 0 },
    'place',
  ).referencePrice;
  assert.equal(free?.amountMinor, 0);
  assert.ok(priceReady(free));
  const group = sharedPriceBudget(
    {
      ...price,
      unit: 'group',
      terms: { ...price.terms, minTravelers: 2, maxTravelers: 4 },
    },
    'place',
  ).referencePrice;
  assert.equal(group?.basis, 'group_total');
  assert.equal(priceReady(group, 1), false);
  assert.equal(priceReady(group, 2), true);
  assert.equal(priceReady(group, 5), false);
  const legacy: ReferencePrice = {
    ...sharedPriceBudget(price, 'place').referencePrice!,
    bundle: { code: 'shared-ticket', validDays: 2, maxEntries: 3 },
  };
  const editor = visitInfoForEditor(null, legacy);
  assert.equal(editor.price?.amount, 40000);
  assert.equal(editor.price?.unit, 'person');
  assert.deepEqual(
    sharedPriceBudget(editor.price, 'place').referencePrice,
    legacy,
  );
  assert.deepEqual(
    visitInfoForEditor(editor, legacy),
    editor,
    'projection is idempotent',
  );
});
test('restoring a different price cannot bypass either alias of the price lock', () => {
  const current = {
    visitInfo: { pricingVersion: 1, hours: null, price },
    referencePrice: sharedPriceBudget(price, 'place').referencePrice,
    fieldLocks: ['referencePrice'],
  };
  const incoming = {
    ...current,
    visitInfo: {
      pricingVersion: 1,
      hours: null,
      price: { ...price, amount: 90000 },
    },
    referencePrice: { ...current.referencePrice!, amountMinor: 90000 },
  };
  const kept = preserveCatalogLocks(current, incoming);
  assert.equal((kept.visitInfo as VisitInfo).price?.amount, 40000);
  assert.equal((kept.referencePrice as ReferencePrice).amountMinor, 40000);
  const reverse = preserveCatalogLocks(
    { ...current, fieldLocks: ['visitInfo'] },
    incoming,
  );
  assert.equal((reverse.referencePrice as ReferencePrice).amountMinor, 40000);
});
