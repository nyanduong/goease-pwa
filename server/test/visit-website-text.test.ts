import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  websiteTextInfo,
  visitPageLinks,
} from '../src/features/explore/visit-website-text.js';
import { visitInfoProvider } from '../src/features/explore/visit-info-provider.js';
const url = 'https://museum.example/';
test('Wikidata search requires both exact name and nearby coordinates before using a website', async () => {
  for (const latitude of [21.03, 10]) {
    let websiteReads = 0;
    const find = visitInfoProvider(async (u) => {
      if (u.includes('openstreetmap.org/api'))
        return JSON.stringify({
          elements: [{ type: 'node', id: 123, tags: { name: 'Museum Test' } }],
        });
      if (u.includes('wbsearchentities'))
        return JSON.stringify({ search: [{ id: 'Q123' }] });
      if (u.includes('EntityData'))
        return JSON.stringify({
          entities: {
            Q123: {
              labels: { en: { value: 'Museum Test' } },
              claims: {
                P625: [
                  {
                    mainsnak: {
                      datavalue: { value: { latitude, longitude: 105.84 } },
                    },
                  },
                ],
                P856: [{ mainsnak: { datavalue: { value: url } } }],
              },
            },
          },
        });
      websiteReads++;
      return '<h1>Museum Test</h1><p>Opening hours: 08:00–17:00</p>';
    });
    const info = await find({
      name: 'Museum Test',
      sourceUrl: 'https://www.openstreetmap.org/node/123',
      destinationName: 'Hà Nội',
      mapLocation: { latitude: 21.03, longitude: 105.84 },
    });
    assert.equal(websiteReads, latitude === 21.03 ? 1 : 0);
    assert.equal(!!info?.hours, latitude === 21.03);
  }
});
test('plain website hours and explicit ticket price retain qualifiers, source and unreviewed state', () => {
  const v = websiteTextInfo(
    '<h1>Bảo tàng thử</h1><h2>Giờ mở cửa</h2><p>Thứ Ba đến Chủ nhật: 08:00–17:00</p><p>Đóng cửa thứ Hai</p><h2>Giá vé</h2><p>Người lớn: 40.000 đồng/người</p>',
    'Bảo tàng thử',
    url,
  );
  assert.match(v.hours!.text, /Đóng cửa thứ Hai/);
  assert.equal(v.price?.amount, 40000);
  assert.equal(v.price?.unit, 'person');
  assert.equal(v.price?.reviewed, false);
  assert.match(v.price!.conditions, /Người lớn/);
});
test('unrelated, ambiguous, hidden script and parking prices are not admitted', () => {
  for (const body of [
    '<p>Giá vé người lớn 40.000đ; trẻ em 20.000đ</p>',
    '<p>Giá vé gửi xe 10.000đ</p>',
    '<script>Giá vé 30000 VND</script>',
    '<p>Giờ mở cửa chưa rõ</p>',
  ]) {
    const v = websiteTextInfo(
      '<h1>Bảo tàng thử</h1>' + body,
      'Bảo tàng thử',
      url,
    );
    assert.equal(v.price, null);
    assert.equal(v.hours, null);
  }
  assert.equal(
    websiteTextInfo('<h1>Khác</h1><p>Giá vé 40000 VND</p>', 'Bảo tàng thử', url)
      .price,
    null,
  );
  assert.deepEqual(
    visitPageLinks(
      '<a href="https://evil.example/tickets">Giá vé</a><a href="/tickets">Giá vé</a><a href="/hours">Opening hours</a><a href="/contact">Contact</a>',
      url,
    ),
    [url + 'tickets', url + 'hours'],
  );
});
test('Wikidata linked website and same-origin visit page supply missing facts without a paid API', async () => {
  const calls: string[] = [];
  const find = visitInfoProvider(async (u) => {
    calls.push(u);
    if (u.includes('openstreetmap.org/api'))
      return JSON.stringify({
        elements: [
          {
            type: 'node',
            id: 123,
            tags: { name: 'Bảo tàng thử', wikidata: 'Q123' },
          },
        ],
      });
    if (u.includes('wikidata.org'))
      return JSON.stringify({
        entities: {
          Q123: {
            claims: { P856: [{ mainsnak: { datavalue: { value: url } } }] },
          },
        },
      });
    if (u === url) return '<h1>Bảo tàng thử</h1><a href="/visit">Tham quan</a>';
    if (u === url + 'visit')
      return '<h2>Giờ mở cửa</h2><p>08:00–17:00 hằng ngày</p><h2>Giá vé</h2><p>Người lớn 40.000đ/người</p>';
    throw Error('unexpected source');
  });
  const info = await find({
    name: 'Bảo tàng thử',
    sourceUrl: 'https://www.openstreetmap.org/node/123',
    destinationName: 'Hà Nội',
  });
  assert.equal(info?.price?.amount, 40000);
  assert.equal(info?.price?.sourceUrl, url + 'visit');
  assert.ok(info?.hours);
  assert.equal(calls.length, 4);
});
