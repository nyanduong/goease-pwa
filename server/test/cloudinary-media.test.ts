import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { images, resolveLegacyImageUrl } from '@goease/media';
import {
  mediaCredentials,
  mediaTarget,
  uploadMedia,
  uploadSignature,
  verifyMedia,
  type MediaAsset,
} from '../scripts/lib/cloudinary-media.js';

test('media upload targets stay under goease and originals cannot collide with WebP copies', () => {
  assert.deepEqual(mediaTarget('client/public/images/admin/coffee-v1.webp'), {
    publicId: 'goease/app/admin/coffee-v1-webp',
    assetFolder: 'goease/app/admin',
  });
  assert.notEqual(
    mediaTarget('client/public/images/admin/coffee-v1.png').publicId,
    mediaTarget('client/public/images/admin/coffee-v1.webp').publicId,
  );
  for (const path of [
    'server/.env',
    'docs/../../secret.png',
    'client/public/images/../secret.png',
    '/docs/image.png',
  ])
    assert.throws(() => mediaTarget(path));
  assert.throws(
    () => mediaCredentials({ CLOUDINARY_API_SECRET: 'secret-sentinel' }),
    (error: Error) => !error.message.includes('sentinel'),
  );
  const params = { timestamp: '123', public_id: 'goease/app/test' };
  assert.equal(
    uploadSignature(params, 'test-only-secret'),
    createHash('sha1')
      .update('public_id=goease/app/test&timestamp=123test-only-secret')
      .digest('hex'),
  );
});

test('legacy image resolution matches exact known paths and preserves external or unknown URLs', () => {
  assert.equal(
    resolveLegacyImageUrl('/images/explore-hoian.png'),
    images.exploreHoian,
  );
  for (const url of [
    'https://example.com/photo.png',
    '/images/missing.png',
    '__proto__',
    '/images/explore-hoian.png?different',
  ])
    assert.equal(resolveLegacyImageUrl(url), url);
});

test('upload failure never leaks provider content or secret and never reports success', async (t) => {
  t.mock.method(
    globalThis,
    'fetch',
    async () => new Response('provider-secret-sentinel', { status: 401 }),
  );
  await assert.rejects(
    uploadMedia(
      {
        CLOUDINARY_CLOUD_NAME: 'test',
        CLOUDINARY_API_KEY: '123',
        CLOUDINARY_API_SECRET: 'test-only-secret',
      },
      'client/public/images/test.png',
      new Uint8Array([1]),
    ),
    { message: 'Cloudinary upload failed (HTTP 401)' },
  );
});

test('CDN verification rejects content mismatch, failures and an unexpected delivery host', async (t) => {
  const bytes = new Uint8Array([1, 2, 3]);
  const asset: MediaAsset = {
    sourcePath: 'client/public/images/test.png',
    publicId: 'goease/app/test-png',
    assetFolder: 'goease/app',
    assetId: 'test-only',
    version: 1,
    width: 1,
    height: 1,
    bytes: 3,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    url: 'https://res.cloudinary.com/test/image/upload/v1/goease/app/test-png.png',
  };
  const fetchMock = t.mock.method(
    globalThis,
    'fetch',
    async () =>
      new Response(bytes, { headers: { 'Content-Type': 'image/png' } }),
  );
  await verifyMedia(asset, 'test');
  await assert.rejects(
    verifyMedia({ ...asset, sha256: '0'.repeat(64) }, 'test'),
    /checksum/,
  );
  await assert.rejects(
    verifyMedia({ ...asset, url: 'https://example.com/private' }, 'test'),
    /Unexpected Cloudinary/,
  );
  fetchMock.mock.mockImplementation(
    async () => new Response('', { status: 503 }),
  );
  await assert.rejects(verifyMedia(asset, 'test'), /HTTP 503/);
});
