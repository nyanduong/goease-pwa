import assert from 'node:assert/strict';
import { test } from 'node:test';
import mongoose from 'mongoose';
import {
  wikipediaDescriptions,
  shortDescription,
  type DescriptionQuery,
} from '../src/features/explore/wikipedia-descriptions.js';
import { createProduct } from '../src/product.js';
import { storedFixtureCandidate } from './support/photo.js';
import { parseConfig } from '../src/config.js';
import { descriptionTranslator } from '../src/features/explore/description-translation.js';
import {
  descriptionContext,
  descriptionQuery,
} from '../src/features/explore/place-descriptions.js';
import {
  adminPlaceInputSchema,
  importedDescriptionPlaceholder,
} from '@goease/contracts';
const query: DescriptionQuery = {
  name: 'Chùa Cầu',
  destinationName: 'Đà Nẵng',
  latitude: 15.8772,
  longitude: 108.326,
  sourceUrl: 'https://example.com/place',
};
const page = (extra: Record<string, unknown> = {}) => ({
  title: 'Chùa Cầu',
  pageid: 10,
  lastrevid: 123,
  extract:
    'Chùa Cầu là công trình kiến trúc tại Hội An. Công trình nối hai bên bờ một nhánh sông nhỏ.',
  coordinates: [{ lat: 15.8772, lon: 108.326 }],
  ...extra,
});
const json = (value: unknown) =>
  new Response(JSON.stringify(value), {
    headers: { 'Content-Type': 'application/json' },
  });
const fake = (fn: (url: URL) => Response | Promise<Response>) =>
  ((input: Parameters<typeof fetch>[0]) =>
    fn(new URL(String(input)))) as typeof fetch;

test('description prefers explicit vi article, preserves revision/source and returns a short plain extract', async () => {
  const calls: URL[] = [];
  const result = await wikipediaDescriptions(
    fake((url) => {
      calls.push(url);
      return json({ query: { pages: [page()] } });
    }),
  )({ ...query, wikipedia: 'vi:Chùa Cầu' });
  assert.equal(result?.match, 'linked');
  assert.equal(result?.language, 'vi');
  assert.equal(result?.translated, false);
  assert.match(result!.sourceUrl, /oldid=123/);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.searchParams.get('titles'), 'Chùa Cầu');
});
test('name search refuses far-away namesakes, disambiguation pages and ambiguous close matches', async () => {
  for (const pages of [
    [page({ coordinates: [{ lat: 21, lon: 105 }] })],
    [page({ pageprops: { disambiguation: '' } })],
    [page(), page({ pageid: 11 })],
  ]) {
    const result = await wikipediaDescriptions(
      fake(() => json({ query: { pages } })),
    )(query);
    assert.equal(result, null);
  }
});
test('exact name plus nearby coordinates is required for unlinked search', async () => {
  const result = await wikipediaDescriptions(
    fake(() => json({ query: { pages: [page()] } })),
  )(query);
  assert.equal(result?.match, 'name_coordinates');
  const absent = await wikipediaDescriptions(
    fake(() => json({ query: { pages: [page({ coordinates: [] })] } })),
  )(query);
  assert.equal(absent, null);
});
test('OSM Wikidata link resolves to Vietnamese sitelink before text search', async () => {
  const calls: string[] = [];
  const result = await wikipediaDescriptions(
    fake((url) => {
      calls.push(url.hostname);
      if (url.hostname === 'api.openstreetmap.org')
        return json({ elements: [{ tags: { wikidata: 'Q123' } }] });
      if (url.hostname === 'www.wikidata.org')
        return json({
          entities: { Q123: { sitelinks: { viwiki: { title: 'Chùa Cầu' } } } },
        });
      return json({ query: { pages: [page()] } });
    }),
  )({ ...query, sourceUrl: 'https://www.openstreetmap.org/node/123' });
  assert.equal(result?.language, 'vi');
  assert.deepEqual(calls, [
    'api.openstreetmap.org',
    'www.wikidata.org',
    'vi.wikipedia.org',
  ]);
});
test('English source remains untranslated when translator unavailable, never passed off as Vietnamese', async () => {
  const request = fake((url) =>
    json({
      query: {
        pages: url.hostname.startsWith('vi.')
          ? []
          : [page({ title: 'Japanese Covered Bridge' })],
      },
    }),
  );
  const result = await wikipediaDescriptions(request)({
    ...query,
    wikipedia: 'en:Japanese Covered Bridge',
  });
  assert.equal(result?.text, '');
  assert.equal(result?.translated, false);
  assert.equal(result?.language, 'en');
  const translated = await wikipediaDescriptions(request, async (text) => {
    assert.match(text, /Hội An/);
    return 'Bản dịch dựa trên nội dung nguồn.';
  })({ ...query, wikipedia: 'en:Japanese Covered Bridge' });
  assert.equal(translated?.translated, true);
});
test('provider failures, invalid JSON and oversized responses fail truthfully', async () => {
  await assert.rejects(
    wikipediaDescriptions(fake(() => new Response('', { status: 429 })))(query),
    { code: 'SOURCE_RATE_LIMITED' },
  );
  for (const response of [
    () => new Response('not json'),
    () => new Response('a'.repeat(1_000_001)),
  ])
    await assert.rejects(wikipediaDescriptions(fake(response))(query), {
      code: 'DESCRIPTION_SOURCE_FAILED',
    });
  assert.equal(
    shortDescription('<b>Một câu.</b> Hai câu. Ba câu. Bốn câu.'),
    'Một câu. Hai câu. Ba câu.',
  );
});
test('source projection fills only empty unlocked drafts, respects manual edits and context, preserves public content', async () => {
  const connection = mongoose.createConnection();
  try {
    const product = createProduct(
      connection,
      parseConfig({
        NODE_ENV: 'test',
        CLIENT_ORIGIN: 'http://localhost:5180',
        MONGODB_URI: 'mongodb://localhost:27021/unused',
      }),
    );
    const { Place } = product.explore.models;
    const base = {
      name: query.name,
      destinationName: query.destinationName,
      sourceUrl: query.sourceUrl,
      destinationId: new mongoose.Types.ObjectId(),
      description: '',
      publicationStatus: 'draft',
      mapLocation: { latitude: query.latitude, longitude: query.longitude },
      images: [],
      fieldLocks: [],
    };
    const result = await wikipediaDescriptions(
      fake(() => json({ query: { pages: [page()] } })),
    )(query);
    const doc = Place.hydrate({
      ...base,
      descriptionSearch: {
        state: 'ready',
        context: descriptionContext(query),
        result,
      },
    });
    assert.equal(
      descriptionContext(descriptionQuery(doc)),
      descriptionContext(query),
    );
    const projected = product.catalog.withSourceDefaults(doc);
    assert.equal(projected.description, result!.text);
    assert.equal(projected.descriptionSource?.sourceUrl, result!.sourceUrl);
    assert.equal(doc.description, '');
    const photo = {
      ...storedFixtureCandidate.image,
      selection: 'admin' as const,
    };
    const upgraded = {
      ...photo,
      url: photo.url.replace('test-fixture', 'test-fixture-original'),
    };
    const photoDraft = Place.hydrate({
      ...base,
      images: [photo],
      imageSearch: {
        storageVersion: 2,
        state: 'ready',
        candidates: [{ ...storedFixtureCandidate, image: upgraded }],
      },
    });
    assert.equal(
      product.catalog.withSourceDefaults(photoDraft).images[0]?.url,
      upgraded.url,
    );
    assert.equal(
      product.catalog.withSourceDefaults(photoDraft).images[0]?.selection,
      'admin',
    );
    assert.equal(photoDraft.images[0]?.url, photo.url);
    for (const patch of [
      { publicationStatus: 'published' },
      { fieldLocks: ['images'] },
    ]) {
      assert.equal(
        product.catalog.withSourceDefaults(
          Place.hydrate({ ...photoDraft.toObject(), ...patch }),
        ).images[0]?.url,
        photo.url,
      );
    }

    for (const patch of [
      { description: 'Admin đã viết nội dung khác.' },
      { publicationStatus: 'published' },
      { fieldLocks: ['description'] },
      { name: 'Địa điểm khác' },
    ]) {
      const source = Place.hydrate({ ...doc.toObject(), ...patch });
      const next = product.catalog.withSourceDefaults(source);
      assert.equal(next.description, patch.description ?? '');
    }
    const legacy = product.catalog.withSourceDefaults(
      Place.hydrate({ ...base, description: importedDescriptionPlaceholder }),
    );
    assert.equal(legacy.description, '');
    assert.match(legacy.internalNote, /Geoapify/);
    const input = {
      destinationId: String(base.destinationId),
      name: 'Địa điểm',
      category: 'culture',
      venueType: 'place',
      description: '',
      locationQuery: 'Địa chỉ',
      durationMinutes: 60,
      openingHoursNote: '',
      sourceUrl: query.sourceUrl,
      referencePrice: null,
      publicationStatus: 'draft',
    };
    assert.equal(adminPlaceInputSchema.safeParse(input).success, true);
    const invalid = adminPlaceInputSchema.safeParse({
      ...input,
      publicationStatus: 'published',
      description: importedDescriptionPlaceholder,
    });
    assert.equal(invalid.success, false);
    assert.ok(invalid.error?.issues.some((i) => i.path[0] === 'description'));
  } finally {
    await connection.destroy();
  }
});

test('translation respects missing credentials, exhausted quota and numeric facts', async () => {
  const config = parseConfig({
    NODE_ENV: 'test',
    SESSION_SECRET: 'x'.repeat(32),
    CLIENT_ORIGIN: 'http://localhost:5180',
    MONGODB_URI: 'mongodb://localhost:27021/unused',
    AI_PROVIDER: 'gemini',
    GEMINI_API_KEY: 'test-fixture-key',
  });
  let quota = true,
    calls = 0,
    translated = 'Xây dựng năm 1900.';
  const connection = {
    collection: () => ({
      updateOne: async (_filter: unknown, update: Record<string, unknown>) => ({
        modifiedCount: '$inc' in update ? Number(quota) : 1,
      }),
    }),
  } as unknown as mongoose.Connection;
  const request = (async () => {
    calls++;
    return json({
      candidates: [
        {
          finishReason: 'STOP',
          content: { parts: [{ text: JSON.stringify({ text: translated }) }] },
        },
      ],
    });
  }) as typeof fetch;
  assert.equal(
    await descriptionTranslator(
      connection,
      { ...config, GEMINI_API_KEY: '' },
      request,
    )('Built in 1900.'),
    null,
  );
  quota = false;
  assert.equal(
    await descriptionTranslator(connection, config, request)('Built in 1900.'),
    null,
  );
  assert.equal(calls, 0);
  quota = true;
  assert.equal(
    await descriptionTranslator(connection, config, request)('Built in 1900.'),
    translated,
  );
  translated = 'Xây dựng năm 2000.';
  assert.equal(
    await descriptionTranslator(connection, config, request)('Built in 1900.'),
    null,
  );
});
