import { Schema, type Connection, type Types } from 'mongoose';
import { randomUUID } from 'node:crypto';
import type { ShareLinkDto, SharedTripDto } from '@goease/contracts';
import type { tripService } from './trip.service.js';
import type { businessAudit } from '../audit/business-audit.js';
import { tokenHash } from '../auth/security.js';
import { requestId } from '../auth/auth.service.js';
import { HttpError } from '../../http-error.js';

export function tripSharing(
  connection: Connection,
  trips: ReturnType<typeof tripService>,
  audit: ReturnType<typeof businessAudit>,
) {
  const schema = new Schema(
    {
      schemaVersion: { type: Number, enum: [1], default: 1 },
      permission: { type: String, enum: ['read_only'], default: 'read_only' },
      viewPolicyVersion: {
        type: String,
        enum: ['itinerary-v1'],
        default: 'itinerary-v1',
      },
      tripId: { type: Schema.Types.ObjectId, required: true },
      ownerId: { type: Schema.Types.ObjectId, required: true },
      tokenHash: { type: String, required: true },
      expiresInDays: { type: Number, enum: [1, 7, 30], required: true },
      createdAt: { type: Date, required: true },
      expiresAt: { type: Date, required: true },
      revokedAt: { type: Date, default: null },
    },
    {
      collection: 'trip_share_links',
      strict: 'throw',
      versionKey: false,
      autoCreate: false,
      autoIndex: false,
    },
  );
  schema.index({ tokenHash: 1 }, { unique: true });
  schema.index({ tripId: 1, ownerId: 1, createdAt: -1 });
  const Share = connection.model('TripShareLink', schema);
  const missing = () =>
    new HttpError(
      404,
      'SHARE_UNAVAILABLE',
      'Link không tồn tại, đã hết hạn hoặc đã được thu hồi.',
    );
  const validId = (id: string) => /^[a-f0-9]{24}$/.test(id);
  const dto = (v: InstanceType<typeof Share>): ShareLinkDto => ({
    id: String(v._id),
    createdAt: v.createdAt.toISOString(),
    expiresAt: v.expiresAt.toISOString(),
    revokedAt: v.revokedAt?.toISOString() ?? null,
  });
  async function owned(ownerId: Types.ObjectId, id: string) {
    if (!validId(id)) throw missing();
    const trip = await trips.models.Trip.findOne({
      _id: id,
      ownerId,
      deletedAt: null,
    });
    if (!trip) throw missing();
    return trip;
  }
  return {
    models: { Share },
    async list(ownerId: Types.ObjectId, id: string) {
      await owned(ownerId, id);
      return {
        items: (
          await Share.find({
            tripId: id,
            ownerId,
            revokedAt: null,
            expiresAt: { $gt: new Date() },
          }).sort({ createdAt: -1 })
        ).map(dto),
      };
    },
    async create(
      ownerId: Types.ObjectId,
      id: string,
      value: { token: string; expiresInDays: number },
    ) {
      if (!validId(id)) throw missing();
      const operationId = randomUUID(),
        reqId = requestId();
      return connection.transaction(async (session) => {
        // Serialize issuance with other shares and trip deletion without changing itinerary revision.
        const trip = await trips.models.Trip.findOneAndUpdate(
          { _id: id, ownerId, deletedAt: null },
          { $inc: { expenseRevision: 1 } },
          { session, timestamps: false },
        );
        if (!trip) throw missing();
        const hash = tokenHash(value.token);
        const existing = await Share.findOne({ tokenHash: hash }).session(
          session,
        );
        if (existing) {
          if (
            String(existing.ownerId) !== String(ownerId) ||
            String(existing.tripId) !== id ||
            existing.expiresInDays !== value.expiresInDays
          )
            throw new HttpError(
              409,
              'SHARE_CONFLICT',
              'Link đã được dùng cho thao tác khác.',
            );
          if (existing.revokedAt || existing.expiresAt.getTime() <= Date.now())
            throw missing();
          return { share: dto(existing) };
        }
        if (
          (await Share.countDocuments({
            tripId: id,
            revokedAt: null,
            expiresAt: { $gt: new Date() },
          }).session(session)) >= 10
        )
          throw new HttpError(
            409,
            'SHARE_LIMIT',
            'Tối đa 10 link đang hoạt động. Thu hồi link cũ trước khi tạo thêm.',
          );
        const now = new Date();
        const share = await new Share({
          tripId: id,
          ownerId,
          tokenHash: hash,
          expiresInDays: value.expiresInDays,
          createdAt: now,
          expiresAt: new Date(now.getTime() + value.expiresInDays * 86400000),
        }).save({ session });
        await audit.append(
          {
            action: 'trip.share_created',
            actorUserId: String(ownerId),
            entityId: id,
            requestId: reqId,
            operationId,
          },
          session,
        );
        return { share: dto(share) };
      });
    },
    async revoke(ownerId: Types.ObjectId, id: string, shareId: string) {
      if (!validId(id) || !validId(shareId)) throw missing();
      const operationId = randomUUID(),
        reqId = requestId();
      return connection.transaction(async (session) => {
        const trip = await trips.models.Trip.findOneAndUpdate(
          { _id: id, ownerId, deletedAt: null },
          { $inc: { expenseRevision: 1 } },
          { session, timestamps: false },
        );
        if (!trip) throw missing();
        const share = await Share.findOne({
          _id: shareId,
          tripId: id,
          ownerId,
        }).session(session);
        if (!share) throw missing();
        if (!share.revokedAt) {
          share.revokedAt = new Date();
          await share.save({ session });
          await audit.append(
            {
              action: 'trip.share_revoked',
              actorUserId: String(ownerId),
              entityId: id,
              requestId: reqId,
              operationId,
            },
            session,
          );
        }
        return { revoked: true };
      });
    },
    async read(token: string): Promise<{ trip: SharedTripDto }> {
      if (!/^[a-f0-9]{64}$/.test(token)) throw missing();
      return connection.transaction(async (session) => {
        const share = await Share.findOne({
          tokenHash: tokenHash(token),
          revokedAt: null,
          expiresAt: { $gt: new Date() },
        }).session(session);
        if (!share) throw missing();
        const trip = await trips.models.Trip.findOne({
          _id: share.tripId,
          ownerId: share.ownerId,
          deletedAt: null,
        }).session(session);
        if (!trip) throw missing();
        // Explicit allowlist: never spread a private trip or activity into this response.
        const input = trips.toInput(trip);
        return {
          trip: {
            title: input.title,
            destinationName: trip.destinations[0]?.nameSnapshot ?? '',
            startDate: input.startDate,
            endDate: input.endDate,
            expiresAt: share.expiresAt.toISOString(),
            days: input.days.map((d) => ({
              dayId: d.dayId,
              date: d.date,
              destinationId: d.destinationId,
              activities: d.activities.map((a) => ({
                activityId: a.activityId,
                placeId: a.placeId,
                kind: a.kind,
                title: a.title,
                startLocalTime: a.startLocalTime,
                endLocalTime: a.endLocalTime,
                timezone: a.timezone,
                order: a.order,
              })),
            })),
          },
        };
      });
    },
  };
}
