import assert from 'node:assert/strict';
import { test } from 'node:test';
import sharp from 'sharp';
import {
  avatarUploader,
  normalizeAvatar,
} from '../src/features/auth/avatar-upload.js';
import { HttpError } from '../src/http-error.js';

const picture = () =>
  sharp({
    create: { width: 800, height: 600, channels: 3, background: '#aabbcc' },
  })
    .jpeg()
    .toBuffer();
test('avatar re-encodes to square WebP without original metadata and rejects unsafe files', async () => {
  const image = await normalizeAvatar(await picture());
  const meta = await sharp(image).metadata();
  assert.equal(meta.width, 512);
  assert.equal(meta.height, 512);
  assert.equal(meta.format, 'webp');
  assert.equal(meta.exif, undefined);
  const huge = await sharp({
    create: { width: 5000, height: 3300, channels: 3, background: '#fff' },
  })
    .png()
    .toBuffer();
  for (const bytes of [
    Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
    Buffer.from([255, 216, 255, 0]),
    Buffer.alloc(2 * 1024 * 1024 + 1),
    huge,
  ])
    await assert.rejects(
      normalizeAvatar(bytes),
      (e: unknown) => e instanceof HttpError && e.status === 400,
    );
});
test('avatar provider uses signed bounded server upload and validates asset destination', async () => {
  const config = {
    CLOUDINARY_CLOUD_NAME: 'test-cloud',
    CLOUDINARY_API_KEY: 'KEY_SENTINEL',
    CLOUDINARY_API_SECRET: 'SECRET_SENTINEL',
  };
  let calls = 0;
  const send: typeof fetch = async (url, init) => {
    calls++;
    assert.equal(
      url,
      'https://api.cloudinary.com/v1_1/test-cloud/image/upload',
    );
    const form = init!.body as FormData;
    assert.equal(form.get('overwrite'), 'false');
    assert.equal(form.get('asset_folder'), 'goease/avatars');
    assert.match(String(form.get('signature')), /^[a-f0-9]{40}$/);
    const id = String(form.get('public_id'));
    assert.match(id, /^goease\/avatars\/[a-f0-9-]{36}$/);
    return Response.json({
      public_id: id,
      width: 512,
      height: 512,
      format: 'webp',
      secure_url: `https://res.cloudinary.com/test-cloud/image/upload/v1/${id}.webp`,
    });
  };
  assert.match(
    await avatarUploader(config, send)(await picture()),
    /^https:\/\/res.cloudinary.com\/test-cloud\//,
  );
  assert.equal(calls, 1);
  await assert.rejects(
    avatarUploader({}, send)(await picture()),
    (e: unknown) => e instanceof HttpError && e.status === 503,
  );
  assert.equal(calls, 1);
  for (const bad of [
    async () => {
      throw new Error('SECRET_SENTINEL');
    },
    async () => new Response('KEY_SENTINEL', { status: 429 }),
    async () => new Response('x'.repeat(33000)),
    async () =>
      Response.json({ secure_url: 'https://evil.invalid/image.webp' }),
  ]) {
    await assert.rejects(
      avatarUploader(config, bad)(await picture()),
      (e: unknown) =>
        e instanceof HttpError &&
        e.status === 502 &&
        !e.message.includes('SENTINEL'),
    );
  }
});
