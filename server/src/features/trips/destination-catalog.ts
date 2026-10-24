import { randomUUID } from 'node:crypto';
import { Types, type Connection } from 'mongoose';
import {
  destinationQuerySchema,
  tourismRegions,
  tourismRegionSchema,
  travelRegionOf,
  type DestinationInput,
} from '@goease/contracts';
import type { tripModels } from './trip.models.js';
import type { adminCatalog } from '../explore/admin-catalog.js';
import type { businessAudit } from '../audit/business-audit.js';
import { HttpError } from '../../http-error.js';
import { tokenHash } from '../auth/security.js';
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
>;
export const destinationDto = (d: Destination) => ({
  id: String(d._id),
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
  const filter = {
    deletedAt: null,
    $or: [{ countryCode: 'VN' as const }, { countryCode: { $exists: false } }],
    ...(!admin ? { publicationStatus: 'published' as const } : {}),
    ...(q.region || q.tourismRegion ? { tourismRegion: { $in: codes } } : {}),
    ...(q.q
      ? {
          name: {
            $regex: q.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
            $options: 'i',
          },
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
    async write(
      actor: Types.ObjectId,
      input: DestinationInput,
      key: string,
      id?: string,
      revision?: number,
    ) {
      await catalog.requireAdmin(actor);
      if (id && !/^[a-f0-9]{24}$/.test(id))
        throw new HttpError(
          404,
          'DESTINATION_NOT_FOUND',
          'Không tìm thấy điểm đến.',
        );
      const operation = 'destination.write',
        hash = tokenHash(JSON.stringify({ id, input, revision }));
      const operationId = randomUUID(),
        reqId = requestId(),
        newId = new Types.ObjectId();
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          return await connection.transaction(async (session) => {
            await catalog.requireAdmin(actor, session);
            const receipt = await Key.findOne({
              actorId: actor,
              operation,
              key,
            }).session(session);
            if (receipt) {
              if (receipt.requestHash !== hash)
                throw new HttpError(
                  409,
                  'IDEMPOTENCY_CONFLICT',
                  'Nội dung thao tác đã đổi. Hãy lưu bằng thao tác mới.',
                );
              const saved = await Destination.findOne({
                _id: receipt.resourceId,
                deletedAt: null,
              }).session(session);
              if (!saved)
                throw new HttpError(
                  404,
                  'DESTINATION_NOT_FOUND',
                  'Không tìm thấy điểm đến.',
                );
              return { destination: destinationDto(saved) };
            }
            let saved: Destination | null;
            if (id) {
              if (
                input.publicationStatus !== 'published' &&
                (await connection.collection('places').findOne(
                  {
                    destinationId: new Types.ObjectId(id),
                    publicationStatus: 'published',
                    deletedAt: null,
                  },
                  { session, projection: { _id: 1 } },
                ))
              ) {
                throw new HttpError(
                  409,
                  'DESTINATION_HAS_PUBLISHED_PLACES',
                  'Điểm đến đang có địa điểm công khai. Hãy ngừng hiển thị các địa điểm đó trước khi ẩn điểm đến.',
                );
              }
              if (revision === undefined)
                throw new HttpError(
                  400,
                  'INVALID_INPUT',
                  'Cần phiên bản hiện tại của điểm đến.',
                );
              saved = await Destination.findOneAndUpdate(
                { _id: id, deletedAt: null, revision },
                {
                  $set: { ...input, updatedBy: actor, updatedByType: 'user' },
                  $inc: { revision: 1 },
                },
                { session, returnDocument: 'after', runValidators: true },
              );
              if (!saved)
                throw new HttpError(
                  409,
                  'REVISION_CONFLICT',
                  'Điểm đến đã thay đổi. Tải lại danh sách trước khi lưu; nội dung bạn nhập vẫn được giữ.',
                );
            } else {
              if (revision !== undefined)
                throw new HttpError(
                  400,
                  'INVALID_INPUT',
                  'Điểm đến mới không nhận phiên bản cũ.',
                );
              saved = await new Destination({
                _id: newId,
                ...input,
                revision: 1,
                createdBy: actor,
                updatedBy: actor,
                createdByType: 'user',
                updatedByType: 'user',
                source: {
                  provider: 'goease_curated',
                  fetchedAt: new Date(),
                  rights: {
                    policyRef: 'goease-authored-catalog-v1',
                    cacheAllowed: true,
                    persistentSnapshotAllowed: true,
                    attributionRequired: false,
                  },
                },
              }).save({ session });
            }
            await audit.append(
              {
                action: id
                  ? 'catalog.destination_updated'
                  : 'catalog.destination_created',
                actorUserId: String(actor),
                entityId: String(saved._id),
                entityRevision: saved.revision,
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
              resourceId: String(saved._id),
              responseStatus: id ? 200 : 201,
              expiresAt: new Date(Date.now() + 86400000),
            }).save({ session });
            return { destination: destinationDto(saved) };
          });
        } catch (e) {
          if (e instanceof Error && 'code' in e && e.code === 11000) {
            if (
              attempt < 2 &&
              (await Key.exists({ actorId: actor, operation, key }))
            )
              continue;
            throw new HttpError(
              409,
              'DESTINATION_SLUG_CONFLICT',
              'Đường dẫn điểm đến đã được dùng. Chọn đường dẫn khác.',
            );
          }
          throw e;
        }
      }
      throw new Error('Destination write unavailable');
    },
  };
}
