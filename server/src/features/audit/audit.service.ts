import mongoose, { type ClientSession, type Connection } from 'mongoose';
import { z } from 'zod';
import { uuidPattern } from '../../observability/context.js';
import { auditModel } from './audit.model.js';

const probeSchema = z
  .strictObject({
    action: z.literal('system.audit_probe'),
    category: z.literal('system'),
    entityType: z.literal('system_probe'),
    entityId: z.string().regex(/^[0-9a-f]{24}$/),
    entityRevision: z
      .number()
      .int()
      .min(0)
      .max(Number.MAX_SAFE_INTEGER)
      .optional(),
    operationId: z
      .string()
      .regex(uuidPattern)
      .transform((v) => v.toLowerCase()),
    requestId: z
      .string()
      .regex(uuidPattern)
      .transform((v) => v.toLowerCase()),
    correlationId: z
      .string()
      .regex(uuidPattern)
      .transform((v) => v.toLowerCase())
      .optional(),
    outcome: z.enum(['succeeded', 'failed']),
    reasonCode: z.enum(['probe_completed', 'probe_failed']).optional(),
    changedFields: z.array(z.literal('probeState')).max(1).default([]),
    changes: z
      .array(
        z.strictObject({
          path: z.literal('probeState'),
          before: z.enum(['pending', 'verified']).optional(),
          after: z.enum(['pending', 'verified']),
          redacted: z.literal(false),
        }),
      )
      .max(1)
      .default([]),
  })
  .refine(
    (v) =>
      v.changedFields.length === v.changes.length &&
      v.changes.every((c) => v.changedFields.includes(c.path)),
  )
  .refine(
    (v) =>
      !v.reasonCode ||
      v.reasonCode ===
        (v.outcome === 'succeeded' ? 'probe_completed' : 'probe_failed'),
  );

export class AuditConflictError extends Error {
  constructor() {
    super('Audit operation conflicts with existing business content');
  }
}
export class AuditTransactionRaceError extends Error {
  constructor() {
    super('Audit race: abort and retry the whole transaction');
  }
}

// Parsing errors deliberately omit Zod issues (which may contain untrusted values).
export function validateProbe(input: unknown) {
  const parsed = probeSchema.safeParse(input);
  if (!parsed.success) throw new Error('Invalid audit probe');
  return parsed.data;
}

function businessContent(value: ReturnType<typeof validateProbe>) {
  return JSON.stringify({
    action: value.action,
    category: value.category,
    entityType: value.entityType,
    entityId: value.entityId,
    entityRevision: value.entityRevision ?? null,
    outcome: value.outcome,
    reasonCode: value.reasonCode ?? null,
    changedFields: value.changedFields,
    changes: value.changes.map((v) => ({
      path: v.path,
      before: v.before ?? null,
      after: v.after,
      redacted: v.redacted,
    })),
  });
}

function isDedupeRace(error: unknown) {
  if (
    !(error instanceof mongoose.mongo.MongoServerError) ||
    error.code !== 11000
  )
    return false;
  // Do not swallow collisions from eventId or any unrelated unique constraint.
  return (
    JSON.stringify(error.keyPattern) ===
    JSON.stringify({ operationId: 1, action: 1, entityType: 1, entityId: 1 })
  );
}

export function createAuditService(connection: Connection) {
  // F1-B's only action is test-only; never accept HTTP actor/source or emit startup probes.
  if (
    process.env.NODE_ENV === 'production' ||
    connection.host !== '127.0.0.1' ||
    connection.port !== 27021 ||
    !/^goease_f1b_test_[0-9a-f]{32}$/.test(connection.name)
  ) {
    throw new Error('Audit probe requires a dedicated F1-B test database');
  }
  const model = auditModel(connection);
  function key(value: ReturnType<typeof validateProbe>) {
    return {
      operationId: value.operationId,
      action: value.action,
      entityType: value.entityType,
      entityId: value.entityId,
    };
  }
  async function readExisting(
    value: ReturnType<typeof validateProbe>,
    session?: ClientSession,
  ) {
    return model
      .findOne(key(value))
      .session(session ?? null)
      .lean()
      .exec();
  }
  function reconcile(
    existing: NonNullable<Awaited<ReturnType<typeof readExisting>>>,
    value: ReturnType<typeof validateProbe>,
  ) {
    if (
      existing.actor.type !== 'system' ||
      existing.actor.serviceName !== 'goease-integration-test' ||
      existing.source.environment !== 'test' ||
      existing.source.channel !== 'integration_test' ||
      existing.source.clientPlatform !== 'server' ||
      existing.retentionClass !== 'integration_test'
    )
      throw new AuditConflictError();
    const stored = validateProbe({
      action: existing.action,
      category: existing.category,
      entityType: existing.entityType,
      entityId: existing.entityId,
      entityRevision: existing.entityRevision,
      operationId: existing.operationId,
      requestId: existing.requestId,
      outcome: existing.outcome,
      reasonCode: existing.reasonCode,
      changedFields: existing.changedFields,
      changes: existing.changes.map((c) => ({
        path: c.path,
        before: c.before,
        after: c.after,
        redacted: c.redacted,
      })),
    });
    if (businessContent(stored) !== businessContent(value))
      throw new AuditConflictError();
    return { eventId: existing.eventId, deduplicated: true };
  }
  return Object.freeze({
    // Explicit and additive; caller must invoke only in its owned test DB, outside transactions.
    async initialize() {
      await model.createCollection();
      await model.createIndexes();
    },
    async appendProbe(input: unknown, session?: ClientSession) {
      const value = validateProbe(input);
      const inTransaction = session?.inTransaction() ?? false;
      const existing = await readExisting(value, session);
      if (existing) return reconcile(existing, value);
      const now = new Date();
      try {
        const created = await new model({
          ...value,
          actor: { type: 'system', serviceName: 'goease-integration-test' },
          source: {
            appVersion: '0.0.0',
            clientPlatform: 'server',
            channel: 'integration_test',
            environment: 'test',
          },
          retentionClass: 'integration_test',
          occurredAt: now,
          recordedAt: now,
        }).save({ session: session ?? null });
        return { eventId: created.eventId, deduplicated: false };
      } catch (error) {
        if (!isDedupeRace(error)) throw error;
        // Mongo aborts a transaction after E11000; never query/fallback outside its session.
        if (inTransaction) throw new AuditTransactionRaceError();
        const winner = await readExisting(value, session);
        if (!winner) throw error;
        return reconcile(winner, value);
      }
    },
    async findProbe(
      operationId: string,
      entityId: string,
      session?: ClientSession,
    ) {
      if (!uuidPattern.test(operationId) || !/^[0-9a-f]{24}$/.test(entityId))
        throw new Error('Invalid audit reference');
      return model
        .findOne({
          operationId: operationId.toLowerCase(),
          entityId,
          action: 'system.audit_probe',
        })
        .session(session ?? null)
        .lean()
        .exec();
    },
  });
}
