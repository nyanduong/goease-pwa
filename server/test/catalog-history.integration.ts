import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { Types } from 'mongoose';
import { catalogHistoryQuerySchema } from '@goease/contracts';
import { createProduct } from '../src/product.js';
import { parseConfig } from '../src/config.js';
import { startTestReplicaSet } from './support/replica-set.js';

test(
  'history queries persisted events before pagination, resolve operational context, preserve notes and require admin',
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
        emailNormalized: 'history-admin@example.invalid',
        displayName: 'Admin fixture',
        roles: ['admin'],
        status: 'active',
      });
      const member = await product.auth.models.User.create({
        emailNormalized: 'history-member@example.invalid',
        displayName: 'Lan fixture',
        roles: ['traveler'],
        status: 'active',
      });
      const destinationId = new Types.ObjectId(),
        placeId = new Types.ObjectId(),
        latePlaceId = new Types.ObjectId(),
        runId = new Types.ObjectId();
      // Minimal read-only lookup fixtures, not publishable catalog records.
      await connection
        .collection('destinations')
        .insertOne({ _id: destinationId, name: 'Hà Nội fixture' });
      await connection.collection('places').insertMany([
        { _id: placeId, name: 'Tượng đài fixture', destinationId },
        { _id: latePlaceId, name: 'Chùa [.*] fixture', destinationId },
      ]);
      await connection.collection('catalog_runs').insertOne({
        _id: runId,
        scopeSnapshot: { destinationName: 'Đà Nẵng fixture' },
      });
      const today = new Date(Date.now() + 7 * 3600000)
        .toISOString()
        .slice(0, 10);
      const start = new Date(`${today}T00:00:00+07:00`).getTime();
      const events = Array.from({ length: 35 }, (_, i) => ({
        _id: new Types.ObjectId(),
        eventId: randomUUID(),
        category: 'catalog',
        operationId: randomUUID(),
        action:
          i === 0
            ? 'catalog.published'
            : i === 2
              ? 'catalog.run_failed'
              : i === 3
                ? 'catalog.review_later'
                : i === 4
                  ? 'catalog.destination_updated'
                  : i === 34
                    ? 'catalog.future_action'
                    : 'catalog.proposal_saved',
        actor:
          i === 2
            ? { type: 'system', serviceName: 'fixture' }
            : {
                type: 'user',
                userId: String(i === 30 ? member._id : admin._id),
              },
        entityType: i === 2 ? 'catalog_run' : i === 4 ? 'destination' : 'place',
        entityId: String(
          i === 2
            ? runId
            : i === 4
              ? destinationId
              : i === 30
                ? latePlaceId
                : placeId,
        ),
        occurredAt: new Date(
          i < 31
            ? start + 3600000 - i * 1000
            : i === 31
              ? start - 1
              : i === 32
                ? start - 7 * 86400000
                : i === 33
                  ? start - 30 * 86400000
                  : start - 40 * 86400000,
        ),
        outcome: i === 2 ? 'failed' : 'succeeded',
        entityRevision: 4,
        previousRevision: 3,
        privateFixture: 'must-not-leak',
      }));
      await connection.collection('audit_logs').insertMany(events);
      await connection.collection('audit_logs').insertOne({
        eventId: randomUUID(),
        category: 'auth',
        action: 'auth.failed',
        occurredAt: new Date(),
      });
      await connection.collection('catalog_decisions').insertOne({
        operationId: events[3]!.operationId,
        note: 'Kiểm tra lại giờ mở cửa fixture.',
      });
      const query = (value: object = {}) =>
        catalogHistoryQuerySchema.parse(value);
      const first = await product.operations.history(admin._id, query());
      assert.equal(first.total, 35);
      assert.equal(first.items.length, 30);
      assert.equal(first.hasMore, true);
      assert.equal(first.items[0]!.name, 'Tượng đài fixture');
      assert.equal(first.items[0]!.destinationName, 'Hà Nội fixture');
      assert.equal(first.items[2]!.name, 'Đà Nẵng fixture · Lượt lấy dữ liệu');
      assert.equal(first.items[2]!.actorType, 'system');
      assert.equal(first.items[2]!.outcome, 'failed');
      assert.equal(first.items[3]!.note, 'Kiểm tra lại giờ mở cửa fixture.');
      assert.equal(first.items[4]!.name, 'Hà Nội fixture');
      const second = await product.operations.history(
        admin._id,
        query({ offset: 30 }),
      );
      assert.equal(second.items.length, 5);
      assert.equal(second.hasMore, false);
      assert.equal(
        new Set([...first.items, ...second.items].map((e) => e.id)).size,
        35,
      );
      const literal = await product.operations.history(
        admin._id,
        query({ q: '[.*]' }),
      );
      assert.equal(literal.total, 1);
      assert.equal(literal.items[0]!.placeId, String(latePlaceId));
      assert.equal(
        (
          await product.operations.history(
            admin._id,
            query({ q: 'Lan fixture' }),
          )
        ).total,
        1,
      );
      assert.equal(
        (await product.operations.history(admin._id, query({ q: 'Hệ thống' })))
          .total,
        1,
      );
      assert.equal(
        (await product.operations.history(admin._id, query({ q: 'Đà Nẵng' })))
          .total,
        1,
      );
      const publishing = await product.operations.history(
        admin._id,
        query({ kind: 'publication' }),
      );
      assert.equal(publishing.total, 1);
      assert.equal(publishing.items[0]!.action, 'catalog.published');
      assert.equal(
        (
          await product.operations.history(
            admin._id,
            query({ kind: 'editing', q: 'Lan fixture' }),
          )
        ).total,
        1,
      );
      assert.equal(
        (
          await product.operations.history(
            admin._id,
            query({ period: 'today' }),
          )
        ).total,
        31,
      );
      assert.equal(
        (
          await product.operations.history(
            admin._id,
            query({ period: '7days' }),
          )
        ).total,
        32,
      );
      assert.equal(
        (
          await product.operations.history(
            admin._id,
            query({ period: '30days' }),
          )
        ).total,
        33,
      );
      assert.equal(
        (
          await product.operations.history(
            admin._id,
            query({ q: 'Không tồn tại' }),
          )
        ).total,
        0,
      );
      await assert.rejects(
        product.operations.history(member._id, query()),
        /quyền|quản trị/i,
      );
      assert.equal(JSON.stringify(first).includes('must-not-leak'), false);
      assert.equal(
        JSON.stringify(first).includes('history-admin@example.invalid'),
        false,
      );
      for (const invalid of [
        { kind: 'invalid' },
        { period: 'invalid' },
        { offset: -1 },
        { q: 'a'.repeat(101) },
        { actorId: String(admin._id) },
      ])
        assert.equal(
          catalogHistoryQuerySchema.safeParse(invalid).success,
          false,
        );
      assert.equal(
        await connection.collection('audit_logs').countDocuments(),
        36,
      );
    } finally {
      await harness.stop();
    }
  },
);
