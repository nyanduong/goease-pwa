import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { Types } from 'mongoose';
import { visitProgressQuerySchema } from '@goease/contracts';
import { createProduct } from '../src/product.js';
import { parseConfig } from '../src/config.js';
import { startTestReplicaSet } from './support/replica-set.js';
test(
  'progress aggregates the full scope, preserves zero prices and old results, authorizes and paginates without writes',
  { timeout: 90000 },
  async () => {
    const h = await startTestReplicaSet();
    try {
      const p = createProduct(
        h.connection,
        parseConfig({
          NODE_ENV: 'test',
          CLIENT_ORIGIN: 'http://localhost:5180',
          MONGODB_URI: `mongodb://127.0.0.1:27021/${h.connection.name}?replicaSet=${h.setName}`,
        }),
      );
      await p.initialize(true);
      const actor = (
        await p.auth.models.User.create({
          emailNormalized: 'progress-admin@example.invalid',
          displayName: 'Admin',
          roles: ['admin'],
          status: 'active',
        })
      )._id;
      const user = (
        await p.auth.models.User.create({
          emailNormalized: 'progress-user@example.invalid',
          displayName: 'User',
          roles: ['traveler'],
          status: 'active',
        })
      )._id;
      const d = (await p.trips.models.Destination.findOne({
        provinceCode: '48',
      }))!;
      const place = (
        await p.catalog.write(
          actor,
          {
            destinationId: String(d._id),
            name: 'Base',
            category: 'culture',
            venueType: 'place',
            description: 'Fixture',
            locationQuery: 'Fixture',
            durationMinutes: 60,
            openingHoursNote: '',
            sourceUrl: 'https://www.openstreetmap.org/node/1',
            referencePrice: null,
            publicationStatus: 'draft',
          },
          randomUUID(),
        )
      ).place;
      const base = (await p.explore.models.Place.findById(
        place.id,
      ))!.toObject();
      await p.explore.models.Place.deleteOne({ _id: place.id });
      const evidence = {
        sourceUrl: 'https://example.com',
        observedAt: new Date().toISOString(),
        reviewed: false,
      };
      const result = {
        hours: { ...evidence, text: '08:00–17:00' },
        price: {
          ...evidence,
          amount: 0,
          currency: 'VND',
          unit: 'person',
          conditions: 'Free ticket',
        },
      };
      const seed = (
        name: string,
        state: string,
        extra: Record<string, unknown> = {},
      ) => ({
        ...base,
        _id: new Types.ObjectId(),
        name,
        source: {
          provider: 'geoapify',
          externalId: name,
          fetchedAt: new Date(),
          attribution: 'Powered by Geoapify · © OpenStreetMap contributors',
          license: 'ODbL-1.0',
        },
        visitSearch: { state, attempts: 1, checkedAt: new Date() },
        ...extra,
      });
      const fixtures = [
        seed('Old hours', 'pending', {
          visitSearch: {
            state: 'pending',
            context: 'old',
            result: { hours: result.hours, price: null },
          },
        }),
        seed('Searching', 'searching', {
          visitSearch: {
            state: 'searching',
            leaseUntil: new Date(Date.now() + 60000),
          },
        }),
        seed('Expired', 'searching', {
          visitSearch: { state: 'searching', leaseUntil: new Date(0) },
        }),
        seed('Both free', 'ready', { visitSearch: { state: 'ready', result } }),
        seed('Empty', 'empty'),
        seed('Failed', 'failed'),
        seed('Published pending', 'pending', {
          publicationStatus: 'published',
        }),
        seed('Not queued', 'pending', { visitSearch: undefined }),
        seed('Other region', 'ready', {
          destinationId: new Types.ObjectId(),
          visitSearch: {
            state: 'ready',
            result: { hours: null, price: result.price },
          },
        }),
        seed('Deleted', 'ready', { deletedAt: new Date() }),
        ...Array.from({ length: 22 }, (_, i) => seed('Place.' + i, 'empty')),
      ];
      await h.connection.collection('places').insertMany(fixtures);
      const query = visitProgressQuerySchema.parse({
        destinationId: String(d._id),
      });
      await assert.rejects(p.visitProgress(user, query), {
        code: 'ADMIN_REQUIRED',
      });
      assert.equal(
        visitProgressQuerySchema.safeParse({ offset: -1 }).success,
        false,
      );
      assert.equal(
        visitProgressQuerySchema.safeParse({ state: 'invalid' }).success,
        false,
      );
      assert.equal(
        visitProgressQuerySchema.safeParse({ ownerId: 'foo' }).success,
        false,
      );
      const before = await h.connection.collection('places').find({}).toArray();
      const first = await p.visitProgress(actor, query);
      assert.equal(first.summary.total, 30);
      assert.equal(first.items.length, 20);
      assert.equal(first.hasMore, true);
      assert.equal(first.summary.hours, 2);
      assert.equal(first.summary.price, 1);
      assert.equal(first.summary.both, 1);
      assert.equal(first.summary.neither, 28);
      assert.equal(first.summary.expiredLeases, 1);
      assert.equal(first.summary.states.inactive, 1);
      assert.equal(first.summary.states.not_queued, 1);
      assert.equal(
        Object.values(first.summary.states).reduce((a, b) => a + b, 0),
        30,
      );
      const second = await p.visitProgress(actor, { ...query, offset: 20 });
      assert.equal(second.items.length, 10);
      assert.equal(second.hasMore, false);
      assert.equal(
        first.items.some((a) => second.items.some((b) => a.id === b.id)),
        false,
      );
      const old = await p.visitProgress(actor, { ...query, q: 'Old hours' });
      assert.equal(old.items[0]?.previousResult, true);
      assert.equal(old.summary.total, 1);
      const price = await p.visitProgress(actor, {
        ...query,
        coverage: 'price',
      });
      assert.equal(price.total, 1);
      assert.equal(price.items[0]?.name, 'Both free');
      assert.equal(
        price.summary.total,
        30,
        'coverage filters rows, not scope summary',
      );
      const literal = await p.visitProgress(actor, { ...query, q: 'Place.0' });
      assert.equal(literal.total, 1);
      const empty = await p.visitProgress(actor, {
        ...query,
        q: 'no such name',
      });
      assert.equal(empty.total, 0);
      assert.equal(empty.summary.total, 0);
      const all = await p.visitProgress(
        actor,
        visitProgressQuerySchema.parse({}),
      );
      assert.equal(all.summary.total, 31);
      assert.equal(all.summary.price, 2);
      assert.deepEqual(
        await h.connection.collection('places').find({}).toArray(),
        before,
        'progress is read-only',
      );
    } finally {
      await h.stop();
    }
  },
);
