import mongoose, {
  type Connection,
  type Types,
  type ClientSession,
} from 'mongoose';
import { randomUUID } from 'node:crypto';
import {
  adminPlaceInputSchema,
  referencePriceSchema,
  catalogToday,
  type AdminPlaceDto,
  type AdminPlaceInput,
  type adminPlaceQuerySchema,
} from '@goease/contracts';
import type { z } from 'zod';
import type { authModels } from '../auth/auth.models.js';
import { requestId } from '../auth/auth.service.js';
import { tokenHash } from '../auth/security.js';
import type { businessAudit } from '../audit/business-audit.js';
import type { tripService } from '../trips/trip.service.js';
import type { exploreService } from './explore.service.js';
import { normalizeSearch } from './explore.service.js';
import { HttpError } from '../../http-error.js';

export function adminCatalog(
  connection: Connection,
  explore: ReturnType<typeof exploreService>,
  trips: ReturnType<typeof tripService>,
  audit: ReturnType<typeof businessAudit>,
  User: ReturnType<typeof authModels>['User'],
) {
  const { Place } = explore.models;
  const { Destination, Key } = trips.models;
  type Doc = NonNullable<Awaited<ReturnType<typeof Place.findOne>>>;
  const dto = (doc: Doc): AdminPlaceDto => ({
    ...(doc.source
      ? {
          source: {
            provider: 'geoapify' as const,
            externalId: doc.source.externalId,
            fetchedAt: doc.source.fetchedAt.toISOString(),
            attribution: doc.source.attribution,
            license: doc.source.license,
          },
        }
      : {}),
    id: String(doc._id),
    revision: doc.revision,
    updatedAt: doc.updatedAt.toISOString(),
    destinationId: String(doc.destinationId),
    name: doc.name,
    category: doc.category as AdminPlaceInput['category'],
    venueType:
      (doc.venueType as AdminPlaceInput['venueType']) ??
      (doc.category === 'food' ? 'food_idea' : 'place'),
    description: doc.description,
    locationQuery: doc.planning?.locationQuery ?? doc.name,
    durationMinutes: doc.planning?.durationMinutes ?? 60,
    openingHoursNote: doc.openingHoursNote ?? '',
    sourceUrl: doc.sourceUrl,
    publicationStatus:
      doc.publicationStatus as AdminPlaceInput['publicationStatus'],
    referencePrice: doc.referencePrice
      ? referencePriceSchema.parse(doc.toObject().referencePrice)
      : null,
  });
  async function requireAdmin(actor: Types.ObjectId, session?: ClientSession) {
    if (
      !(await User.exists({
        _id: actor,
        roles: 'admin',
        status: 'active',
        deletedAt: null,
      }).session(session ?? null))
    )
      throw new HttpError(
        403,
        'ADMIN_REQUIRED',
        'Tài khoản này không có quyền quản lý danh mục.',
      );
  }
  const checkId = (id: string) => {
    if (!/^[a-f0-9]{24}$/.test(id))
      throw new HttpError(404, 'PLACE_NOT_FOUND', 'Không tìm thấy địa điểm.');
  };
  return {
    dto,
    requireAdmin,
    async list(
      actor: Types.ObjectId,
      query: z.infer<typeof adminPlaceQuerySchema>,
    ) {
      await requireAdmin(actor);
      const q = normalizeSearch(query.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const docs = await Place.find({
        deletedAt: null,
        ...(query.status === 'all' ? {} : { publicationStatus: query.status }),
        ...(q ? { searchText: { $regex: q } } : {}),
      })
        .sort({ updatedAt: -1, _id: -1 })
        .skip(query.offset)
        .limit(21);
      return { items: docs.slice(0, 20).map(dto), hasMore: docs.length > 20 };
    },
    async read(actor: Types.ObjectId, id: string) {
      await requireAdmin(actor);
      checkId(id);
      const doc = await Place.findOne({ _id: id, deletedAt: null });
      if (!doc)
        throw new HttpError(404, 'PLACE_NOT_FOUND', 'Không tìm thấy địa điểm.');
      const history = await connection
        .collection('audit_logs')
        .find(
          { entityType: 'place', entityId: id },
          {
            projection: { _id: 0, action: 1, entityRevision: 1, occurredAt: 1 },
          },
        )
        .sort({ occurredAt: -1 })
        .limit(20)
        .toArray();
      return { place: dto(doc), history };
    },
    async write(
      actor: Types.ObjectId,
      input: AdminPlaceInput,
      key: string,
      id?: string,
      expectedRevision?: number,
    ) {
      await requireAdmin(actor);
      if (id) checkId(id);
      const parsed = adminPlaceInputSchema.safeParse(input);
      if (!parsed.success)
        throw new HttpError(
          400,
          'INVALID_INPUT',
          parsed.error.issues[0]?.message ?? 'Thông tin chưa hợp lệ.',
        );
      if (
        input.referencePrice &&
        (input.referencePrice.checkedAt > catalogToday() ||
          (input.publicationStatus === 'published' &&
            input.referencePrice.reviewAfter < catalogToday()))
      )
        throw new HttpError(
          400,
          'INVALID_PRICE_DATE',
          'Ngày đối chiếu không được ở tương lai; giá xuất bản phải còn trong thời gian kiểm tra.',
        );
      if (Boolean(id) !== (expectedRevision !== undefined))
        throw new HttpError(
          400,
          'INVALID_INPUT',
          'Thiếu phiên bản địa điểm đang sửa.',
        );
      const operation = id ? 'catalog.update' : 'catalog.create';
      const requestHash = tokenHash(
        JSON.stringify({ id, input, expectedRevision }),
      );
      const operationId = randomUUID(),
        reqId = requestId();
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          return await connection.transaction(async (session) => {
            await requireAdmin(actor, session);
            const receipt = await Key.findOne({
              actorId: actor,
              operation,
              key,
            }).session(session);
            if (receipt) {
              if (receipt.requestHash !== requestHash)
                throw new HttpError(
                  409,
                  'IDEMPOTENCY_CONFLICT',
                  'Nội dung lần lưu này đã thay đổi. Hãy lưu bằng thao tác mới.',
                );
              const saved = await Place.findById(receipt.resourceId).session(
                session,
              );
              if (!saved)
                throw new HttpError(
                  404,
                  'PLACE_NOT_FOUND',
                  'Không tìm thấy địa điểm.',
                );
              return { place: dto(saved) };
            }
            const destination = await Destination.findOne({
              _id: input.destinationId,
              publicationStatus: 'published',
              deletedAt: null,
            }).session(session);
            if (!destination)
              throw new HttpError(
                400,
                'INVALID_DESTINATION',
                'Chọn điểm đến đang được hiển thị.',
              );
            const current = id
              ? await Place.findOne({ _id: id, deletedAt: null }).session(
                  session,
                )
              : null;
            if (id && !current)
              throw new HttpError(
                404,
                'PLACE_NOT_FOUND',
                'Không tìm thấy địa điểm.',
              );
            if (current && current.revision !== expectedRevision)
              throw new HttpError(
                409,
                'CATALOG_CONFLICT',
                'Địa điểm đã được sửa ở nơi khác. Nội dung đang nhập vẫn giữ; mở bản mới để đối chiếu trước khi lưu.',
              );
            if (
              current &&
              input.publicationStatus === 'published' &&
              current.publicationStatus !== 'published' &&
              (await connection.collection('catalog_reviews').findOne(
                {
                  placeId: current._id,
                  kind: { $in: ['source', 'duplicate'] },
                  state: { $ne: 'resolved' },
                },
                { session },
              ))
            )
              throw new HttpError(
                409,
                'CATALOG_REVIEW_REQUIRED',
                'Mở Việc cần làm để quyết định thông tin nguồn hoặc nghi trùng trước khi đăng.',
              );
            if (
              current?.sourceSnapshot?.closed &&
              input.publicationStatus === 'published' &&
              current.publicationStatus !== 'published' &&
              !(await connection.collection('catalog_reviews').findOne(
                {
                  placeId: current._id,
                  kind: 'source',
                  state: 'resolved',
                  decision: 'keep',
                },
                { session },
              ))
            )
              throw new HttpError(
                409,
                'CATALOG_REVIEW_REQUIRED',
                'Nguồn có dấu hiệu đóng cửa. Mở Việc cần làm để đối chiếu trước khi đăng.',
              );
            if (
              current &&
              String(current.destinationId) !== input.destinationId
            )
              throw new HttpError(
                400,
                'PLACE_DESTINATION_FIXED',
                'Địa điểm đã tạo giữ nguyên điểm đến để bảo vệ các lịch đang dùng. Hãy tạo mục mới cho điểm đến khác.',
              );
            const fields = {
              destinationId: destination._id,
              destinationName: destination.name,
              name: input.name,
              category: input.category,
              venueType: input.venueType,
              description: input.description,
              subtitle: input.description.slice(0, 150),
              searchText: normalizeSearch(
                `${input.name} ${input.description} ${input.locationQuery}`,
              ).slice(0, 2500),
              sourceUrl: input.sourceUrl,
              openingHoursNote: input.openingHoursNote,
              ...(current &&
              current.planning?.locationQuery !== input.locationQuery
                ? { mapLocation: null }
                : {}),
              referencePrice: input.referencePrice,
              publicationStatus: input.publicationStatus,
              durationLabel: `${input.durationMinutes} phút`,
              tip: 'Thời lượng là ước tính GoEase. Kiểm tra giờ mở cửa và giá với cơ sở trước khi đi.',
              planning: {
                durationMinutes: input.durationMinutes,
                locationQuery: input.locationQuery,
                costNote: input.referencePrice
                  ? input.referencePrice.conditions
                  : 'Chưa có giá tham khảo để tự tính.',
                priceOptions: current?.toObject().planning?.priceOptions ?? [],
              },
              updatedBy: actor,
              updatedByType: 'user',
            };
            const saved = current
              ? await Place.findOneAndUpdate(
                  { _id: current._id, revision: current.revision },
                  { $set: fields, $inc: { revision: 1 } },
                  { session, returnDocument: 'after', runValidators: true },
                )
              : await new Place({
                  ...fields,
                  revision: 1,
                  createdBy: actor,
                  createdByType: 'user',
                  imageUrl: '/images/explore-hoian.png',
                  imageCredit: 'Ảnh minh họa AI, không phải ảnh cơ sở',
                  travelLabel: 'Kiểm tra đường đi',
                  bestTimeLabel: 'Kiểm tra giờ mở cửa',
                  tip: 'Thông tin tham khảo; liên hệ cơ sở để xác nhận.',
                  highlights: [],
                }).save({ session });
            if (!saved)
              throw new HttpError(
                409,
                'CATALOG_CONFLICT',
                'Có thay đổi đồng thời. Hãy tải lại để đối chiếu.',
              );
            await audit.append(
              {
                action: !current
                  ? 'catalog.created'
                  : current.publicationStatus !== input.publicationStatus
                    ? 'catalog.publication_changed'
                    : 'catalog.updated',
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
              requestHash,
              status: 'completed',
              resourceType: 'place',
              resourceId: String(saved._id),
              responseStatus: id ? 200 : 201,
              expiresAt: new Date(Date.now() + 86400000),
            }).save({ session });
            return { place: dto(saved) };
          });
        } catch (e) {
          if (
            attempt < 2 &&
            e instanceof mongoose.mongo.MongoServerError &&
            e.code === 11000 &&
            JSON.stringify(e.keyPattern) ===
              JSON.stringify({ actorId: 1, operation: 1, key: 1 })
          )
            continue;
          throw e;
        }
      }
      throw new HttpError(409, 'CATALOG_CONFLICT', 'Hãy thử lưu lại.');
    },
  };
}
