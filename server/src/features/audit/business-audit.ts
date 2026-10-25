import { z } from 'zod';
import type { ClientSession, Connection } from 'mongoose';
import { auditModel } from './audit.model.js';
import { uuidPattern } from '../../observability/context.js';
import { Types } from 'mongoose';
import { adminOperationsModels } from '../explore/admin-operations.models.js';

const id = z.string().regex(/^[a-f0-9]{24}$/);
const input = z.strictObject({
  action: z.enum([
    'catalog.created',
    'catalog.proposal_saved',
    'catalog.enrichment_started',
    'catalog.enrichment_controlled',
    'catalog.restore_prepared',
    'catalog.published',
    'catalog.campaign_paused',
    'catalog.campaign_resumed',
    'catalog.policy_created',
    'catalog.destination_created',
    'catalog.destination_catalogued',
    'catalog.destination_updated',
    'catalog.restored',
    'catalog.settings_saved',
    'catalog.review_keep',
    'catalog.review_reject',
    'catalog.review_revise',
    'catalog.review_apply',
    'catalog.review_ignore',
    'catalog.review_later',
    'catalog.review_distinct',
    'catalog.schedule_saved',
    'catalog.run_requested',
    'catalog.run_succeeded',
    'catalog.run_failed',
    'catalog.imported',
    'catalog.source_changed',
    'catalog.updated',
    'catalog.publication_changed',
    'admin.granted',
    'admin.revoked',
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
  ]),
  actorUserId: id.optional(),
  catalogSystem: z.literal(true).optional(),
  entityId: id,
  entityRevision: z.number().int().nonnegative().optional(),
  previousRevision: z.number().int().nonnegative().optional(),
  campaignId: id.optional(),
  batchId: id.optional(),
  runId: id.optional(),
  requestId: z.string().regex(uuidPattern),
  operationId: z.string().regex(uuidPattern),
});
export function businessAudit(
  connection: Connection,
  environment: 'development' | 'test' | 'production',
) {
  const model = auditModel(connection);
  const { Version, Settings, Decision } = adminOperationsModels(connection);
  async function capturePlace(id: string, session?: ClientSession) {
    const place = await connection
      .collection('places')
      .findOne({ _id: new Types.ObjectId(id) }, session ? { session } : {});
    if (place)
      await Version.updateOne(
        { placeId: place._id, revision: place.revision },
        { $setOnInsert: { snapshot: place } },
        { upsert: true, ...(session ? { session } : {}) },
      );
  }
  return {
    capturePlace,
    async initialize() {
      for (const m of [Version, Settings, Decision]) {
        await m.createCollection();
        await m.createIndexes();
      }
      await model.createCollection();
      await model.createIndexes();
    },
    async append(value: z.infer<typeof input>, session?: ClientSession) {
      const checked = input.safeParse(value);
      if (!checked.success) throw new Error('Invalid business audit context');
      const v = checked.data;
      const expense = v.action.startsWith('expense.');
      const catalog = v.action.startsWith('catalog.');
      const trip = v.action.startsWith('trip.') || expense;
      const authSession = v.action.startsWith('session.');
      if (
        (catalog ||
          trip ||
          authSession ||
          v.action === 'auth.email_verified' ||
          v.action === 'profile.updated' ||
          v.action === 'password.changed' ||
          v.action === 'password.reset') &&
        !v.actorUserId &&
        !(catalog && v.catalogSystem)
      )
        throw new Error('Audit actor required');
      const now = new Date();
      await new model({
        action: v.action,
        category: catalog ? 'catalog' : trip ? 'trip' : 'auth',
        actor: v.actorUserId
          ? { type: 'user', userId: v.actorUserId }
          : {
              type: 'system',
              serviceName:
                v.action === 'catalog.destination_catalogued'
                  ? 'province-catalog'
                  : catalog
                    ? 'catalog-worker'
                    : v.action.startsWith('admin.')
                      ? 'admin-bootstrap'
                      : 'auth',
            },
        entityType: v.action.startsWith('catalog.enrichment_')
          ? 'catalog_enrichment_job'
          : v.action.startsWith('catalog.campaign_')
            ? 'catalog_campaign'
            : v.action === 'catalog.policy_created'
              ? 'catalog_policy'
              : v.action.startsWith('catalog.destination_')
                ? 'destination'
                : v.action === 'catalog.schedule_saved' ||
                    v.action === 'catalog.settings_saved'
                  ? 'catalog_schedule'
                  : v.action.startsWith('catalog.run_')
                    ? 'catalog_run'
                    : catalog
                      ? 'place'
                      : expense
                        ? 'trip_expense'
                        : trip
                          ? 'trip'
                          : authSession
                            ? 'auth_session'
                            : 'user',
        entityId: v.entityId,
        entityRevision: v.entityRevision,
        previousRevision: v.previousRevision,
        campaignId: v.campaignId,
        batchId: v.batchId,
        runId: v.runId,
        requestId: v.requestId,
        operationId: v.operationId,
        occurredAt: now,
        recordedAt: now,
        outcome:
          v.action === 'auth.failed' || v.action === 'catalog.run_failed'
            ? 'failed'
            : 'succeeded',
        changedFields: [
          catalog
            ? 'catalogDetails'
            : expense
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
          clientPlatform: v.catalogSystem ? 'server' : 'web',
          channel: 'api',
          environment,
        },
        retentionClass: trip || catalog ? 'business_audit' : 'security_audit',
      }).save({ session: session ?? null });
      if (
        catalog &&
        v.entityRevision !== undefined &&
        !v.action.includes('schedule') &&
        !v.action.includes('settings') &&
        !v.action.startsWith('catalog.destination_')
      )
        await capturePlace(v.entityId, session);
    },
  };
}
