import assert from 'node:assert/strict';
import { test } from 'node:test';
import sharp from 'sharp';
import {
  catalogCoverStorage,
  storedWikimediaImages,
} from '../src/features/explore/place-photo-storage.js';
import { fixtureCandidate } from './support/photo.js';

const config = {
  CLOUDINARY_CLOUD_NAME: 'fixture',
  CLOUDINARY_API_KEY: 'fixture-key',
  CLOUDINARY_API_SECRET: 'fixture-secret',
};
const query = { name: 'Fixture', destinationName: 'Fixture' };
test('stores bounded re-encoded photos with deterministic IDs, preserves rights, never auto-approves', async () => {
  const source = await sharp({
    create: { width: 1600, height: 900, channels: 3, background: '#008080' },
  })
    .png()
    .toBuffer();
  const ids: string[] = [];
  const request: typeof fetch = async (url, init) => {
    assert.equal(init?.redirect, 'error');
    if (new URL(String(url)).hostname === 'upload.wikimedia.org')
      return new Response(source);
    const form = init!.body as FormData;
    assert.equal(form.get('overwrite'), 'false');
    const id = String(form.get('public_id'));
    ids.push(id);
    const file = form.get('file') as Blob;
    const metadata = await sharp(
      Buffer.from(await file.arrayBuffer()),
    ).metadata();
    assert.equal(metadata.format, 'webp');
    assert.equal(metadata.width, 1600);
    assert.equal(metadata.height, 900);
    const originalPixels = await sharp(source).raw().toBuffer();
    const storedPixels = await sharp(Buffer.from(await file.arrayBuffer()))
      .raw()
      .toBuffer();
    assert.deepEqual(storedPixels, originalPixels);
    return Response.json({
      public_id: id,
      format: 'webp',
      secure_url: `https://res.cloudinary.com/fixture/image/upload/v1/${id}.webp`,
    });
  };
  const find = storedWikimediaImages(
    config,
    async () => [fixtureCandidate],
    request,
  );
  const [photo] = await find(query);
  await find(query);
  assert.equal(ids[0], ids[1]);
  assert.ok(photo?.image.url.startsWith('https://res.cloudinary.com/fixture/'));
  assert.equal(photo?.image.sourceUrl, fixtureCandidate.image.sourceUrl);
  assert.equal(photo?.image.license, fixtureCandidate.image.license);
  assert.equal(photo?.image.credit, fixtureCandidate.image.credit);
  assert.equal(photo?.image.reviewed, false);
});
test('missing config, unsafe origins, invalid raster and upload failures cannot fall back to original URLs', async () => {
  await assert.rejects(
    storedWikimediaImages({}, async () => [fixtureCandidate])(query),
    { code: 'PLACE_PHOTO_STORAGE_UNAVAILABLE' },
  );
  let requests = 0;
  await assert.rejects(
    storedWikimediaImages(
      config,
      async () => [
        {
          ...fixtureCandidate,
          image: { ...fixtureCandidate.image, url: 'http://localhost/private' },
        },
      ],
      async () => {
        requests++;
        return new Response('invalid');
      },
    )(query),
    { code: 'PLACE_PHOTO_STORAGE_FAILED' },
  );
  assert.equal(requests, 0);
  for (const request of [
    async () => new Response('<svg></svg>'),
    async () => new Response('x'.repeat(8 * 1024 * 1024 + 1)),
    async () => new Response('private provider failure', { status: 503 }),
  ])
    await assert.rejects(
      storedWikimediaImages(
        config,
        async () => [fixtureCandidate],
        request,
      )(query),
      { code: 'PLACE_PHOTO_STORAGE_FAILED' },
    );
  assert.deepEqual(
    await storedWikimediaImages(config, async () => [])(query),
    [],
  );
});

test('Cloudinary errors and forged response URLs fail closed after a valid download', async () => {
  const bytes = await sharp({
    create: { width: 10, height: 10, channels: 3, background: '#008080' },
  })
    .png()
    .toBuffer();
  for (const status of [503, 200]) {
    await assert.rejects(
      storedWikimediaImages(
        config,
        async () => [fixtureCandidate],
        async (url, init) => {
          if (String(url).includes('upload.wikimedia.org'))
            return new Response(bytes);
          return Response.json(
            {
              public_id: (init!.body as FormData).get('public_id'),
              format: 'webp',
              secure_url: 'https://evil.invalid/photo.webp',
            },
            { status },
          );
        },
      )(query),
      { code: 'PLACE_PHOTO_STORAGE_FAILED' },
    );
  }
});

test('five-photo search backs up one lossless cover and leaves four source links with rights', async () => {
  const bytes = await sharp({
    create: { width: 40, height: 30, channels: 3, background: '#008080' },
  })
    .png()
    .toBuffer();
  let downloads = 0,
    uploads = 0;
  const candidates = Array.from({ length: 5 }, (_, i) => ({
    ...fixtureCandidate,
    id: String(i),
    image: {
      ...fixtureCandidate.image,
      url: `https://upload.wikimedia.org/wikipedia/commons/a/ab/fixture-${i}.png`,
      sourceUrl: `https://commons.wikimedia.org/wiki/File:fixture-${i}.png`,
    },
  }));
  const request: typeof fetch = async (url, init) => {
    if (new URL(String(url)).hostname === 'upload.wikimedia.org') {
      downloads++;
      return new Response(bytes);
    }
    uploads++;
    const id = (init!.body as FormData).get('public_id');
    return Response.json({
      public_id: id,
      format: 'webp',
      secure_url: `https://res.cloudinary.com/fixture/image/upload/v1/${id}.webp`,
    });
  };
  const found = await storedWikimediaImages(
    config,
    async () => candidates,
    request,
  )(query);
  assert.equal(downloads, 1);
  assert.equal(uploads, 1);
  assert.equal(found.length, 5);
  assert.equal(found[0]!.image.storage, 'cloudinary');
  assert.equal(found[0]!.image.originalUrl, candidates[0]!.image.url);
  for (let i = 1; i < 5; i++) {
    assert.equal(found[i]!.image.url, candidates[i]!.image.url);
    assert.equal(found[i]!.image.storage, 'source');
    assert.equal(found[i]!.image.credit, fixtureCandidate.image.credit);
    assert.equal(found[i]!.image.license, fixtureCandidate.image.license);
  }
  const promoted = await catalogCoverStorage(config, request).prepareCover({
    ...found[1]!.image,
    selection: 'admin',
    reviewed: true,
  });
  assert.equal(promoted.storage, 'cloudinary');
  assert.equal(promoted.selection, 'admin');
  assert.equal(promoted.reviewed, true);
  assert.equal(promoted.originalUrl, candidates[1]!.image.url);
  await catalogCoverStorage(config, request).prepareCover(promoted);
  assert.equal(uploads, 2, 'saving a cached cover does not upload again');
});

test('a failed first backup can use the next valid photo; all failed backups never report ready', async () => {
  const bytes = await sharp({
    create: { width: 4, height: 3, channels: 3, background: '#008080' },
  })
    .png()
    .toBuffer();
  const other = {
    ...fixtureCandidate,
    id: 'next',
    image: {
      ...fixtureCandidate.image,
      url: 'https://upload.wikimedia.org/wikipedia/commons/b/bb/next.png',
    },
  };
  let uploads = 0;
  const found = await storedWikimediaImages(
    config,
    async () => [fixtureCandidate, other],
    async (url, init) => {
      if (String(url) === fixtureCandidate.image.url)
        return new Response('not available', { status: 404 });
      if (String(url) === other.image.url) return new Response(bytes);
      uploads++;
      const id = (init!.body as FormData).get('public_id');
      return Response.json({
        public_id: id,
        format: 'webp',
        secure_url: `https://res.cloudinary.com/fixture/image/upload/v1/${id}.webp`,
      });
    },
  )(query);
  assert.equal(uploads, 1);
  assert.equal(found[0]!.id, 'next');
  assert.equal(found[0]!.image.storage, 'cloudinary');
  await assert.rejects(
    catalogCoverStorage(config).prepareCover({
      ...fixtureCandidate.image,
      storage: 'source',
      url: 'http://localhost/private',
    }),
    { code: 'PLACE_PHOTO_STORAGE_FAILED' },
  );
});
