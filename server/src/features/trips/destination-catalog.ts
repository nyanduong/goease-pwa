import { randomUUID } from 'node:crypto';
import { Types, type Connection } from 'mongoose';
import {
  destinationQuerySchema,
  tourismRegions,
  tourismRegionSchema,
  travelRegionOf,
  type DestinationInput,
  type DestinationToggleInput,
} from '@goease/contracts';
import type { tripModels } from './trip.models.js';
import type { adminCatalog } from '../explore/admin-catalog.js';
import type { businessAudit } from '../audit/business-audit.js';
import { HttpError } from '../../http-error.js';
import { tokenHash } from '../auth/security.js';
import { foldDestination, provinces } from './province-data.js';
import { requestId } from '../auth/auth.service.js';

type Models = ReturnType<typeof tripModels>;
type Destination = Pick<
  NonNullable<Awaited<ReturnType<Models['Destination']['findOne']>>>,
  | '_id'
  | 'name'
  | 'slug'
  | 'summary'
  | 'timezone'
  | 'tourismRegion'
  | 'publicationStatus'
  | 'revision'
  | 'provinceCode'
  | 'catalogVersion'
  | 'catalogSourceUrl'
  | 'catalogEffectiveFrom'
  | 'tourismAreas'
>;
export const destinationDto = (d: Destination) => ({
  id: String(d._id),
  provinceCode: d.provinceCode ?? null,
  catalogVersion: d.catalogVersion ?? null,
  catalogSourceUrl: d.catalogSourceUrl ?? null,
  catalogEffectiveFrom: d.catalogEffectiveFrom ?? null,
  tourismAreas: d.tourismAreas ?? [],
  name: d.name,
  slug: d.slug,
  summary: d.summary ?? '',
  countryCode: 'VN' as const,
  timezone: d.timezone,
  tourismRegion: tourismRegionSchema.safeParse(d.tourismRegion).data ?? null,
  region: travelRegionOf(d.tourismRegion),
  publicationStatus:
    d.publicationStatus as DestinationInput['publicationStatus'],
  revision: d.revision,
});
export async function listDestinations(
  Destination: Models['Destination'],
  query: unknown = {},
  admin = false,
) {
  const parsed = destinationQuerySchema.safeParse(query);
  if (!parsed.success)
    throw new HttpError(
      400,
      'INVALID_INPUT',
      'Bộ lọc miền/vùng hoặc phân trang chưa hợp lệ.',
    );
  const q = parsed.data;
  const codes = q.tourismRegion
    ? [q.tourismRegion]
    : tourismRegions.filter((r) => r.region === q.region).map((r) => r.code);
  const matchingCodes = provinces
    .filter((p) =>
      foldDestination([p.name, ...p.areas, p.code].join(' ')).includes(
        foldDestination(q.q),
      ),
    )
    .map((p) => p.code);
  const filter = {
    catalogKind: { $ne: 'legacy' as const },
    deletedAt: null,
    $or: [{ countryCode: 'VN' as const }, { countryCode: { $exists: false } }],
    ...(!admin ? { publicationStatus: 'published' as const } : {}),
    ...(q.region || q.tourismRegion ? { tourismRegion: { $in: codes } } : {}),
    ...(q.q
      ? {
          $and: [
            {
              $or: [
                { provinceCode: { $in: matchingCodes } },
                {
                  name: {
                    $regex: q.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
                    $options: 'i',
                  },
                },
              ],
            },
          ],
        }
      : {}),
  };
  const docs = await Destination.find(filter)
    .sort({ name: 1, _id: 1 })
    .skip(q.offset)
    .limit(q.limit + 1);
  return {
    items: docs.slice(0, q.limit).map(destinationDto),
    hasMore: docs.length > q.limit,
  };
}
export function destinationCatalog(
  connection: Connection,
  models: Models,
  catalog: ReturnType<typeof adminCatalog>,
  audit: ReturnType<typeof businessAudit>,
) {
  const { Destination, Key } = models;
  return {
    async list(actor: Types.ObjectId, query: unknown) {
      await catalog.requireAdmin(actor);
      return listDestinations(Destination, query, true);
    },
    async toggle(
      actor: Types.ObjectId,
      id: string,
      input: DestinationToggleInput,
      key: string,
    ) {
      await catalog.requireAdmin(actor);
      if (!/^[a-f0-9]{24}$/.test(id))
        throw new HttpError(
          404,
          'DESTINATION_NOT_FOUND',
          'Không tìm thấy tỉnh/thành.',
        );
      const operation = 'destination.toggle';
      const hash = tokenHash(JSON.stringify({ id, input }));
      const operationId = randomUUID(),
        reqId = requestId();
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          return await connection.transaction(async (session) => {
            await catalog.requireAdmin(actor, session);
            const receipt = await Key.findOne({
              actorId: actor,
              operation,
              key,
            }).session(session);
            if (receipt && receipt.requestHash !== hash)
              throw new HttpError(
                409,
                'IDEMPOTENCY_CONFLICT',
                'Nội dung thao tác đã đổi. Tải lại trước khi thử lại.',
              );
            const current = await Destination.findOne({
              _id: id,
              deletedAt: null,
              catalogKind: 'province',
            }).session(session);
            if (
              !current ||
              !provinces.some((p) => p.code === current.provinceCode)
            )
              throw new HttpError(
                404,
                'DESTINATION_NOT_FOUND',
                'Không tìm thấy tỉnh/thành trong danh mục.',
              );
            if (receipt) return { destination: destinationDto(current) };
            if (
              await connection.collection('catalog_bulk_jobs').findOne(
                {
                  destinationId: current._id,
                  action: 'archive_destination',
                  state: 'running',
                },
                { session, projection: { _id: 1 } },
              )
            )
              throw new HttpError(
                409,
                'REGION_ARCHIVING',
                'Tỉnh/thành đang có lô lưu trữ. Hoàn tất lô trước khi bật/tắt.',
              );
            if (current.revision !== input.expectedRevision)
              throw new HttpError(
                409,
                'REVISION_CONFLICT',
                'Tỉnh/thành đã thay đổi. Tải lại danh sách trước khi bật/tắt.',
              );
            current.publicationStatus = input.enabled ? 'published' : 'draft';
            current.revision += 1;
            current.catalogWriteFence += 1;
            current.updatedBy = actor;
            current.updatedByType = 'user';
            await current.save({ session });
            await audit.append(
              {
                action: 'catalog.destination_updated',
                actorUserId: String(actor),
                entityId: id,
                entityRevision: current.revision,
                previousRevision: input.expectedRevision,
                requestId: reqId,
                operationId,
              },
              session,
            );
            await new Key({
              actorId: actor,
              operation,
              key,
              requestHash: hash,
              status: 'completed',
              resourceType: 'destination',
              resourceId: id,
              responseStatus: 200,
              expiresAt: new Date(Date.now() + 86400000),
            }).save({ session });
            return { destination: destinationDto(current) };
          });
        } catch (e) {
          if (
            e instanceof Error &&
            'code' in e &&
            e.code === 11000 &&
            attempt < 2 &&
            (await Key.exists({ actorId: actor, operation, key }))
          )
            continue;
          throw e;
        }
      }
      throw new Error('Destination toggle unavailable');
    },
  };
}
