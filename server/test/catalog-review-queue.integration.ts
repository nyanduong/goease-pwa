import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Types } from 'mongoose';
import { parseConfig } from '../src/config.js';
import { createDatabase } from '../src/database.js';
import { createLogger } from '../src/observability/logger.js';
import { createProduct } from '../src/product.js';
import { startTestReplicaSet } from './support/replica-set.js';

test(
  'review queue preserves blockers, scope and counts at 27000 places with runtime socket timeout',
  { timeout: 120000 },
  async (t) => {
    const harness = await startTestReplicaSet();
    const uri = `mongodb://127.0.0.1:27021/${harness.connection.name}?replicaSet=${harness.setName}`;
    // Use the actual runtime connection policy, including socketTimeoutMS=2000.
    const database = createDatabase(
      uri,
      createLogger('test', () => {}),
    );
    try {
      await database.start();
      const product = createProduct(
        database.connection,
        parseConfig({
          NODE_ENV: 'test',
          CLIENT_ORIGIN: 'http://localhost:5180',
          MONGODB_URI: uri,
        }),
      );
      await product.initialize();
      const { Place } = product.explore.models;
      const { Review } = product.operations.models;
      const admin = await product.auth.models.User.create({
        emailNormalized: 'review-queue@example.invalid',
        displayName: 'Review queue fixture',
        roles: ['admin'],
      });
      const customer = await product.auth.models.User.create({
        emailNormalized: 'review-customer@example.invalid',
        displayName: 'Customer fixture',
      });
      const destinationId = new Types.ObjectId();
      const otherDestinationId = new Types.ObjectId();
      const price = {
        label: 'Vé fixture',
        amountMinor: 10000,
        basis: 'per_person',
        maxTravelers: 10,
        conditions: 'Chỉ kiểm thử',
        sourceUrl: 'https://example.invalid/price',
        checkedAt: '2020-01-01',
        reviewAfter: '2020-01-02',
      };
      const template = new Place({
        destinationId,
        name: 'Queue fixture',
        description: 'Địa điểm chỉ dùng kiểm thử hàng chờ.',
        category: 'culture',
        venueType: 'place',
        sourceUrl: 'https://example.invalid/place',
        imageCredit: 'Fixture',
        revision: 1,
        searchText: 'queue fixture',
      }).toObject();
      const openSource = new Types.ObjectId();
      const snoozedDuplicate = new Types.ObjectId();
      const resolvedSource = new Types.ObjectId();
      const published = new Types.ObjectId();
      const archived = new Types.ObjectId();
      const deleted = new Types.ObjectId();
      const outside = new Types.ObjectId();
      const old = new Date('2020-01-01T00:00:00Z');
      await Place.collection.insertMany(
        [
          { _id: openSource },
          { _id: snoozedDuplicate },
          { _id: resolvedSource },
          {
            _id: published,
            publicationStatus: 'published',
            referencePrice: price,
          },
          {
            _id: archived,
            publicationStatus: 'archived',
            referencePrice: price,
          },
          { _id: deleted, deletedAt: new Date() },
          { _id: outside, destinationId: otherDestinationId },
        ].map((value) => ({
          ...template,
          createdAt: old,
          updatedAt: old,
          ...value,
        })),
      );
      for (const placeId of [openSource, published, archived, deleted])
        await Review.create({
          placeId,
          kind: 'source',
          signature: 'fixture-source',
          updatedAt: old,
        });
      await Review.create({
        placeId: snoozedDuplicate,
        kind: 'duplicate',
        signature: 'fixture-duplicate',
        state: 'snoozed',
        revisitAt: new Date(Date.now() + 86400000),
      });
      await Review.create({
        placeId: resolvedSource,
        kind: 'source',
        signature: 'fixture-resolved',
        state: 'resolved',
      });
      await Review.create({
        placeId: archived,
        kind: 'price',
        signature: 'fixture-price',
      });
      const queue = (
        offset = 0,
        kind?: string,
        q = '',
        sort: 'priority' | 'newest' = 'priority',
      ) =>
        product.operations.reviews(
          admin._id,
          offset,
          String(destinationId),
          kind,
          q,
          sort,
        );

      await assert.rejects(product.operations.reviews(customer._id), {
        status: 403,
      });
      const scoped = await queue();
      assert.equal(scoped.total, 5);
      assert.deepEqual(scoped.counts, {
        draft: 1,
        duplicate: 0,
        source: 3,
        price: 1,
        quality: 0,
      });
      assert.equal(scoped.publishedCount, 2);
      assert.equal(scoped.items[0]!.place.id, String(published));
      assert.equal(
        scoped.items.filter((item) => item.kind === 'draft')[0]!.place.id,
        String(resolvedSource),
      );
      assert.ok(
        !scoped.items.some((item) =>
          [String(deleted), String(outside), String(snoozedDuplicate)].includes(
            item.place.id,
          ),
        ),
      );
      const drafts = await queue(0, 'draft');
      assert.equal(drafts.total, 1);
      assert.deepEqual(drafts.counts, scoped.counts);
      assert.equal(drafts.publishedCount, scoped.publishedCount);
      assert.equal((await queue(0, undefined, 'does-not-match')).total, 0);
      assert.equal((await product.operations.reviews(admin._id)).total, 6);
      const newest = await queue(0, undefined, '', 'newest');
      assert.ok(
        newest.items.every(
          (item, index) =>
            index === 0 || item.updatedAt <= newest.items[index - 1]!.updatedAt,
        ),
      );

      // A snoozed blocker still hides the draft; resolving it releases the draft.
      await Review.updateOne(
        { placeId: snoozedDuplicate, kind: 'duplicate' },
        { $set: { state: 'resolved' } },
      );
      assert.equal((await queue()).counts.draft, 2);
      await Review.updateOne(
        { placeId: openSource, kind: 'source' },
        { $set: { state: 'snoozed', revisitAt: new Date(Date.now() - 1000) } },
      );
      assert.equal((await queue()).counts.source, 3);

      // Real-size regression: the former per-review correlated lookup exceeded
      // the runtime socket timeout. No application DB or live provider is used.
      for (let start = 0; start < 27000; start += 1000)
        await Place.collection.insertMany(
          Array.from({ length: 1000 }, (_, index) => ({
            ...template,
            _id: new Types.ObjectId(),
            name: `Scale queue fixture ${start + index}`,
            searchText: `scale queue fixture ${start + index}`,
            createdAt: new Date(),
            updatedAt: new Date(),
          })),
        );
      const started = performance.now();
      const large = await queue(6000, 'draft', 'scale queue fixture');
      assert.equal(large.total, 27000);
      assert.equal(large.counts.draft, 27000);
      assert.equal(large.items.length, 20);
      assert.equal(large.hasMore, true);
      const next = await queue(6020, 'draft', 'scale queue fixture');
      assert.ok(
        next.items.every(
          (item) => !large.items.some((previous) => previous.id === item.id),
        ),
      );
      const all = await product.operations.reviews(admin._id);
      assert.equal(all.total, 27007);
      assert.equal(all.counts.draft, 27003);
      assert.equal(
        Object.values(all.counts).reduce((sum, count) => sum + count, 0),
        all.total,
      );
      t.diagnostic(
        `27000-fixture reconciliation and three paged/count reads: ${Math.round(performance.now() - started)}ms; runtime 2s socket timeout retained.`,
      );
    } finally {
      await database.close();
      await harness.stop();
    }
  },
);
