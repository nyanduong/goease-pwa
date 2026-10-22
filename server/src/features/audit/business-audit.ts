import { z } from 'zod';
import type { ClientSession, Connection } from 'mongoose';
import { auditModel } from './audit.model.js';
import { uuidPattern } from '../../observability/context.js';

const id = z.string().regex(/^[a-f0-9]{24}$/);
const input = z.strictObject({
  action: z.enum([
    'auth.registered',
    'profile.updated',
    'password.changed',
    'auth.email_verified',
    'auth.failed',
    'session.created',
    'session.revoked',
    'trip.created',
    'trip.updated',
    'trip.deleted',
    'trip.duplicated',
    'trip.share_created',
    'trip.share_revoked',
    'expense.created',
    'expense.updated',
    'expense.deleted',
  ]),
  actorUserId: id.optional(),
  entityId: id,
  entityRevision: z.number().int().nonnegative().optional(),
  requestId: z.string().regex(uuidPattern),
  operationId: z.string().regex(uuidPattern),
});
export function businessAudit(
  connection: Connection,
  environment: 'development' | 'test' | 'production',
) {
  const model = auditModel(connection);
  return {
    async initialize() {
      await model.createCollection();
      await model.createIndexes();
    },
    async append(value: z.infer<typeof input>, session?: ClientSession) {
      const checked = input.safeParse(value);
      if (!checked.success) throw new Error('Invalid business audit context');
      const v = checked.data;
      const expense = v.action.startsWith('expense.');
      const trip = v.action.startsWith('trip.') || expense;
      const authSession = v.action.startsWith('session.');
      if (
        (trip ||
          authSession ||
          v.action === 'auth.email_verified' ||
          v.action === 'profile.updated' ||
          v.action === 'password.changed') &&
        !v.actorUserId
      )
        throw new Error('Audit actor required');
      const now = new Date();
      await new model({
        action: v.action,
        category: trip ? 'trip' : 'auth',
        actor: v.actorUserId
          ? { type: 'user', userId: v.actorUserId }
          : { type: 'system', serviceName: 'auth' },
        entityType: expense
          ? 'trip_expense'
          : trip
            ? 'trip'
            : authSession
              ? 'auth_session'
              : 'user',
        entityId: v.entityId,
        entityRevision: v.entityRevision,
        requestId: v.requestId,
        operationId: v.operationId,
        occurredAt: now,
        recordedAt: now,
        outcome: v.action === 'auth.failed' ? 'failed' : 'succeeded',
        changedFields: [
          expense
            ? 'expenseDetails'
            : trip
              ? 'tripDetails'
              : authSession
                ? 'sessionState'
                : 'accountState',
        ],
        changes: [],
        source: {
          appVersion: '0.0.0',
          clientPlatform: 'web',
          channel: 'api',
          environment,
        },
        retentionClass: trip ? 'business_audit' : 'security_audit',
      }).save({ session: session ?? null });
    },
  };
}
