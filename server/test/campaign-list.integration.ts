import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { Types } from 'mongoose';
import { campaignListQuerySchema } from '@goease/contracts';
import { createProduct } from '../src/product.js';
import { parseConfig } from '../src/config.js';
import { startTestReplicaSet } from './support/replica-set.js';

test(
  'campaign list: persisted results, filters, global totals, Vietnam day and admin boundary',
  { timeout: 60000 },
  async () => {
    const harness = await startTestReplicaSet();
    const { connection } = harness;
    const product = createProduct(
      connection,
      parseConfig({
        NODE_ENV: 'test',
        CLIENT_ORIGIN: 'http://localhost:5180',
        MONGODB_URI: `mongodb://127.0.0.1:27021/${connection.name}?replicaSet=${harness.setName}`,
      }),
    );
    try {
      await product.initialize();
      const admin = await product.auth.models.User.create({
        emailNormalized: 'campaign-list@example.invalid',
        displayName: 'Fixture admin',
        roles: ['admin'],
        status: 'active',
      });
      const member = await product.auth.models.User.create({
        emailNormalized: 'campaign-member@example.invalid',
        displayName: 'Fixture member',
        roles: [],
        status: 'active',
      });
      const { Campaign } = product.v3.models;
      const { Run } = product.operations.models;
      const destinationId = new Types.ObjectId().toString();
      const now = new Date();
      const vietnamDay = new Date(now.getTime() + 7 * 3600000)
        .toISOString()
        .slice(0, 10);
      const start = new Date(`${vietnamDay}T00:00:00+07:00`);
      const ids: string[] = [];
      for (let i = 0; i < 25; i++) {
        const campaign = await Campaign.create({
          actorId: admin._id,
          requestKey: randomUUID(),
          requestHash: 'fixture',
          policy: { autoPublish: false },
          state: i === 24 ? 'paused' : 'active',
        });
        ids.push(String(campaign._id));
        await Run.create({
          campaignId: campaign._id,
          scope: destinationId,
          active: false,
          state:
            i === 22
              ? 'failed'
              : i === 23
                ? 'running'
                : i === 24
                  ? 'paused'
                  : 'succeeded',
          group: 'sights',
          finishedAt: i < 20 ? new Date(start.getTime() - 1) : now,
          scopeSnapshot: {
            destinationId,
            destinationName: i === 21 ? 'Hà Nội [.*]' : 'Hà Nội',
            latitude: 21.02,
            longitude: 105.85,
            radiusMeters: 5000,
          },
          counts: {
            created: i,
            updated: 2,
            review: 3,
            errors: i === 22 ? 1 : 0,
          },
        });
      }
      const query = (value: object = {}) =>
        campaignListQuerySchema.parse(value);
      const first = await product.v3.campaigns(admin._id, query());
      assert.equal(first.items.length, 20);
      assert.equal(first.total, 25);
      assert.equal(first.hasMore, true);
      assert.deepEqual(first.summary, {
        running: 1,
        completedToday: 2,
        issues: 1,
      });
      const second = await product.v3.campaigns(
        admin._id,
        query({ offset: 20 }),
      );
      assert.equal(second.items.length, 5);
      assert.equal(second.hasMore, false);
      assert.equal(
        new Set([...first.items, ...second.items].map((c) => c.id)).size,
        25,
      );
      const literal = await product.v3.campaigns(
        admin._id,
        query({ q: '[.*]' }),
      );
      assert.equal(literal.total, 1);
      assert.equal(literal.items[0]!.id, ids[21]);
      assert.deepEqual(literal.summary, first.summary);
      assert.deepEqual(literal.items[0]!.counts, {
        created: 21,
        updated: 2,
        review: 3,
        errors: 0,
      });
      assert.deepEqual(literal.items[0]!.groups, ['sights']);
      assert.equal(literal.items[0]!.destinations[0]!.name, 'Hà Nội [.*]');
      const detail = await product.v3.campaignDetail(admin._id, ids[21]!);
      const { policy, ...detailSummary } = detail.campaign;
      assert.equal(policy.autoPublish, false);
      assert.deepEqual(literal.items[0], detailSummary);
      const failed = await product.v3.campaigns(
        admin._id,
        query({ state: 'issues', destinationId }),
      );
      assert.equal(failed.total, 1);
      assert.equal(failed.items[0]!.state, 'failed');
      assert.equal(
        (
          await product.v3.campaigns(
            admin._id,
            query({ q: ids[22]!.slice(-8) }),
          )
        ).total,
        1,
      );
      assert.equal(
        (await product.v3.campaigns(admin._id, query({ state: 'paused' })))
          .total,
        1,
      );
      assert.equal(
        (
          await product.v3.campaigns(
            admin._id,
            query({ destinationId: new Types.ObjectId().toString() }),
          )
        ).total,
        0,
      );
      await assert.rejects(
        product.v3.campaigns(member._id, query()),
        /quyền|quản trị/i,
      );
      assert.equal(
        campaignListQuerySchema.safeParse({ state: 'anything' }).success,
        false,
      );
      assert.equal(
        campaignListQuerySchema.safeParse({ destinationId: 'invalid' }).success,
        false,
      );
      assert.equal(
        campaignListQuerySchema.safeParse({ offset: -1 }).success,
        false,
      );
      assert.equal(
        campaignListQuerySchema.safeParse({ q: 'x'.repeat(101) }).success,
        false,
      );
      assert.equal(await Campaign.countDocuments(), 25);
      assert.equal(await Run.countDocuments(), 25);
      // A successful task can still contain item-level errors; never hide these.
      await Run.updateOne(
        { campaignId: ids[21]! },
        { $set: { 'counts.errors': 2 } },
      );
      const withItemErrors = await product.v3.campaigns(
        admin._id,
        query({ state: 'issues' }),
      );
      assert.equal(withItemErrors.total, 2);
      assert.equal(withItemErrors.summary.issues, 2);
      assert.equal(
        withItemErrors.items.find((c) => c.id === ids[21])!.state,
        'succeeded',
      );
      // Keep the old scope alias compatible with the existing detail endpoint.
      await Run.updateOne(
        { campaignId: ids[24]! },
        { $set: { scope: 'hoi-an', scopeSnapshot: null } },
      );
      const legacy = await product.v3.campaigns(
        admin._id,
        query({ destinationId: '000000000000000000000004' }),
      );
      assert.equal(legacy.total, 1);
      assert.equal(legacy.items[0]!.id, ids[24]);
    } finally {
      await harness.stop();
    }
  },
);
