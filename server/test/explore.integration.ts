import assert from 'node:assert/strict';
import { images } from '@goease/media';
import type { PlaceStateDto } from '@goease/contracts';
async function readPayload(response: Response) {
  return (await response.json()) as {
    data: {
      items: Record<string, unknown>[];
      unavailable: { placeId: string; state: PlaceStateDto }[];
      state: PlaceStateDto;
    };
  };
}
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';
import { createProduct } from '../src/product.js';
import { createApp } from '../src/app.js';
import { parseConfig } from '../src/config.js';
import { createLogger } from '../src/observability/logger.js';
import { seedDestinations } from '../src/features/trips/destination-seed.js';
import { seedPlaces } from '../src/features/explore/explore.seed.js';
import { startTestReplicaSet } from './support/replica-set.js';

test(
  'explore HTTP catalog and private notes persist with owner isolation and revision conflicts',
  { timeout: 90000 },
  async () => {
    const harness = await startTestReplicaSet();
    const config = parseConfig({
      NODE_ENV: 'development',
      CLIENT_ORIGIN: 'http://localhost:5180',
      MONGODB_URI: `mongodb://127.0.0.1:27021/${harness.connection.name}?replicaSet=${harness.setName}`,
      AUTH_MAX_ATTEMPTS: '100',
    });
    const product = createProduct(harness.connection, config);
    const logs: string[] = [];
    await product.initialize();
    await seedDestinations(product.trips.models.Destination);
    await seedPlaces(product.explore.models.Place);
    const app = createApp(
      config,
      async () => {},
      createLogger('test', (line) => logs.push(line)),
      product.router,
    );
    const server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
    async function call(
      path: string,
      method = 'GET',
      body?: unknown,
      cookie = '',
    ) {
      return fetch(base + path, {
        method,
        headers: {
          Origin: config.CLIENT_ORIGIN,
          'X-GoEase-Client': 'web',
          'Content-Type': 'application/json',
          Cookie: cookie,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    }
    try {
      const register = async (email: string) => {
        const r = await call('/auth/register', 'POST', {
          email,
          password: 'Explore-integration-password-2026',
          displayName: 'Traveler',
        });
        assert.equal(r.status, 201);
        return (r.headers.get('set-cookie') ?? '').split(';')[0]!;
      };
      const cookieA = await register('explore-a@example.invalid');
      const cookieB = await register('explore-b@example.invalid');
      const id = '100000000000000000000001';
      // Old persisted paths must survive removal of public/images without rewriting history.
      await product.explore.models.Place.updateOne(
        { _id: id },
        { $set: { imageUrl: '/images/explore-hoian.png' } },
      );
      let r = await call('/places?q=pho%20co%20hoi%20an');
      assert.equal(r.status, 200);
      let payload = await readPayload(r);
      assert.equal(payload.data.items.length, 1);
      assert.equal(payload.data.items[0]?.id, id);
      assert.equal(payload.data.items[0]?.imageUrl, images.exploreHoian);
      assert.equal(
        (await product.explore.models.Place.findById(id))?.imageUrl,
        '/images/explore-hoian.png',
      );
      r = await call('/places?category=food');
      payload = await readPayload(r);
      assert.equal(payload.data.items.length, 2);
      assert.equal(payload.data.items[0]?.category, 'food');
      assert.equal((await call('/places?category=invalid')).status, 400);
      assert.equal((await call('/places?limit=100000')).status, 400);
      r = await call('/places?q=%2E%2A');
      payload = await readPayload(r);
      assert.equal(payload.data.items.length, 0);
      assert.equal((await call('/places/not-an-id')).status, 404);
      assert.equal((await call(`/me/places/${id}`)).status, 401);
      assert.equal(
        (
          await call(
            `/me/places/${id}`,
            'PATCH',
            {
              expectedRevision: 0,
              note: 'x',
              userId: '507f1f77bcf86cd799439011',
            },
            cookieA,
          )
        ).status,
        400,
      );
      assert.equal(
        (
          await call(
            `/me/places/${id}`,
            'PATCH',
            { expectedRevision: 0, note: 'x'.repeat(2001) },
            cookieA,
          )
        ).status,
        400,
      );
      const note = 'PRIVATE_EXPLORE_NOTE_SENTINEL';
      const race = await Promise.all([
        call(
          `/me/places/${id}`,
          'PATCH',
          { expectedRevision: 0, saved: true, note },
          cookieA,
        ),
        call(
          `/me/places/${id}`,
          'PATCH',
          { expectedRevision: 0, saved: true, note },
          cookieA,
        ),
      ]);
      assert.deepEqual(race.map((v) => v.status).sort(), [200, 409]);
      r = await call(`/me/places/${id}`, 'GET', undefined, cookieA);
      payload = await readPayload(r);
      assert.equal(payload.data.state.note, note);
      assert.equal(payload.data.state.revision, 1);
      r = await call(`/me/places/${id}`, 'GET', undefined, cookieB);
      payload = await readPayload(r);
      assert.equal(payload.data.state.note, '');
      assert.equal(payload.data.state.saved, false);
      r = await call('/me/places', 'GET', undefined, cookieA);
      payload = await readPayload(r);
      assert.equal(payload.data.items.length, 1);
      assert.ok(!(await (await call(`/places/${id}`)).text()).includes(note));
      r = await call(
        `/me/places/${id}`,
        'PATCH',
        { expectedRevision: 1, saved: false },
        cookieA,
      );
      assert.equal(r.status, 200);
      r = await call(`/me/places/${id}`, 'GET', undefined, cookieA);
      payload = await readPayload(r);
      assert.equal(payload.data.state.note, note);
      assert.equal(payload.data.state.saved, false);
      const stored = await product.explore.models.Favorite.findOne({
        targetId: id,
      });
      assert.equal(stored?.note, note);
      assert.equal(
        (
          await call(
            `/me/places/${id}`,
            'PATCH',
            { expectedRevision: 2, saved: true },
            cookieA,
          )
        ).status,
        200,
      );
      await product.explore.models.Place.updateOne(
        { _id: id },
        { $set: { publicationStatus: 'archived' } },
      );
      const unavailable = await readPayload(
        await call('/me/places', 'GET', undefined, cookieA),
      );
      assert.equal(unavailable.data.unavailable.length, 1);
      assert.equal(unavailable.data.unavailable[0]!.placeId, id);
      assert.equal(unavailable.data.unavailable[0]!.state.note, note);
      assert.ok(!JSON.stringify(unavailable.data).includes('Phố cổ Hội An'));
      assert.equal(
        (
          await call(
            `/me/places/${id}`,
            'PATCH',
            { expectedRevision: 3, saved: false },
            cookieB,
          )
        ).status,
        404,
      );
      assert.equal(
        (
          await call(
            `/me/places/${id}`,
            'PATCH',
            { expectedRevision: 2, saved: false },
            cookieA,
          )
        ).status,
        409,
      );
      assert.equal(
        (
          await call(
            `/me/places/${id}`,
            'PATCH',
            { expectedRevision: 3, saved: false },
            cookieA,
          )
        ).status,
        200,
      );
      assert.equal(
        (await readPayload(await call('/me/places', 'GET', undefined, cookieA)))
          .data.unavailable.length,
        0,
      );

      assert.equal((await call(`/places/${id}`)).status, 404);
      assert.equal(
        (
          await call(
            `/me/places/${id}`,
            'PATCH',
            { expectedRevision: 2, note: 'new' },
            cookieA,
          )
        ).status,
        404,
      );
      r = await call('/places');
      payload = await readPayload(r);
      assert.equal(payload.data.items.length, 6);
      assert.ok(!logs.join('').includes(note));
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await harness.stop();
    }
  },
);
