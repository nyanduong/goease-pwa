import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  osmVisitInfo,
  websiteVisitInfo,
  visitInfoProvider,
} from '../src/features/explore/visit-info-provider.js';
import {
  publicIPv4,
  visitSourceText,
} from '../src/features/explore/visit-source-http.js';
import {
  adminPlaceInputSchema,
  visitInfoSchema,
  visitPriceLabel,
} from '@goease/contracts';
import { fixturePhoto } from './support/photo.js';
const source = 'https://www.openstreetmap.org/node/123';
test('OSM explicit VND charges, free entry and missing data are distinct', () => {
  const info = osmVisitInfo(
    { opening_hours: 'Mo-Su 08:00-17:00', charge: '30000 VND/person' },
    source,
  );
  assert.equal(info.price?.amount, 30000);
  assert.equal(info.price?.reviewed, false);
  assert.equal(info.hours?.text, 'Mo-Su 08:00-17:00');
  assert.equal(visitPriceLabel(info.price!), 'Từ 30.000đ/người');
  assert.equal(osmVisitInfo({ fee: 'yes' }, source).price, null);
  assert.equal(osmVisitInfo({}, source).price, null);
  assert.equal(osmVisitInfo({ fee: 'no' }, source).price?.amount, 0);
  for (const charge of [
    '30 USD',
    '30.000 VND',
    '10000 VND; children free',
    '30000 VND/hour',
    '-1 VND',
  ])
    assert.equal(osmVisitInfo({ charge }, source).price, null);
  assert.equal(
    osmVisitInfo(
      { charge: '30000 VND', 'charge:conditional': '0 @ (Su)' },
      source,
    ).price,
    null,
  );
});
const html = (data: unknown) =>
  `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
test('linked website reads exact venue JSON-LD and keeps offer applicability, no guessed units', () => {
  const info = websiteVisitInfo(
    html({
      '@type': 'Museum',
      name: 'Bảo tàng thử',
      openingHoursSpecification: {
        dayOfWeek: 'https://schema.org/Monday',
        opens: '08:00',
        closes: '17:00',
      },
      offers: [
        {
          '@type': 'Offer',
          price: 30000,
          priceCurrency: 'VND',
          name: 'Vé người lớn',
        },
        { price: 10000, priceCurrency: 'VND', name: 'Vé trẻ em' },
      ],
    }),
    'Bảo tàng thử',
    'https://museum.example/info',
  );
  assert.equal(info.price?.amount, 10000);
  assert.equal(info.price?.conditions, 'Vé trẻ em');
  assert.equal(info.price?.unit, 'unspecified');
  assert.match(info.hours!.text, /Monday: 08:00–17:00/);
  assert.equal(
    websiteVisitInfo(
      html({
        '@type': 'Museum',
        name: 'Khác',
        offers: { price: 10000, priceCurrency: 'VND', name: 'Vé' },
      }),
      'Bảo tàng thử',
      source,
    ).price,
    null,
  );
  assert.equal(
    websiteVisitInfo(
      html({
        '@type': 'Museum',
        name: 'Test',
        offers: { price: 10000, priceCurrency: 'USD', name: 'Vé' },
      }),
      'Test',
      source,
    ).price,
    null,
  );
  assert.equal(
    websiteVisitInfo('<p>Giá 10000 VND</p>', 'Test', source).price,
    null,
  );
});
test('provider uses canonical OSM ID and linked website only, rejects name mismatch and propagates failure', async () => {
  const urls: string[] = [];
  const find = visitInfoProvider(async (url) => {
    urls.push(url);
    return url.includes('api.openstreetmap')
      ? JSON.stringify({
          elements: [
            {
              type: 'node',
              id: 123,
              tags: { name: 'Test', website: 'https://museum.example' },
            },
          ],
        })
      : html({
          '@type': 'Museum',
          name: 'Test',
          openingHours: 'Mo-Fr 08:00-17:00',
        });
  });
  assert.ok(
    (await find({ name: 'Test', sourceUrl: source, destinationName: 'Hà Nội' }))
      ?.hours,
  );
  assert.equal(urls.length, 2);
  assert.equal(
    await find({ name: 'Wrong', sourceUrl: source, destinationName: 'Hà Nội' }),
    null,
  );
  assert.equal(
    await find({
      name: 'Test',
      sourceUrl: 'https://evil.example/node/123',
      destinationName: 'Hà Nội',
    }),
    null,
  );
  await assert.rejects(
    visitInfoProvider(async () => {
      throw Error('failure');
    })({ name: 'Test', sourceUrl: source, destinationName: 'Hà Nội' }),
  );
});
test('source fetch blocks literal IPs, credentials, private and reserved addresses', async () => {
  for (const ip of [
    '127.0.0.1',
    '10.1.2.3',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.1.2',
    '172.16.2.3',
    '::1',
    '::ffff:127.0.0.1',
    '0.0.0.0',
    '224.0.0.1',
  ])
    assert.equal(publicIPv4(ip), false);
  assert.equal(publicIPv4('8.8.8.8'), true);
  for (const url of [
    'http://example.com',
    'https://127.0.0.1',
    'https://user:pass@example.com',
    'https://example.com:444',
  ])
    await assert.rejects(visitSourceText(url));
});
test('unreviewed observations can be saved as draft but cannot publish; reviewed starting prices without applicability terms remain display-only', () => {
  const info = osmVisitInfo({ charge: '30000 VND/person' }, source);
  const input = {
    destinationId: '000000000000000000000004',
    name: 'Test',
    category: 'culture',
    venueType: 'place',
    description: 'Giới thiệu thử nghiệm',
    locationQuery: 'Địa chỉ thử',
    durationMinutes: 60,
    openingHoursNote: '',
    sourceUrl: source,
    referencePrice: null,
    visitInfo: info,
    images: [fixturePhoto],
    publicationStatus: 'draft',
  };
  assert.ok(adminPlaceInputSchema.safeParse(input).success);
  assert.equal(
    adminPlaceInputSchema.safeParse({
      ...input,
      publicationStatus: 'published',
    }).success,
    false,
  );
  const checked = adminPlaceInputSchema.parse({
    ...input,
    publicationStatus: 'published',
    visitInfo: { ...info, price: { ...info.price!, reviewed: true } },
  });
  assert.equal(checked.referencePrice, null);
  assert.equal(
    visitInfoSchema.safeParse({
      ...info,
      price: { ...info.price!, sourceUrl: 'javascript:alert(1)' },
    }).success,
    false,
  );
});

test('partially entered source URLs report validation errors without throwing during editor rendering', () => {
  const info = osmVisitInfo({ charge: '30000 VND' }, source);
  for (const sourceUrl of ['', 'h', 'https:', 'not a URL']) {
    assert.doesNotThrow(() =>
      visitInfoSchema.safeParse({
        ...info,
        price: { ...info.price!, sourceUrl },
      }),
    );
    assert.equal(
      visitInfoSchema.safeParse({
        ...info,
        price: { ...info.price!, sourceUrl },
      }).success,
      false,
    );
  }
});
