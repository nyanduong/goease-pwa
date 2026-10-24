import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';
import sharp from 'sharp';
import type { AccountDto } from '@goease/contracts';
import { createApp } from '../src/app.js';
import { createProduct } from '../src/product.js';
import { parseConfig } from '../src/config.js';
import { createLogger } from '../src/observability/logger.js';
import { HttpError } from '../src/http-error.js';
import { normalizeAvatar } from '../src/features/auth/avatar-upload.js';
import { startTestReplicaSet } from './support/replica-set.js';

test(
  'avatar upload requires session/origin, bounds input and persists only to the owner through profile revision',
  { timeout: 90000 },
  async () => {
    const harness = await startTestReplicaSet();
    const config = parseConfig({
      NODE_ENV: 'test',
      CLIENT_ORIGIN: 'http://localhost:5180',
      MONGODB_URI: `mongodb://127.0.0.1:27021/${harness.connection.name}?replicaSet=${harness.setName}`,
      AUTH_MAX_ATTEMPTS: '100',
    });
    let uploads = 0,
      fail = false;
    const avatarUrl =
      'https://res.cloudinary.com/test/image/upload/v1/goease/avatars/test.webp';
    const product = createProduct(harness.connection, config, {
      avatarUpload: async (bytes) => {
        await normalizeAvatar(bytes);
        uploads++;
        if (fail)
          throw new HttpError(
            502,
            'AVATAR_UPLOAD_FAILED',
            'Chưa tải được ảnh.',
          );
        return avatarUrl;
      },
    });
    await product.initialize();
    const logs: string[] = [];
    const server = createApp(
      config,
      async () => {},
      createLogger('test', (line) => logs.push(line)),
      product.router,
    ).listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
    const headers = { Origin: config.CLIENT_ORIGIN, 'X-GoEase-Client': 'web' };
    const json = (path: string, body: unknown, cookie = '') =>
      fetch(base + path, {
        method: 'POST',
        headers: {
          ...headers,
          Cookie: cookie,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    const read = async (cookie: string) =>
      (
        (await (
          await fetch(base + '/me/profile', { headers: { Cookie: cookie } })
        ).json()) as { data: AccountDto }
      ).data;
    try {
      const register = async (email: string) => {
        const r = await json('/auth/register', {
          email,
          displayName: 'Avatar fixture',
          password: 'Avatar-test-only-2026',
        });
        assert.equal(r.status, 201);
        return r.headers.get('set-cookie')!.split(';')[0]!;
      };
      const a = await register('avatar-a@example.invalid'),
        b = await register('avatar-b@example.invalid');
      const before = await read(a),
        other = await read(b);
      const picture = await sharp({
        create: { width: 512, height: 512, channels: 3, background: '#669999' },
      })
        .jpeg()
        .toBuffer();
      const upload = (
        cookie: string,
        bytes: Buffer = picture,
        type = 'image/jpeg',
        origin = config.CLIENT_ORIGIN,
      ) =>
        fetch(base + '/me/avatar', {
          method: 'POST',
          headers: {
            ...headers,
            Cookie: cookie,
            Origin: origin,
            'Content-Type': type,
          },
          body: new Uint8Array(bytes),
        });
      assert.equal((await upload('')).status, 401);
      assert.equal(
        (await upload(a, picture, 'image/jpeg', 'https://evil.invalid')).status,
        403,
      );
      assert.equal(
        (await upload(a, Buffer.from('<svg/>'), 'image/svg+xml')).status,
        415,
      );
      assert.equal((await upload(a, Buffer.from('not an image'))).status, 400);
      assert.equal(
        (await upload(a, Buffer.alloc(2 * 1024 * 1024 + 1))).status,
        413,
      );
      assert.equal(uploads, 0);
      const response = await upload(a);
      assert.equal(response.status, 200);
      assert.equal(
        ((await response.json()) as { data: { avatarUrl: string } }).data
          .avatarUrl,
        avatarUrl,
      );
      assert.deepEqual(await read(a), before);
      const save = await fetch(base + '/me/profile', {
        method: 'PATCH',
        headers: { ...headers, Cookie: a, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: before.user.displayName,
          avatarUrl,
          expectedRevision: before.revision,
        }),
      });
      assert.equal(save.status, 200);
      assert.equal((await read(a)).user.avatarUrl, avatarUrl);
      assert.deepEqual(await read(b), other);
      fail = true;
      assert.equal((await upload(a)).status, 502);
      assert.equal((await read(a)).user.avatarUrl, avatarUrl);
      assert.equal(logs.join('').includes(avatarUrl), false);
      for (let i = 0; i < 6; i++) await upload(a);
      assert.equal((await upload(a)).status, 429);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await harness.stop();
    }
  },
);
