import { randomUUID } from 'node:crypto';
import { Types, type Connection } from 'mongoose';
import {
  adminPlaceInputSchema,
  approvedCover,
  needsPlaceDescription,
  priceReady,
  plannerHoursReady,
  type EnrichmentDto,
  type EnrichmentItemState,
  type enrichmentQuerySchema,
  type enrichmentControlSchema,
} from '@goease/contracts';
import type { z } from 'zod';
import type { adminCatalog } from './admin-catalog.js';
import type { exploreService } from './explore.service.js';
import type { businessAudit } from '../audit/business-audit.js';
import { enrichmentModels } from './catalog-enrichment.models.js';
import { HttpError } from '../../http-error.js';

/** Coordinates durable source searches. Never approves observations or publishes places. */
export function catalogEnrichment(
  connection: Connection,
  explore: ReturnType<typeof exploreService>,
  catalog: ReturnType<typeof adminCatalog>,
  audit: ReturnType<typeof businessAudit>,
) {
  const models = enrichmentModels(connection),
    { Job, Item } = models,
    { Place } = explore.models;
  async function start(actor: Types.ObjectId, key: string) {
    await catalog.requireAdmin(actor);
    const receipt = await Job.findOne({ createdBy: actor, requestKey: key });
    if (receipt) return String(receipt._id);
    const destinations = await connection
      .collection('destinations')
      .find(
        { catalogKind: 'province', deletedAt: null },
        { projection: { _id: 1 } },
      )
      .toArray();
    const destinationIds = destinations.map((d) => d._id);
    if (!destinationIds.length || destinationIds.length > 34)
      throw new HttpError(
        409,
        'INVALID_INPUT',
        'Danh mục tỉnh/thành chưa sẵn sàng.',
      );
    const scope = { destinationId: { $in: destinationIds }, deletedAt: null };
    const last = await Place.findOne(scope).sort({ _id: -1 }).select('_id');
    if (!last)
      throw new HttpError(409, 'INVALID_INPUT', 'Chưa có địa điểm để bổ sung.');
    const total = await Place.countDocuments({
      ...scope,
      _id: { $lte: last._id },
    });
    try {
      return await connection.transaction(async (session) => {
        await catalog.requireAdmin(actor, session);
        const job = new Job({
          state: 'building',
          active: true,
          createdBy: actor,
          requestKey: key,
          total,
          destinationIds,
          cutoff: last._id,
        });
        await job.save({ session });
        await audit.append(
          {
            action: 'catalog.enrichment_started',
            actorUserId: String(actor),
            entityId: String(job._id),
            entityRevision: 1,
            requestId: randomUUID(),
            operationId: randomUUID(),
          },
          session,
        );
        return String(job._id);
      });
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 11000) {
        const prior = await Job.findOne({ createdBy: actor, requestKey: key });
        if (prior) return String(prior._id);
        throw new HttpError(
          409,
          'REVISION_CONFLICT',
          'Đã có một đợt toàn quốc. Mở đợt hiện tại để theo dõi.',
        );
      }
      throw error;
    }
  }
  async function read(
    actor: Types.ObjectId,
    query: z.infer<typeof enrichmentQuerySchema>,
  ): Promise<EnrichmentDto> {
    await catalog.requireAdmin(actor);
    const job = await Job.findOne().sort({ createdAt: -1, _id: -1 });
    if (!job) return { job: null, items: [], hasMore: false };
    const groups = await Item.aggregate<{
      _id: EnrichmentItemState;
      n: number;
    }>([
      { $match: { jobId: job._id } },
      { $group: { _id: '$state', n: { $sum: 1 } } },
    ]);
    const counts = Object.fromEntries(groups.map((g) => [g._id, g.n]));
    const rows = await Item.find({
      jobId: job._id,
      ...(query.state === 'all' ? {} : { state: query.state }),
    })
      .sort({ _id: 1 })
      .skip(query.offset)
      .limit(21);
    return {
      job: {
        id: String(job._id),
        state: job.state as NonNullable<EnrichmentDto['job']>['state'],
        revision: job.revision,
        total: job.total,
        registered: groups.reduce((n, g) => n + g.n, 0),
        createdAt: job.createdAt.toISOString(),
        counts,
      },
      items: rows.slice(0, 20).map((i) => ({
        id: String(i._id),
        placeId: String(i.placeId),
        name: i.name,
        destinationName: i.destinationName,
        state: i.state as EnrichmentItemState,
        missing: i.missing,
        message: i.message,
      })),
      hasMore: rows.length > 20,
    };
  }
  async function control(
    actor: Types.ObjectId,
    id: string,
    input: z.infer<typeof enrichmentControlSchema>,
  ) {
    await catalog.requireAdmin(actor);
    await connection.transaction(async (session) => {
      await catalog.requireAdmin(actor, session);
      const current = await Job.findOne({
        _id: id,
        active: true,
        revision: input.expectedRevision,
      }).session(session);
      if (!current)
        throw new HttpError(
          409,
          'REVISION_CONFLICT',
          'Đợt đã thay đổi. Tải lại trước khi thao tác.',
        );
      current.state =
        input.action === 'pause'
          ? 'paused'
          : current.seeded
            ? 'running'
            : 'building';
      current.revision++;
      await current.save({ session });
      await audit.append(
        {
          action: 'catalog.enrichment_controlled',
          actorUserId: String(actor),
          entityId: id,
          entityRevision: current.revision,
          previousRevision: input.expectedRevision,
          requestId: randomUUID(),
          operationId: randomUUID(),
        },
        session,
      );
    });
  }
  async function tick() {
    const now = new Date(),
      token = randomUUID();
    const job = await Job.findOneAndUpdate(
      {
        active: true,
        state: { $in: ['building', 'running'] },
        $or: [{ leaseUntil: null }, { leaseUntil: { $lte: now } }],
      },
      {
        $set: { leaseToken: token, leaseUntil: new Date(Date.now() + 120000) },
      },
      { returnDocument: 'after' },
    );
    if (!job) return;
    const fence = { _id: job._id, leaseToken: token };
    try {
      try {
        await catalog.requireAdmin(job.createdBy);
      } catch {
        await Job.updateOne(fence, {
          $set: { state: 'paused' },
          $inc: { revision: 1 },
        });
        return;
      }
      if (!job.seeded) {
        const rows = await Place.find({
          destinationId: { $in: job.destinationIds },
          deletedAt: null,
          _id: { $lte: job.cutoff, ...(job.cursor ? { $gt: job.cursor } : {}) },
        })
          .sort({ _id: 1 })
          .limit(500)
          .select('_id name destinationName');
        if (rows.length) {
          await Item.bulkWrite(
            rows.map((p) => ({
              updateOne: {
                filter: { jobId: job._id, placeId: p._id },
                update: {
                  $setOnInsert: {
                    jobId: job._id,
                    placeId: p._id,
                    name: p.name,
                    destinationName: p.destinationName,
                    state: 'queued',
                    nextCheckAt: now,
                  },
                },
                upsert: true,
              },
            })),
          );
          await Job.updateOne(fence, { $set: { cursor: rows.at(-1)!._id } });
        } else
          await Job.updateOne(
            { ...fence, state: { $ne: 'paused' } },
            { $set: { seeded: true, state: 'running' } },
          );
        return;
      }
      // Bounded dispatch; pause stops new assignments, already assigned searches may finish.
      const waiting = await Item.countDocuments({
        jobId: job._id,
        state: 'waiting',
      });
      const capacity = Math.min(50, Math.max(0, 150 - waiting));
      // MongoDB limit(0) means unlimited, so a full pool must skip dispatch entirely.
      const queued =
        capacity > 0
          ? await Item.find({ jobId: job._id, state: 'queued' })
              .sort({ _id: 1 })
              .limit(capacity)
          : [];
      for (const item of queued) {
        if (!(await Job.exists({ ...fence, state: 'running' }))) return;
        try {
          const raw = await Place.findOne({
            _id: item.placeId,
            deletedAt: null,
          });
          if (!raw || raw.publicationStatus !== 'draft') {
            await Item.updateOne(
              { _id: item._id, state: 'queued' },
              {
                $set: {
                  state: 'skipped',
                  message:
                    'Giữ nguyên mục đã xuất bản, lưu trữ hoặc không còn tồn tại.',
                },
              },
            );
            continue;
          }
          const effective = await catalog.proposal(raw, undefined, false);
          const effectiveInput = catalog.input(effective);
          const set: Record<string, unknown> = {};
          const searches = [
            [
              'imageSearch',
              !approvedCover(effectiveInput.images?.[0]) &&
                !effective.fieldLocks?.includes('images'),
            ],
            [
              'descriptionSearch',
              needsPlaceDescription(effective.description) &&
                !effective.fieldLocks?.includes('description'),
            ],
            [
              'visitSearch',
              !effective.fieldLocks?.includes('visitInfo') &&
                (!effective.visitInfo?.hours?.reviewed ||
                  !effective.visitInfo?.price?.reviewed),
            ],
          ] as const;
          for (const [field, needed] of searches) {
            const search = raw[field];
            if (
              !needed ||
              (field === 'descriptionSearch' &&
                raw.descriptionSearch?.result) ||
              (field === 'visitSearch' &&
                raw.visitSearch?.result?.hours &&
                raw.visitSearch?.result?.price) ||
              (field === 'imageSearch' && raw.imageSearch?.defaultCover)
            )
              continue;
            if (search?.state === 'pending' || search?.state === 'searching')
              continue;
            set[`${field}.state`] = 'pending';
            set[`${field}.attempts`] = 0;
            set[`${field}.nextAttemptAt`] = now;
          }
          if (Object.keys(set).length) {
            await Place.updateOne(
              {
                _id: raw._id,
                revision: raw.revision,
                publicationStatus: 'draft',
                deletedAt: null,
                updatedAt: raw.updatedAt,
                $and: ['imageSearch', 'descriptionSearch', 'visitSearch'].map(
                  (field) => ({
                    $or: [
                      { [`${field}.leaseUntil`]: null },
                      { [`${field}.leaseUntil`]: { $lte: now } },
                    ],
                  }),
                ),
              },
              { $set: set },
              { timestamps: false },
            );
          }
          await Item.updateOne(
            { _id: item._id, state: 'queued' },
            {
              $set: {
                state: 'waiting',
                nextCheckAt: now,
                message: 'Đang đối chiếu ảnh, giới thiệu, giờ và giá từ nguồn.',
              },
            },
          );
        } catch {
          await Item.updateOne(
            { _id: item._id, state: 'queued' },
            {
              $set: {
                state: 'review',
                message:
                  'Bản nháp có dữ liệu hoặc phiên bản chưa hợp lệ. Mở địa điểm để kiểm tra; các mục khác vẫn tiếp tục.',
              },
            },
          );
        }
      }
      const rows = await Item.find({
        jobId: job._id,
        state: 'waiting',
        nextCheckAt: { $lte: now },
      })
        .sort({ nextCheckAt: 1, _id: 1 })
        .limit(100);
      for (const item of rows) {
        try {
          const raw = await Place.findOne({
            _id: item.placeId,
            deletedAt: null,
          });
          if (!raw || raw.publicationStatus !== 'draft') {
            await Item.updateOne(
              { _id: item._id },
              {
                $set: {
                  state: 'skipped',
                  message: 'Giữ nguyên trạng thái biên tập hiện tại.',
                },
              },
            );
            continue;
          }
          const effective = await catalog.withSourceDefaults(
              await catalog.proposal(raw, undefined, false),
            ),
            input = catalog.input(effective);
          const missing = [
            !approvedCover(input.images?.[0]) ? 'Ảnh bìa' : null,
            needsPlaceDescription(input.description) ? 'Giới thiệu' : null,
            !input.mapLocation ? 'Tọa độ' : null,
            !plannerHoursReady(input.openingHoursNote) ||
            !input.visitInfo?.hours?.reviewed
              ? 'Giờ đã xác minh'
              : null,
            !priceReady(input.referencePrice) ? 'Giá đã xác minh' : null,
          ].filter((v): v is string => !!v);
          const pending = [
            raw.imageSearch,
            raw.descriptionSearch,
            raw.visitSearch,
          ].some((s) => s?.state === 'pending' || s?.state === 'searching');
          const ready =
            !missing.length &&
            adminPlaceInputSchema.safeParse({
              ...input,
              publicationStatus: 'published',
            }).success;
          const found = !!(
            raw.imageSearch?.defaultCover ||
            raw.descriptionSearch?.result ||
            raw.visitSearch?.result
          );
          const state: EnrichmentItemState = ready
            ? 'ready'
            : pending
              ? 'waiting'
              : found
                ? 'review'
                : 'unresolved';
          await Item.updateOne(
            { _id: item._id, state: 'waiting' },
            {
              $set: {
                state,
                missing,
                nextCheckAt: new Date(Date.now() + 30000),
                message: ready
                  ? 'Đủ trường để xem trước xuất bản; chưa tự xuất bản.'
                  : pending
                    ? 'Đang tìm hoặc chờ nguồn cho phép thử lại.'
                    : found
                      ? 'Có dữ liệu nguồn cần duyệt; chưa đủ điều kiện xếp lịch.'
                      : 'Chưa tìm được thông tin phù hợp trong các nguồn hiện hỗ trợ.',
              },
            },
          );
        } catch {
          await Item.updateOne(
            { _id: item._id, state: 'waiting' },
            {
              $set: {
                state: 'review',
                message:
                  'Chưa đọc được dữ liệu hoặc phiên bản hợp lệ. Cần kiểm tra bản nháp; chưa xuất bản.',
              },
            },
          );
        }
      }
      if (
        !(await Item.exists({
          jobId: job._id,
          state: { $in: ['queued', 'waiting'] },
        }))
      ) {
        await Job.updateOne(
          { ...fence, state: 'running' },
          {
            $set: { state: 'completed', active: false },
            $inc: { revision: 1 },
          },
        );
      }
    } finally {
      await Job.updateOne(fence, {
        $set: { leaseToken: null, leaseUntil: null },
      });
    }
  }
  let timer: ReturnType<typeof setInterval> | undefined,
    running: Promise<void> | undefined;
  function startWorker() {
    if (timer) return;
    const poll = () => {
      if (!running)
        running = tick()
          .catch(() => {})
          .finally(() => {
            running = undefined;
          });
    };
    timer = setInterval(poll, 2000);
    timer.unref();
    poll();
  }
  async function stopWorker() {
    clearInterval(timer);
    timer = undefined;
    await running;
  }
  return { models, start, read, control, tick, startWorker, stopWorker };
}
