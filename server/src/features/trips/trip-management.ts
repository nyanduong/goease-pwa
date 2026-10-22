import mongoose, { type Connection, type Types } from 'mongoose';
import { randomUUID } from 'node:crypto';
import { tripInputSchema, shiftTripDays } from '@goease/contracts';
import type { tripService } from './trip.service.js';
import { summaryTotals } from './trip.models.js';
import type { businessAudit } from '../audit/business-audit.js';
import { tokenHash } from '../auth/security.js';
import { requestId } from '../auth/auth.service.js';
import { HttpError } from '../../http-error.js';

export function tripManagement(
  connection: Connection,
  trips: ReturnType<typeof tripService>,
  audit: ReturnType<typeof businessAudit>,
) {
  const { Trip, Revision, Key } = trips.models;
  return async (
    ownerId: Types.ObjectId,
    id: string,
    action: 'delete' | 'duplicate',
    expectedRevision: number,
    key: string,
    startDate?: string,
  ) => {
    const missing = () =>
      new HttpError(404, 'TRIP_NOT_FOUND', 'Không tìm thấy chuyến đi của bạn.');
    if (!/^[a-f0-9]{24}$/.test(id)) throw missing();
    const operation = `trip.${action}`,
      operationId = randomUUID(),
      reqId = requestId();
    const requestHash = tokenHash(
      JSON.stringify({ id, action, expectedRevision, startDate }),
    );
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await connection.transaction(async (session) => {
          const source = await Trip.findOne({ _id: id, ownerId }).session(
            session,
          );
          if (!source) throw missing();
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
                'Nội dung thao tác đã đổi. Hãy tạo thao tác mới.',
              );
            if (action === 'delete') return { deleted: true };
            if (source.deletedAt) throw missing();
            const copy = await Trip.findOne({
              _id: cached.resourceId,
              ownerId,
              deletedAt: null,
            }).session(session);
            if (!copy) throw missing();
            return { trip: trips.dto(copy) };
          }
          if (source.deletedAt) throw missing();
          if (source.revision !== expectedRevision)
            throw new HttpError(
              409,
              'REVISION_CONFLICT',
              'Chuyến đi đã thay đổi. Tải lại bản mới trước khi tiếp tục.',
            );
          const now = new Date();
          let target = source;
          if (action === 'delete') {
            source.deletedAt = now;
            source.deletedBy = ownerId;
            source.deletionReasonCode = 'owner_requested';
            source.revision++;
            source.updatedBy = ownerId;
            await source.save({ session });
            await connection
              .collection('trip_share_links')
              .updateMany(
                { tripId: source._id, revokedAt: null },
                { $set: { revokedAt: now } },
                { session },
              );
          } else {
            // Lock the source version against deletion/update during the clone transaction.
            await Trip.updateOne(
              { _id: id, ownerId, revision: expectedRevision, deletedAt: null },
              { $inc: { expenseRevision: 1 } },
              { session, timestamps: false },
            );
            const input = trips.toInput(source);
            const endDate = new Date(
              Date.parse(startDate!) + (input.days.length - 1) * 86400000,
            )
              .toISOString()
              .slice(0, 10);
            if (endDate.length !== 10 || endDate < startDate!)
              throw new HttpError(
                400,
                'INVALID_DATES',
                'Ngày bản sao vượt phạm vi hỗ trợ.',
              );
            const shifted = shiftTripDays(
              input,
              startDate!,
              endDate,
              randomUUID,
            );
            const snapshot = tripInputSchema.parse({
              ...shifted,
              title: `${input.title.slice(0, 108)} (bản sao)`,
              generationMode: 'manual',
              aiRunId: undefined,
              days: shifted.days.map((d) => ({
                ...d,
                dayId: randomUUID(),
                activities: d.activities.map((a) => ({
                  ...a,
                  activityId: randomUUID(),
                  source: 'manual',
                })),
              })),
            });
            // Owned snapshots may contain archived catalog links; cloning doesn't hydrate them.
            target = await new Trip({
              ...snapshot,
              destinations: source.destinations.map((d) => ({
                destinationId: d.destinationId,
                order: d.order,
                nameSnapshot: d.nameSnapshot,
                timezone: d.timezone,
              })),
              ownerId,
              clonedFromTripId: source._id,
              firstSavedAt: now,
              createdBy: ownerId,
              updatedBy: ownerId,
              createdByType: 'user',
              updatedByType: 'user',
              summaryTotals: summaryTotals(snapshot),
            }).save({ session });
          }
          await new Revision({
            tripId: target._id,
            ownerIdAtWrite: ownerId,
            revision: target.revision,
            previousRevision: action === 'delete' ? expectedRevision : null,
            action: action === 'delete' ? 'deleted' : 'created',
            snapshot: trips.toInput(target),
            actorId: ownerId,
            requestId: reqId,
            operationId,
          }).save({ session });
          await audit.append(
            {
              action: action === 'delete' ? 'trip.deleted' : 'trip.duplicated',
              actorUserId: String(ownerId),
              entityId: String(target._id),
              entityRevision: target.revision,
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
            resourceId: String(target._id),
            responseStatus: action === 'delete' ? 200 : 201,
            expiresAt: new Date(Date.now() + 86400000),
          }).save({ session });
          return action === 'delete'
            ? { deleted: true }
            : { trip: trips.dto(target) };
        });
      } catch (e) {
        const race =
          e instanceof mongoose.mongo.MongoServerError &&
          e.code === 11000 &&
          JSON.stringify(e.keyPattern) ===
            JSON.stringify({ actorId: 1, operation: 1, key: 1 });
        if (!race || attempt === 2) throw e;
      }
    }
    throw new Error('Trip management retry limit');
  };
}
