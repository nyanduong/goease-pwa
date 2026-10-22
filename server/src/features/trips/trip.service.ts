import mongoose, { Types, type Connection } from 'mongoose';
import { randomUUID } from 'node:crypto';
import {
  tripInputSchema,
  type TripDto,
  type TripInput,
} from '@goease/contracts';
import { tripModels, summaryTotals } from './trip.models.js';
import type { businessAudit } from '../audit/business-audit.js';
import { requestId } from '../auth/auth.service.js';
import { tokenHash } from '../auth/security.js';
import { HttpError } from '../../http-error.js';
import { calculateBudget } from './budget.js';

export function tripService(
  connection: Connection,
  audit: ReturnType<typeof businessAudit>,
) {
  const models = tripModels(connection);
  const { Trip, Revision, Key, Destination } = models;
  type TripDocument = NonNullable<Awaited<ReturnType<typeof Trip.findOne>>>;
  function toInput(document: TripDocument): TripInput {
    const doc = document.toObject();
    return tripInputSchema.parse({
      title: doc.title,
      destinations: doc.destinations.map((d) => ({
        destinationId: String(d.destinationId),
        order: d.order,
      })),
      startDate: doc.startDate,
      endDate: doc.endDate,
      timezone: doc.timezone,
      travelers: { totalCount: doc.travelers?.totalCount },
      budget: doc.budget,
      preferences: doc.preferences,
      generationMode: doc.generationMode,
      ...(doc.aiRunId ? { aiRunId: doc.aiRunId } : {}),
      notes: doc.notes,
      days: doc.days.map((d) => ({
        dayId: d.dayId,
        date: d.date,
        destinationId: String(d.destinationId),
        activities: d.activities.map((a) => ({
          activityId: a.activityId,
          ...(a.placeId ? { placeId: String(a.placeId) } : {}),
          kind: a.kind,
          title: a.title,
          startLocalTime: a.startLocalTime,
          endLocalTime: a.endLocalTime,
          timezone: a.timezone,
          order: a.order,
          notes: a.notes ?? '',
          estimatedCost: a.estimatedCost,
          source: a.source,
        })),
      })),
    });
  }
  function dto(doc: TripDocument): TripDto {
    return {
      ...toInput(doc),
      id: doc._id.toHexString(),
      revision: doc.revision,
      destinationName: doc.destinations[0]?.nameSnapshot ?? '',
      updatedAt: doc.updatedAt.toISOString(),
      summaryTotals: summaryTotals(toInput(doc)),
      budgetSummary: calculateBudget(toInput(doc)),
    };
  }
  async function owned(id: string, ownerId: Types.ObjectId) {
    if (!/^[a-f0-9]{24}$/.test(id))
      throw new HttpError(
        404,
        'TRIP_NOT_FOUND',
        'Không tìm thấy chuyến đi của bạn.',
      );
    const trip = await Trip.findOne({ _id: id, ownerId, deletedAt: null });
    if (!trip)
      throw new HttpError(
        404,
        'TRIP_NOT_FOUND',
        'Không tìm thấy chuyến đi của bạn.',
      );
    return trip;
  }
  return {
    models,
    dto,
    async destinations() {
      return {
        items: (
          await Destination.find({
            publicationStatus: 'published',
            deletedAt: null,
          })
            .sort({ name: 1 })
            .limit(50)
        ).map((d) => ({
          id: d._id.toHexString(),
          name: d.name,
          summary: d.summary ?? '',
          timezone: d.timezone,
        })),
      };
    },
    async list(ownerId: Types.ObjectId) {
      return {
        items: (
          await Trip.find({ ownerId, deletedAt: null })
            .sort({ updatedAt: -1, _id: -1 })
            .limit(50)
        ).map(dto),
      };
    },
    async read(id: string, ownerId: Types.ObjectId) {
      return { trip: dto(await owned(id, ownerId)) };
    },
    async save(
      ownerId: Types.ObjectId,
      value: TripInput,
      expectedRevision: number | undefined,
      key: string,
      id?: string,
    ) {
      if (id) await owned(id, ownerId);
      const operation = id ? 'trip.update' : 'trip.create';
      const operationId = randomUUID();
      const reqId = requestId();
      const requestHash = tokenHash(
        JSON.stringify({
          id: id ?? null,
          trip: value,
          expectedRevision: expectedRevision ?? null,
        }),
      );
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          return await connection.transaction(async (session) => {
            const cached = await Key.findOne({
              actorId: ownerId,
              operation,
              key,
            }).session(session);
            if (cached) {
              if (cached.requestHash !== requestHash)
                throw new HttpError(
                  409,
                  'IDEMPOTENCY_CONFLICT',
                  'Yêu cầu lưu đã đổi nội dung. Hãy thử lưu lại bằng thao tác mới.',
                );
              const existing = await Trip.findOne({
                _id: cached.resourceId,
                ownerId,
                deletedAt: null,
              }).session(session);
              if (!existing)
                throw new HttpError(
                  404,
                  'TRIP_NOT_FOUND',
                  'Không tìm thấy chuyến đi của bạn.',
                );
              return { trip: dto(existing) };
            }
            const destination = await Destination.findOne({
              _id: value.destinations[0]!.destinationId,
              publicationStatus: 'published',
              deletedAt: null,
            }).session(session);
            if (!destination)
              throw new HttpError(
                400,
                'INVALID_DESTINATION',
                'Điểm đến không còn khả dụng. Hãy chọn lại điểm đến.',
              );
            const current = id
              ? await Trip.findOne({
                  _id: id,
                  ownerId,
                  deletedAt: null,
                }).session(session)
              : null;
            if (id && !current)
              throw new HttpError(
                404,
                'TRIP_NOT_FOUND',
                'Không tìm thấy chuyến đi của bạn.',
              );
            if (current && current.revision !== expectedRevision)
              throw new HttpError(
                409,
                'REVISION_CONFLICT',
                'Chuyến đi đã có bản mới hơn. Bản đang nhập vẫn được giữ; hãy mở bản server ở tab khác trước khi cập nhật.',
              );
            const now = new Date();
            // AI provenance is resolved on the server; the browser cannot invent it.
            if (value.generationMode === 'ai') {
              const run = await connection.collection('ai_runs').findOne(
                {
                  runId: value.aiRunId ?? '',
                  userId: ownerId,
                  status: 'succeeded',
                },
                { session },
              );
              if (
                !run ||
                (current?.aiRunId !== value.aiRunId &&
                  ((run.tripId ?? undefined) !== id ||
                    (id && run.expectedRevision !== expectedRevision)))
              )
                throw new HttpError(
                  409,
                  'AI_PROPOSAL_STALE',
                  'Đề xuất AI không còn phù hợp với bản chuyến đi này. Hãy tạo đề xuất mới.',
                );
              const original = tripInputSchema.parse(run.proposal.trip);
              const links = new Set(
                original.days.flatMap((d) =>
                  d.activities.map((a) => `${a.activityId}:${a.placeId}`),
                ),
              );
              if (
                value.days.some((d) =>
                  d.activities.some(
                    (a) =>
                      a.source === 'ai' &&
                      !links.has(`${a.activityId}:${a.placeId}`),
                  ),
                )
              )
                throw new HttpError(
                  400,
                  'INVALID_AI_SOURCE',
                  'Nguồn hoạt động AI không hợp lệ.',
                );
            } else if (
              value.aiRunId ||
              value.days.some((d) =>
                d.activities.some((a) => a.source === 'ai'),
              )
            ) {
              throw new HttpError(
                400,
                'INVALID_AI_SOURCE',
                'Chuyến đi thủ công không thể tự gắn nguồn AI.',
              );
            }
            // Existing links remain readable if a catalog entry is archived. New links
            // must point to published places in the day's destination.
            const incoming = value.days.flatMap((d) =>
              d.activities
                .filter((a) => a.placeId)
                .map((a) => ({ ...a, destinationId: d.destinationId })),
            );
            const oldLinks = new Set(
              current?.days.flatMap((d) =>
                d.activities.map(
                  (a) => `${a.activityId}:${a.placeId}:${d.destinationId}`,
                ),
              ) ?? [],
            );
            const newLinks = incoming.filter(
              (a) =>
                !oldLinks.has(
                  `${a.activityId}:${a.placeId}:${a.destinationId}`,
                ),
            );
            if (newLinks.length) {
              const places = await connection
                .collection('places')
                .find(
                  {
                    _id: {
                      $in: newLinks.map((a) => new Types.ObjectId(a.placeId)),
                    },
                    publicationStatus: 'published',
                    deletedAt: null,
                  },
                  { session },
                )
                .toArray();
              if (
                newLinks.some(
                  (a) =>
                    !places.some(
                      (p) =>
                        String(p._id) === a.placeId &&
                        String(p.destinationId) === a.destinationId,
                    ),
                )
              )
                throw new HttpError(
                  400,
                  'INVALID_PLACE',
                  'Địa điểm không còn khả dụng hoặc không thuộc điểm đến của ngày. Hãy chọn lại.',
                );
            }
            const oldActivities =
              current?.days.flatMap((d) => d.activities) ?? [];
            const enriched = {
              ...value,
              destinations: [
                {
                  ...value.destinations[0]!,
                  nameSnapshot: destination.name,
                  timezone: destination.timezone,
                },
              ],
              days: value.days.map((d) => ({
                ...d,
                activities: d.activities.map((a) => ({
                  ...a,
                  addedAt:
                    oldActivities.find((old) => old.activityId === a.activityId)
                      ?.addedAt ?? now,
                  updatedAt: now,
                })),
              })),
            };
            const saved = current
              ? await Trip.findOneAndUpdate(
                  {
                    _id: current._id,
                    ownerId,
                    deletedAt: null,
                    revision: current.revision,
                  },
                  {
                    $set: {
                      ...enriched,
                      summaryTotals: summaryTotals(value),
                      updatedBy: ownerId,
                      updatedByType: 'user',
                    },
                    $inc: { revision: 1 },
                  },
                  { session, returnDocument: 'after', runValidators: true },
                )
              : await new Trip({
                  ...enriched,
                  ownerId,
                  createdBy: ownerId,
                  updatedBy: ownerId,
                  createdByType: 'user',
                  updatedByType: 'user',
                  firstSavedAt: now,
                  summaryTotals: summaryTotals(value),
                }).save({ session });
            if (!saved)
              throw new HttpError(
                409,
                'REVISION_CONFLICT',
                'Có thay đổi đồng thời. Bản nháp vẫn được giữ; hãy thử lại.',
              );
            await new Revision({
              tripId: saved._id,
              ownerIdAtWrite: ownerId,
              revision: saved.revision,
              previousRevision: current?.revision ?? null,
              action: current ? 'saved' : 'created',
              snapshot: enriched,
              actorId: ownerId,
              requestId: reqId,
              operationId,
            }).save({ session });
            await audit.append(
              {
                action: current ? 'trip.updated' : 'trip.created',
                actorUserId: ownerId.toHexString(),
                entityId: saved._id.toHexString(),
                entityRevision: saved.revision,
                requestId: reqId,
                operationId,
              },
              session,
            );
            await new Key({
              actorId: ownerId,
              operation,
              key,
              requestHash,
              status: 'completed',
              resourceId: saved._id.toHexString(),
              responseStatus: current ? 200 : 201,
              expiresAt: new Date(Date.now() + 86400000),
            }).save({ session });
            return { trip: dto(saved) };
          });
        } catch (error) {
          const keyRace =
            error instanceof mongoose.mongo.MongoServerError &&
            error.code === 11000 &&
            JSON.stringify(error.keyPattern) ===
              JSON.stringify({ actorId: 1, operation: 1, key: 1 });
          if (!keyRace || attempt === 2) throw error;
        }
      }
      throw new Error('Trip retry limit');
    },
  };
}
