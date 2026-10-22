import { randomUUID } from 'node:crypto';
import { Schema, type Connection } from 'mongoose';
import { uuidPattern } from '../../observability/context.js';

export const dedupeIndexName = 'audit_operation_entity_unique';

// Kept inside this feature. Consumers receive an append/read service, not the model.
export function auditModel(connection: Connection) {
  const actor = new Schema(
    {
      type: { type: String, enum: ['system', 'user'], required: true },
      serviceName: {
        type: String,
        enum: ['goease-integration-test', 'auth'],
      },
      userId: { type: Schema.Types.ObjectId },
    },
    { _id: false, strict: 'throw', versionKey: false },
  );
  const source = new Schema(
    {
      appVersion: { type: String, enum: ['0.0.0'], required: true },
      clientPlatform: { type: String, enum: ['server', 'web'], required: true },
      channel: {
        type: String,
        enum: ['integration_test', 'api'],
        required: true,
      },
      environment: {
        type: String,
        enum: ['test', 'development', 'production'],
        required: true,
      },
    },
    { _id: false, strict: 'throw', versionKey: false },
  );
  const change = new Schema(
    {
      path: { type: String, enum: ['probeState'], required: true },
      before: { type: String, enum: ['pending', 'verified'] },
      after: { type: String, enum: ['pending', 'verified'], required: true },
      redacted: {
        type: Boolean,
        validate: (v: boolean) => v === false,
        required: true,
      },
    },
    { _id: false, strict: 'throw', versionKey: false },
  );
  const uuid = { type: String, match: uuidPattern, required: true } as const;
  const schema = new Schema(
    {
      eventId: { ...uuid, default: randomUUID, immutable: true },
      schemaVersion: { type: Number, enum: [1], default: 1, immutable: true },
      action: {
        type: String,
        enum: [
          'system.audit_probe',
          'auth.registered',
          'profile.updated',
          'password.changed',
          'password.reset',
          'auth.email_verified',
          'auth.failed',
          'session.created',
          'session.revoked',
          'trip.created',
          'trip.updated',
          'trip.deleted',
          'trip.restored',
          'trip.duplicated',
          'trip.share_created',
          'trip.share_revoked',
          'expense.created',
          'expense.updated',
          'expense.deleted',
        ],
        required: true,
      },
      category: {
        type: String,
        enum: ['system', 'auth', 'trip'],
        required: true,
      },
      actor: { type: actor, required: true },
      entityType: {
        type: String,
        enum: ['system_probe', 'user', 'auth_session', 'trip', 'trip_expense'],
        required: true,
      },
      entityId: { type: String, match: /^[0-9a-f]{24}$/, required: true },
      entityRevision: { type: Number, min: 0, max: Number.MAX_SAFE_INTEGER },
      occurredAt: { type: Date, required: true },
      recordedAt: { type: Date, required: true },
      requestId: uuid,
      correlationId: { type: String, match: uuidPattern },
      operationId: uuid,
      outcome: { type: String, enum: ['succeeded', 'failed'], required: true },
      reasonCode: { type: String, enum: ['probe_completed', 'probe_failed'] },
      changedFields: {
        type: [
          {
            type: String,
            enum: [
              'probeState',
              'tripDetails',
              'accountState',
              'sessionState',
              'expenseDetails',
            ],
          },
        ],
        default: [],
        validate: (v: string[]) => v.length <= 1,
      },
      changes: {
        type: [change],
        default: [],
        validate: (v: unknown[]) => v.length <= 1,
      },
      source: { type: source, required: true },
      retentionClass: {
        type: String,
        enum: ['integration_test', 'business_audit', 'security_audit'],
        required: true,
      },
      retentionUntil: { type: Date, default: null },
      legalHold: {
        type: Boolean,
        validate: (v: boolean) => v === false,
        default: false,
      },
    },
    {
      collection: 'audit_logs',
      strict: 'throw',
      versionKey: false,
      autoCreate: false,
      autoIndex: false,
      timestamps: { createdAt: true, updatedAt: false },
    },
  );
  schema.index({ eventId: 1 }, { unique: true });
  schema.index(
    { operationId: 1, action: 1, entityType: 1, entityId: 1 },
    { unique: true, name: dedupeIndexName },
  );
  schema.index({ entityType: 1, entityId: 1, occurredAt: -1 });
  schema.index({ 'actor.userId': 1, occurredAt: -1 });
  schema.index({ requestId: 1 });
  return connection.model('AuditLog', schema);
}
