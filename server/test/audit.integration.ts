import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import mongoose from 'mongoose';
import {
  createAuditService,
  AuditConflictError,
  AuditTransactionRaceError,
} from '../src/features/audit/audit.service.js';
import { startTestReplicaSet } from './support/replica-set.js';

test(
  'real replica set: APPEND indexes, atomic commit/rollback, audit failure, dedupe and conflicts',
  { timeout: 90_000 },
  async (t) => {
    const harness = await startTestReplicaSet();
    const { connection } = harness;
    try {
      const audit = createAuditService(connection);
      await audit.initialize();
      const collection = connection.db!.collection('audit_logs');
      const fixture = connection.db!.collection('f1b_test_fixtures');
      await connection.db!.createCollection('f1b_test_fixtures');
      const probe = () => ({
        action: 'system.audit_probe',
        category: 'system',
        entityType: 'system_probe',
        entityId: new mongoose.Types.ObjectId().toHexString(),
        operationId: randomUUID(),
        requestId: randomUUID(),
        outcome: 'succeeded',
        reasonCode: 'probe_completed',
        changedFields: ['probeState'],
        changes: [
          {
            path: 'probeState',
            before: 'pending',
            after: 'verified',
            redacted: false,
          },
        ],
      });
      await t.test(
        'real indexes match baseline and APPEND has no mutable timestamps',
        async () => {
          const indexes = await collection.indexes();
          for (const [key, unique] of [
            [{ eventId: 1 }, true],
            [{ operationId: 1, action: 1, entityType: 1, entityId: 1 }, true],
            [{ entityType: 1, entityId: 1, occurredAt: -1 }, false],
            [{ 'actor.userId': 1, occurredAt: -1 }, false],
            [{ requestId: 1 }, false],
          ] as const)
            assert.ok(
              indexes.some(
                (index) =>
                  JSON.stringify(index.key) === JSON.stringify(key) &&
                  Boolean(index.unique) === unique,
              ),
            );
          assert.ok(
            indexes.every((index) => index.expireAfterSeconds === undefined),
          );
          assert.deepEqual(Object.keys(audit).sort(), [
            'appendProbe',
            'findProbe',
            'initialize',
          ]);
        },
      );
      await t.test(
        'commit stores fixture and audit with one session',
        async () => {
          const input = probe();
          await connection.transaction(async (session) => {
            await fixture.insertOne(
              { operationId: input.operationId },
              { session },
            );
            await audit.appendProbe(input, session);
          });
          assert.equal(
            await fixture.countDocuments({ operationId: input.operationId }),
            1,
          );
          const stored = await audit.findProbe(
            input.operationId,
            input.entityId,
          );
          assert.ok(stored);
          assert.equal(stored.schemaVersion, 1);
          assert.equal(stored.actor.type, 'system');
          assert.equal(stored.source.environment, 'test');
          assert.equal(stored.retentionUntil, null);
          assert.ok(
            stored.createdAt instanceof Date &&
              stored.occurredAt instanceof Date &&
              stored.recordedAt instanceof Date,
          );
          assert.equal(
            'updatedAt' in stored || 'deletedAt' in stored || '__v' in stored,
            false,
          );
        },
      );
      await t.test('error after both writes rolls back both', async () => {
        const input = probe();
        await assert.rejects(
          connection.transaction(async (session) => {
            await fixture.insertOne(
              { operationId: input.operationId },
              { session },
            );
            await audit.appendProbe(input, session);
            throw new Error('Injected failure after writes');
          }),
        );
        assert.equal(
          await fixture.countDocuments({ operationId: input.operationId }),
          0,
        );
        assert.equal(
          await audit.findProbe(input.operationId, input.entityId),
          null,
        );
      });
      await t.test(
        'real audit DB write failure rolls back fixture; unrelated E11000 propagates',
        async () => {
          const first = probe();
          await audit.appendProbe(first);
          // This additional index belongs only to this fresh test DB; it injects a real write error.
          await collection.createIndex(
            { requestId: 1 },
            { unique: true, name: 'test_only_request_unique' },
          );
          const input = { ...probe(), requestId: first.requestId };
          try {
            await assert.rejects(
              connection.transaction(async (session) => {
                await fixture.insertOne(
                  { operationId: input.operationId },
                  { session },
                );
                await audit.appendProbe(input, session);
              }),
              (error: unknown) =>
                error instanceof mongoose.mongo.MongoServerError &&
                error.code === 11000,
            );
            assert.equal(
              await fixture.countDocuments({ operationId: input.operationId }),
              0,
            );
            assert.equal(
              await audit.findProbe(input.operationId, input.entityId),
              null,
            );
          } finally {
            await collection.dropIndex('test_only_request_unique');
          }
        },
      );
      await t.test(
        'sequential retry ignores attempt requestId/timestamps, returns original event',
        async () => {
          const input = probe();
          const first = await audit.appendProbe(input);
          const second = await audit.appendProbe({
            ...input,
            requestId: randomUUID(),
            correlationId: randomUUID(),
          });
          assert.equal(first.eventId, second.eventId);
          assert.equal(second.deduplicated, true);
          assert.equal(
            await collection.countDocuments({ operationId: input.operationId }),
            1,
          );
        },
      );
      await t.test(
        'concurrent append and conflicting content do not silently succeed',
        async () => {
          const input = probe();
          const attempts = await Promise.all(
            Array.from({ length: 12 }, () =>
              audit.appendProbe({ ...input, requestId: randomUUID() }),
            ),
          );
          assert.equal(new Set(attempts.map((v) => v.eventId)).size, 1);
          assert.equal(
            await collection.countDocuments({ operationId: input.operationId }),
            1,
          );
          await assert.rejects(
            audit.appendProbe({
              ...input,
              outcome: 'failed',
              reasonCode: 'probe_failed',
            }),
            AuditConflictError,
          );
          const racing = probe();
          const conflicting = await Promise.allSettled([
            audit.appendProbe(racing),
            audit.appendProbe({
              ...racing,
              outcome: 'failed',
              reasonCode: 'probe_failed',
            }),
          ]);
          assert.equal(
            conflicting.filter((v) => v.status === 'fulfilled').length,
            1,
          );
          assert.ok(
            conflicting.some(
              (v) =>
                v.status === 'rejected' &&
                v.reason instanceof AuditConflictError,
            ),
          );
        },
      );
      await t.test(
        'transaction races retry only after abort, retain a single event',
        async () => {
          const input = probe();
          const append = async () => {
            for (let attempt = 0; attempt < 3; attempt++) {
              try {
                return await connection.transaction((session) =>
                  audit.appendProbe(input, session),
                );
              } catch (error) {
                if (
                  !(error instanceof AuditTransactionRaceError) ||
                  attempt === 2
                )
                  throw error;
              }
            }
            throw new Error('Unreachable retry limit');
          };
          const results = await Promise.all([append(), append(), append()]);
          assert.equal(new Set(results.map((v) => v.eventId)).size, 1);
          assert.equal(
            await collection.countDocuments({ operationId: input.operationId }),
            1,
          );
        },
      );
      await t.test(
        'spoofed actor/source, secret payloads and unknown taxonomy are rejected, never stored',
        async () => {
          const secret = 'F1B_PRIVATE_SECRET_email@example.invalid';
          for (const extra of [
            { actor: { type: 'admin', userId: secret, roles: ['admin'] } },
            { source: { environment: secret } },
            { notes: { nested: { passwordHash: secret } } },
            { action: 'role.granted' },
            { category: 'auth' },
            { entityType: 'users' },
            { changes: [{ path: 'notes', after: secret }] },
            { occurredAt: secret },
          ])
            await assert.rejects(audit.appendProbe({ ...probe(), ...extra }));
          assert.ok(
            !JSON.stringify(await collection.find().toArray()).includes(secret),
          );
        },
      );
      t.diagnostic(
        `Owned replica set ${harness.setName}; data retained at ${harness.dbPath}; no application DB used`,
      );
    } finally {
      await harness.stop();
    }
  },
);
