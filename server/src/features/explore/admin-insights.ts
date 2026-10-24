import { scopeKey } from './ingestion-scope.js';
import { catalogOverview } from './catalog-overview.js';
import { randomUUID } from 'node:crypto';
import { Types, type Connection } from 'mongoose';
import {
  adminPlaceInputSchema,
  type AdminOverview,
  type AdminSettings,
  type adminSettingsSchema,
} from '@goease/contracts';
import type { z } from 'zod';
import type { adminCatalog } from './admin-catalog.js';
import type { exploreService } from './explore.service.js';
import type { businessAudit } from '../audit/business-audit.js';
import { adminOperationsModels } from './admin-operations.models.js';
import { HttpError } from '../../http-error.js';
import { requestId } from '../auth/auth.service.js';

export function adminInsights(
  connection: Connection,
  catalog: ReturnType<typeof adminCatalog>,
  explore: ReturnType<typeof exploreService>,
  audit: ReturnType<typeof businessAudit>,
) {
  const { Settings, Version } = adminOperationsModels(connection);
  const defaults: AdminSettings = {
    revision: 0,
    defaultDestinationId: null,
    freshnessDays: 90,
    showQualityAlerts: true,
    autoApplyDraftHours: false,
  };
  async function settings(actor: Types.ObjectId): Promise<AdminSettings> {
    await catalog.requireAdmin(actor);
    const p = await Settings.findOne({ scope: 'global' });
    return p
      ? {
          revision: p.revision,
          defaultDestinationId: p.defaultDestinationId ?? null,
          freshnessDays: p.freshnessDays,
          showQualityAlerts: p.showQualityAlerts,
          autoApplyDraftHours: p.autoApplyDraftHours,
          regions: p.regions.map((r) => ({
            destinationId: r.destinationId!,
            latitude: r.latitude!,
            longitude: r.longitude!,
            radiusMeters: r.radiusMeters!,
            enabled: r.enabled!,
          })),
        }
      : defaults;
  }
  return {
    settings,
    async saveSettings(
      actor: Types.ObjectId,
      input: z.infer<typeof adminSettingsSchema>,
    ) {
      await catalog.requireAdmin(actor);
      // Create the singleton before the transaction; never replace another writer's values.
      await Settings.updateOne(
        { scope: 'global' },
        { $setOnInsert: { scope: 'global' } },
        { upsert: true },
      );
      await connection.transaction(async (session) => {
        await catalog.requireAdmin(actor, session);
        if (
          input.defaultDestinationId &&
          !(await connection.collection('destinations').findOne(
            {
              _id: new Types.ObjectId(input.defaultDestinationId),
              deletedAt: null,
            },
            { session },
          ))
        )
          throw new HttpError(
            400,
            'INVALID_DESTINATION',
            'Khu vực chưa được kích hoạt.',
          );
        for (const region of input.regions ?? [])
          if (
            !(await connection.collection('destinations').findOne(
              {
                _id: new Types.ObjectId(region.destinationId),
                deletedAt: null,
              },
              { session },
            ))
          )
            throw new HttpError(
              400,
              'INVALID_DESTINATION',
              'Khu vực nhập chưa được kích hoạt.',
            );
        const { expectedRevision, ...fields } = input;
        const saved = await Settings.findOneAndUpdate(
          { scope: 'global', revision: expectedRevision },
          { $set: fields, $inc: { revision: 1 } },
          { session, returnDocument: 'after', runValidators: true },
        );
        if (!saved)
          throw new HttpError(
            409,
            'CATALOG_CONFLICT',
            'Cấu hình đã thay đổi. Tải lại trước khi lưu.',
          );
        await audit.append(
          {
            action: 'catalog.settings_saved',
            entityId: String(saved._id),
            entityRevision: saved.revision,
            actorUserId: String(actor),
            operationId: randomUUID(),
            requestId: requestId(),
          },
          session,
        );
      });
      return settings(actor);
    },
    async overview(
      actor: Types.ObjectId,
      destinationId?: string,
    ): Promise<AdminOverview> {
      const config = await settings(actor);
      const [stats, places] = await Promise.all([
        catalogOverview(connection, config.freshnessDays, destinationId),
        explore.models.Place.find({
          deletedAt: null,
          ...(destinationId ? { destinationId } : {}),
        })
          .sort({ _id: 1 })
          .limit(500),
      ]);
      // The currently configured ingestion scope is explicit; another region never inherits its job health.
      const runFilter = destinationId ? { scope: scopeKey(destinationId) } : {};
      const runs = connection.collection('catalog_runs');
      const [last, success, active, succeeded, failed] = await Promise.all([
        runs.find(runFilter).sort({ createdAt: -1 }).limit(1).next(),
        runs
          .find({ ...runFilter, state: 'succeeded' })
          .sort({ finishedAt: -1 })
          .limit(1)
          .next(),
        runs.countDocuments({ ...runFilter, active: true }),
        runs.countDocuments({ ...runFilter, state: 'succeeded' }),
        runs.countDocuments({ ...runFilter, state: 'failed' }),
      ]);
      return {
        total: stats.total,
        draft: stats.draft,
        published: stats.published,
        archived: stats.archived,
        needsAttention: stats.needsAttention,
        complete: stats.complete,
        located: stats.located,
        categories: stats.categories,
        issues: stats.issues,
        places: places.map(catalog.dto),
        mapTruncated: stats.total > places.length,
        sources: {
          manual: stats.manual,
          geoapify: stats.geoapify,
          lastAttempt: last?.createdAt?.toISOString() ?? null,
          lastSuccess: success?.finishedAt?.toISOString() ?? null,
          lastError:
            last?.state === 'failed' || last?.state === 'retry'
              ? last.message
              : null,
        },
        jobs: { active, succeeded, failed },
      };
    },
    async versions(actor: Types.ObjectId, id: string) {
      await catalog.read(actor, id);
      const docs = await Version.find({ placeId: id })
        .select(
          'revision recordedAt state reason basePublicRevision snapshot.name snapshot.publicationStatus',
        )
        .sort({ revision: -1 })
        .limit(30);
      return {
        items: docs.map((p) => ({
          revision: p.revision,
          recordedAt: p.recordedAt,
          name: p.snapshot.name,
          status: p.snapshot.publicationStatus,
          state: p.state,
          reason: p.reason,
          basePublicRevision: p.basePublicRevision,
        })),
      };
    },
    async version(actor: Types.ObjectId, id: string, revision: number) {
      const current = await catalog.read(actor, id);
      const version = await Version.findOne({ placeId: id, revision });
      if (!version)
        throw new HttpError(
          404,
          'VERSION_NOT_FOUND',
          'Không có bản lưu để đối chiếu.',
        );
      const snapshot = catalog.dto(
        explore.models.Place.hydrate({
          ...version.snapshot,
          revision: version.revision,
          updatedAt: version.snapshot.updatedAt ?? version.recordedAt,
          proposalRevision: null,
        }),
      );
      // Restore replaces the saved editorial proposal, so compare that content.
      // Public content remains unchanged until an explicit publish.
      const baseline = current.place;
      const changes = Object.keys(adminPlaceInputSchema.shape)
        .filter(
          (field) =>
            JSON.stringify(baseline[field as keyof typeof baseline]) !==
            JSON.stringify(snapshot[field as keyof typeof snapshot]),
        )
        .map((field) => ({
          field,
          current: baseline[field as keyof typeof baseline] ?? null,
          historical: snapshot[field as keyof typeof snapshot] ?? null,
        }));
      return {
        revision: version.revision,
        recordedAt: version.recordedAt,
        state: version.state,
        reason: version.reason,
        basePublicRevision: version.basePublicRevision,
        snapshot,
        current: baseline,
        changes,
      };
    },
    async restore(
      actor: Types.ObjectId,
      id: string,
      revision: number,
      expectedRevision: number,
      key: string,
    ) {
      await catalog.read(actor, id);
      const old = await Version.findOne({ placeId: id, revision });
      if (!old)
        throw new HttpError(
          404,
          'VERSION_NOT_FOUND',
          'Không có bản lưu để khôi phục.',
        );
      const p = old.snapshot;
      const input = adminPlaceInputSchema.parse({
        destinationId: String(p.destinationId),
        name: p.name,
        category: p.category,
        venueType:
          p.venueType ?? (p.category === 'food' ? 'food_idea' : 'place'),
        description: p.description,
        locationQuery: p.planning?.locationQuery ?? p.name,
        durationMinutes: p.planning?.durationMinutes ?? 60,
        openingHoursNote: p.openingHoursNote ?? '',
        sourceUrl: p.sourceUrl,
        referencePrice: p.referencePrice ?? null,
        mapLocation: p.mapLocation ?? null,
        internalNote: p.internalNote ?? '',
        images: p.images ?? [],
        publicationStatus: 'draft',
      });
      return catalog.write(actor, input, key, id, expectedRevision, revision);
    },
  };
}
