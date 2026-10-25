import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  parseCommons,
  wikimediaImages,
  matchesPlaceImage,
} from '../src/features/explore/wikimedia.js';

test('nearby airport/events photos cannot become cafe covers without a place-name match', () => {
  const candidate = {
    id: '1',
    title: 'File:Environmental Remediation at Danang Airport.jpg',
    match: 'nearby' as const,
    image: {
      url: 'https://upload.wikimedia.org/x.jpg',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:X.jpg',
      credit: 'Fixture',
      license: 'Public-domain' as const,
    },
  };
  assert.equal(matchesPlaceImage('ThanhHuong Coffee', candidate), false);
  assert.equal(matchesPlaceImage('CaPhe Thu Dung', candidate), false);
  assert.equal(
    matchesPlaceImage('CafeThoang Sai Gon', {
      ...candidate,
      title: 'File:Tet Streamers.JPG',
    }),
    false,
  );
  assert.equal(
    matchesPlaceImage('Chùa Cầu', {
      ...candidate,
      title: 'File:Chua Cau Hoi An 2024.jpg',
    }),
    true,
  );
});

const page = (changes = {}) => ({
  pageid: 123,
  title: 'File:Chùa Cầu.jpg',
  imageinfo: [
    {
      url: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Bridge.jpg',
      descriptionurl: 'https://commons.wikimedia.org/wiki/File:Bridge.jpg',
      mime: 'image/jpeg',
      extmetadata: {
        Artist: {
          value:
            '<a href="https://example.invalid">Photographer &amp; partner</a>',
        },
        LicenseShortName: { value: 'CC BY-SA 4.0' },
      },
      ...changes,
    },
  ],
});
const response = (p: unknown) => ({ query: { pages: [p] } });

test('Commons accepts explicit open rights, strips markup and never marks candidates reviewed', () => {
  const [candidate] = parseCommons(response(page()), 'name');
  assert.equal(candidate?.image.credit, 'Photographer & partner');
  assert.equal(candidate?.image.license, 'CC-BY-SA-4.0');
  assert.equal(candidate?.image.reviewed, false);
  assert.equal(
    parseCommons(
      response(
        page({
          thumburl:
            'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/Bridge.jpg/960px-Bridge.jpg',
        }),
      ),
      'name',
    )[0]?.image.url,
    'https://upload.wikimedia.org/wikipedia/commons/a/ab/Bridge.jpg',
  );
  assert.equal(
    parseCommons(
      response(
        page({
          thumburl:
            'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/Bridge.jpg/960px-Bridge.jpg',
        }),
      ),
      'name',
    ).length,
    1,
  );
  assert.equal(
    parseCommons(
      response(
        page({
          extmetadata: {
            ...page().imageinfo[0]!.extmetadata,
            CommonsMetadataExtension: { value: 1 },
          },
        }),
      ),
      'name',
    ).length,
    1,
  );
  for (const license of ['CC BY 2.0', 'CC BY-SA 3.0', 'CC0', 'Public domain']) {
    assert.equal(
      parseCommons(
        response(
          page({
            extmetadata: {
              Artist: { value: 'Author' },
              LicenseShortName: { value: license },
            },
          }),
        ),
        'name',
      ).length,
      1,
    );
  }
});

test('fresh prepared Commons metadata avoids repeated searches but still rejects mismatched or unsupported rights', async () => {
  const candidate = parseCommons(
    response(page({ title: 'File:Chua Cau Hoi An.jpg' })),
    'name',
  )[0]!;
  let calls = 0;
  const find = wikimediaImages(async () => {
    calls++;
    return Response.json({ query: { pages: [] } });
  });
  const result = await find({
    name: 'Chùa Cầu',
    destinationName: 'Đà Nẵng',
    preferredCandidates: [candidate],
  });
  assert.equal(calls, 0);
  assert.equal(result.length, 1);
  assert.equal(result[0]!.image.reviewed, false);
  assert.equal(
    (
      await find({
        name: 'Chùa Cầu',
        destinationName: 'Đà Nẵng',
        preferredCandidates: [{ ...candidate, title: 'File:Airport.jpg' }],
      })
    ).length,
    0,
  );
  assert.equal(calls, 2);
  assert.equal(
    (
      await find({
        name: 'Chùa Cầu',
        destinationName: 'Đà Nẵng',
        preferredCandidates: [
          { ...candidate, image: { ...candidate.image, license: 'owned' } },
        ],
      })
    ).length,
    0,
  );
});

test('Commons rejects missing rights, noncommercial licenses, nonphotos and external image hosts', () => {
  for (const changes of [
    { extmetadata: {} },
    {
      extmetadata: {
        Artist: { value: 'Author' },
        LicenseShortName: { value: 'CC BY-NC 4.0' },
      },
    },
    { mime: 'image/svg+xml' },
    { url: 'https://evil.invalid/image.jpg' },
    { url: 'https://upload.wikimedia.org@evil.invalid/image.jpg' },
    { descriptionurl: 'http://commons.wikimedia.org/wiki/File:X.jpg' },
  ])
    assert.deepEqual(parseCommons(response(page(changes)), 'name'), []);
  assert.deepEqual(
    parseCommons(
      response({ ...page(), title: 'File:AI-generated bridge.png' }),
      'name',
    ),
    [],
  );
});

test('Commons name lookup falls back to nearby only when coordinates exist and named results are empty', async () => {
  const calls: URL[] = [];
  const find = wikimediaImages(async (input) => {
    calls.push(new URL(String(input)));
    return Response.json(
      calls.length <= 2 ? { query: { pages: [] } } : response(page()),
    );
  });
  const result = await find({
    name: 'Chùa Cầu',
    destinationName: 'Đà Nẵng',
    latitude: 15.88,
    longitude: 108.32,
  });
  assert.equal(calls.length, 3);
  assert.equal(calls[1]?.searchParams.get('gsrsearch'), '"Chùa Cầu"');
  assert.equal(calls[2]?.searchParams.get('ggsradius'), '500');
  assert.equal(result[0]?.match, 'nearby');
});

test('Commons failures and oversized responses are sanitized, never fabricated as successful photos', async () => {
  for (const request of [
    async () => new Response('private provider detail', { status: 429 }),
    async () => new Response('x'.repeat(1000001)),
    async () => Response.json({ error: { info: 'secret' } }),
    async () => {
      throw new Error('private token');
    },
  ])
    await assert.rejects(
      wikimediaImages(request)({ name: 'X', destinationName: 'Y' }),
      { code: 'WIKIMEDIA_UNAVAILABLE' },
    );
});

test('concurrent photo jobs serialize Commons API requests; a rate limit prevents queued calls hitting the provider', async () => {
  let active = 0,
    peak = 0,
    calls = 0;
  const find = wikimediaImages(async () => {
    active++;
    calls++;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 10));
    active--;
    return Response.json(response(page()));
  });
  await Promise.all(
    Array.from({ length: 3 }, (_, i) =>
      find({ name: `Fixture ${i}`, destinationName: 'Fixture' }),
    ),
  );
  assert.equal(peak, 1);
  assert.equal(calls, 6);
  calls = 0;
  const limited = wikimediaImages(async () => {
    calls++;
    return new Response('', { status: 429, headers: { 'retry-after': '60' } });
  });
  const result = await Promise.allSettled([
    limited({ name: 'A', destinationName: 'X' }),
    limited({ name: 'B', destinationName: 'X' }),
  ]);
  assert.ok(result.every((r) => r.status === 'rejected'));
  assert.equal(calls, 1);
});
