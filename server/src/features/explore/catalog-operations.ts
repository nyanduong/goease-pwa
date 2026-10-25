import {
  ingestionScope,
  scopeKey,
  scopeDestination,
} from './ingestion-scope.js';
import mongoose, { Types, type ClientSession, type Connection } from 'mongoose';
import { randomUUID } from 'node:crypto';
import {
  adminPlaceInputSchema,
  approvedCover,
  catalogToday,
  catalogHistoryActionGroups,
  catalogHistoryQuerySchema,
  type CatalogHistoryQuery,
  type CatalogHistoryListDto,
  catalogQuality,
  sourceSnapshotSchema,
  type CatalogBatchInput,
  type CatalogBatchItem,
  type CatalogOperationsDto,
  type CatalogReviewDto,
  type CatalogScheduleInput,
  type CatalogScheduleListDto,
  type ReviewDecision,
  type SourceSnapshot,
} from '@goease/contracts';
import { catalogOperationsModels } from './catalog-operations.models.js';
import type { adminCatalog } from './admin-catalog.js';
import type { exploreService } from './explore.service.js';
import { normalizeSearch } from './explore.service.js';
import type { placeImportService } from './place-import.js';
import type {
  geoapifyProvider,
  GeoapifyGroup,
  GeoapifyCandidate,
  GeoapifyBatch,
} from './geoapify.js';
import { GeoapifyRateLimit } from './geoapify.js';
import type { tripService } from '../trips/trip.service.js';
import type { businessAudit } from '../audit/business-audit.js';
import { requestId } from '../auth/auth.service.js';
import { tokenHash } from '../auth/security.js';
import { HttpError } from '../../http-error.js';
import { adminOperationsModels } from './admin-operations.models.js';
import type { Logger } from '../../observability/logger.js';
import { adminV3Models } from './admin-v3.models.js';
import {
  evaluateDraftHours,
  initialSourceProvenance,
} from './catalog-rules.js';

const conflict = () =>
  new HttpError(
    409,
    'CATALOG_CONFLICT',
    'Thông tin đã thay đổi. Mở bản mới để xem lại; lựa chọn của bạn vẫn được giữ.',
  );
export function nextCatalogRun(
  config: Pick<
    CatalogScheduleInput,
    'hour' | 'minute' | 'weekday' | 'frequency'
  >,
  now = new Date(),
) {
  // Vietnam has a fixed UTC+07 offset; stored instants are UTC.
  const local = new Date(now.getTime() + 7 * 3600000);
  local.setUTCHours(config.hour, config.minute, 0, 0);
  if (config.frequency === 'weekly')
    local.setUTCDate(
      local.getUTCDate() + ((config.weekday - local.getUTCDay() + 7) % 7),
    );
  if (local.getTime() - 7 * 3600000 <= now.getTime())
    local.setUTCDate(
      local.getUTCDate() + (config.frequency === 'weekly' ? 7 : 1),
    );
  return new Date(local.getTime() - 7 * 3600000);
}
const snapshot = (p: GeoapifyCandidate): SourceSnapshot =>
  sourceSnapshotSchema.parse({
    name: p.name,
    address: p.address,
    latitude: p.latitude,
    longitude: p.longitude,
    category: p.category,
    venueType: p.venueType,
    categories: [...p.categories].sort(),
    openingHoursNote: p.openingHoursNote,
    sourceUrl: p.sourceUrl,
    ...(p.wikipedia ? { wikipedia: p.wikipedia } : {}),
    ...(p.wikidata ? { wikidata: p.wikidata } : {}),
    closed: p.closed ?? null,
  });
const fingerprint = (p: unknown) => tokenHash(JSON.stringify(p));

export function catalogOperations(
  connection: Connection,
  catalog: ReturnType<typeof adminCatalog>,
  explore: ReturnType<typeof exploreService>,
  trips: ReturnType<typeof tripService>,
  importer: ReturnType<typeof placeImportService>,
  audit: ReturnType<typeof businessAudit>,
  provider: ReturnType<typeof geoapifyProvider>,
  connected: boolean,
  logger: Logger,
) {
  const models = catalogOperationsModels(connection);
  const { Schedule, Run, Review } = models;
  const { Place } = explore.models;
  const { Key } = trips.models;
  const { Settings, Decision } = adminOperationsModels(connection);
  const { Usage } = adminV3Models(connection);
  async function transaction<T>(
    fn: (session: ClientSession) => Promise<T>,
  ): Promise<T> {
    for (let i = 0; ; i++) {
      try {
        return await connection.transaction(fn);
      } catch (e) {
        if (
          i < 2 &&
          e instanceof mongoose.mongo.MongoServerError &&
          e.code === 11000
        )
          continue;
        throw e;
      }
    }
  }
  async function receipt(
    actor: Types.ObjectId,
    operation: string,
    key: string,
    input: unknown,
    session: ClientSession,
  ) {
    const existing = await Key.findOne({
      actorId: actor,
      operation,
      key,
    }).session(session);
    if (existing && existing.requestHash !== fingerprint(input))
      throw new HttpError(
        409,
        'IDEMPOTENCY_CONFLICT',
        'Lựa chọn đã thay đổi. Hãy bắt đầu thao tác mới.',
      );
    return existing;
  }
  async function complete(
    actor: Types.ObjectId,
    operation: string,
    key: string,
    input: unknown,
    id: string,
    session: ClientSession,
    results?: CatalogBatchItem[],
  ) {
    await new Key({
      actorId: actor,
      operation,
      key,
      requestHash: fingerprint(input),
      status: 'completed',
      resourceType: 'catalog_operation',
      resourceId: id,
      responseStatus: 200,
      expiresAt: new Date(Date.now() + 86400000),
      ...(results ? { catalogResults: results } : {}),
    }).save({ session });
  }
  async function event(
    action: Parameters<typeof audit.append>[0]['action'],
    id: string,
    session: ClientSession,
    actor?: Types.ObjectId,
    revision?: number,
    operationId: string = randomUUID(),
  ) {
    const linkedRun = await Run.findOne({ operationId })
      .select('_id campaignId')
      .session(session);
    await audit.append(
      {
        action,
        entityId: id,
        entityRevision: revision,
        requestId: requestId(),
        operationId,
        ...(linkedRun
          ? {
              runId: String(linkedRun._id),
              ...(linkedRun.campaignId
                ? { campaignId: String(linkedRun.campaignId) }
                : {}),
            }
          : {}),
        ...(actor
          ? { actorUserId: String(actor) }
          : { catalogSystem: true as const }),
      },
      session,
    );
  }
  async function ensureSchedule(scope: string) {
    await Schedule.updateOne(
      { scope },
      { $setOnInsert: { scope } },
      { upsert: true },
    );
  }
  async function reserveSearch(actor: string) {
    await ensureSchedule('provider-quota');
    const token = randomUUID();
    await transaction(async (session) => {
      const doc = (await Schedule.findOne({ scope: 'provider-quota' }).session(
        session,
      ))!;
      const hour = Math.floor(Date.now() / 3600000);
      if (doc.quotaHour !== hour) {
        doc.quotaHour = hour;
        doc.searches = 0;
        doc.actorSearches.splice(0);
      }
      const active = doc.slots.filter(
        (s) => s.until && s.until.getTime() > Date.now(),
      );
      doc.slots.splice(0, doc.slots.length, ...active);
      const own = doc.actorSearches.find((s) => s.actor === actor);
      if (
        doc.searches >= 20 ||
        (own?.count ?? 0) >= 10 ||
        doc.slots.length >= 2
      )
        throw new HttpError(
          429,
          'IMPORT_SEARCH_LIMIT',
          'Đã đến giới hạn cập nhật. Hệ thống sẽ chờ trước khi thử lại.',
        );
      doc.searches++;
      if (own) own.count = (own.count ?? 0) + 1;
      else doc.actorSearches.push({ actor, count: 1 });
      doc.slots.push({ token, until: new Date(Date.now() + 120000) });
      // A concurrent reservation retries the transaction. Save plain arrays
      // atomically so Mongoose does not reset embedded document version keys
      // (the strict quota schema intentionally has no __v) during retry.
      const snapshot = doc.toObject();
      await Schedule.updateOne(
        { _id: doc._id },
        {
          $set: {
            quotaHour: doc.quotaHour,
            searches: doc.searches,
            actorSearches: snapshot.actorSearches,
            slots: snapshot.slots,
          },
        },
        { session, runValidators: true },
      );
    });
    return async () => {
      await Schedule.updateOne(
        { scope: 'provider-quota' },
        { $pull: { slots: { token } } },
      );
    };
  }
  async function upsertReview(
    placeId: Types.ObjectId,
    kind: CatalogReviewDto['kind'],
    signature: string,
    session: ClientSession,
    data: {
      incoming?: SourceSnapshot;
      previous?: SourceSnapshot | null;
      fetchedAt?: Date;
      duplicates?: string[];
    } = {},
  ) {
    const current = await Review.findOne({ placeId, kind }).session(session);
    if (current?.signature === signature) return;
    if (current) {
      if (kind === 'source' && current.state !== 'resolved')
        data.previous = current.previous
          ? sourceSnapshotSchema.parse(current.toObject().previous)
          : null;
      await Review.updateOne(
        { _id: current._id },
        {
          $set: {
            ...data,
            signature,
            state: 'open',
            decision: null,
            revisitAt: null,
          },
          $inc: { revision: 1 },
        },
        { session, runValidators: true },
      );
    } else
      await new Review({ placeId, kind, signature, ...data }).save({ session });
  }
  let reviewWatermark: Date | null = null;
  let reviewDay = '';
  let reviewSettingsRevision = -1;
  let reconciliation: Promise<void> | undefined;
  async function reconcileChangedReviews() {
    const settings = await Settings.findOne({ scope: 'global' });
    const day = catalogToday();
    const since =
      reviewDay === day && reviewSettingsRevision === (settings?.revision ?? 0)
        ? reviewWatermark
        : null;
    const checkpoint = new Date();
    type PlaceDoc = NonNullable<Awaited<ReturnType<typeof Place.findOne>>>;
    let chunk: PlaceDoc[] = [];
    const reconcile = async () => {
      if (!chunk.length) return;
      const places = chunk;
      chunk = [];
      await transaction(async (session) => {
        const rows = await Review.find({
          placeId: { $in: places.map((p) => p._id) },
        }).session(session);
        const writes = [];
        for (const p of places) {
          const candidates: {
            kind: CatalogReviewDto['kind'];
            signature: string;
            incoming?: SourceSnapshot;
            fetchedAt?: Date;
          }[] = [];
          const quality =
            p.publicationStatus === 'published'
              ? catalogQuality(catalog.dto(p), settings?.freshnessDays ?? 90)
              : null;
          if (quality?.issues.length)
            candidates.push({
              kind: 'quality',
              signature: fingerprint(quality.issues),
            });
          else if (
            rows.some(
              (r) =>
                String(r.placeId) === String(p._id) &&
                r.kind === 'quality' &&
                r.state !== 'resolved',
            )
          )
            writes.push({
              updateMany: {
                filter: {
                  placeId: p._id,
                  kind: 'quality' as const,
                  state: { $ne: 'resolved' },
                },
                update: { $set: { state: 'resolved' }, $inc: { revision: 1 } },
              },
            });
          if (p.publicationStatus === 'draft')
            candidates.push({ kind: 'draft', signature: String(p.revision) });
          if (p.sourceSnapshot?.closed)
            candidates.push({
              kind: 'source',
              signature: fingerprint(
                sourceSnapshotSchema.parse(p.toObject().sourceSnapshot),
              ),
              incoming: sourceSnapshotSchema.parse(p.toObject().sourceSnapshot),
              fetchedAt: p.sourceCheckedAt ?? p.source!.fetchedAt,
            });
          if (p.referencePrice && p.referencePrice.reviewAfter < catalogToday())
            candidates.push({
              kind: 'price',
              signature: fingerprint(p.toObject().referencePrice),
            });
          for (const candidate of candidates) {
            const existing = rows.find(
              (r) =>
                String(r.placeId) === String(p._id) &&
                r.kind === candidate.kind,
            );
            if (existing?.signature === candidate.signature) continue;
            if (existing)
              writes.push({
                updateOne: {
                  filter: { _id: existing._id },
                  update: {
                    $set: {
                      ...candidate,
                      state: 'open',
                      decision: null,
                      revisitAt: null,
                    },
                    $inc: { revision: 1 },
                  },
                },
              });
            else
              writes.push({
                insertOne: {
                  document: {
                    placeId: p._id,
                    ...candidate,
                    state: 'open',
                    revision: 1,
                  },
                },
              });
          }
        }
        if (writes.length) await Review.bulkWrite(writes, { session });
      });
    };
    const cursor = Place.find({
      deletedAt: null,
      publicationStatus: { $ne: 'archived' },
      ...(since ? { updatedAt: { $gte: since } } : {}),
    })
      .sort({ _id: 1 })
      .cursor({ batchSize: 200 });
    for await (const p of cursor) {
      chunk.push(p);
      if (chunk.length >= 200) await reconcile();
    }
    await reconcile();
    await Review.updateMany(
      { state: 'snoozed', revisitAt: { $lte: new Date() } },
      { $set: { state: 'open', revisitAt: null }, $inc: { revision: 1 } },
    );
    reviewWatermark = checkpoint;
    reviewDay = day;
    reviewSettingsRevision = settings?.revision ?? 0;
  }
  async function reconcileReviews() {
    reconciliation ??= reconcileChangedReviews().finally(() => {
      reconciliation = undefined;
    });
    await reconciliation;
  }
  const reason = {
    draft: 'Bản nháp cần xem trước khi đăng',
    duplicate: 'Có thể trùng một địa điểm khác',
    source: 'Thông tin nguồn mới cần đối chiếu',
    price: 'Giá tham khảo đã đến hạn kiểm tra',
    quality: 'Thông tin đang hiển thị cần kiểm tra chất lượng',
  };
  async function reviews(
    actor: Types.ObjectId,
    offset = 0,
    destinationId?: string,
    kind?: string,
    query = '',
    sort: 'priority' | 'newest' = 'priority',
  ) {
    await catalog.requireAdmin(actor);
    await reconcileReviews();
    const freshnessDays =
      (await Settings.findOne({ scope: 'global' }))?.freshnessDays ?? 90;
    const search = normalizeSearch(query).replace(
      /[.*+?^${}()|[\]\\]/g,
      '\\$&',
    );
    const [page] = await Review.aggregate<{
      items: { _id: Types.ObjectId }[];
      count: { total: number }[];
      groups: { _id: string; count: number }[];
      published: { total: number }[];
    }>([
      { $match: { state: 'open' } },
      {
        $lookup: {
          from: 'places',
          localField: 'placeId',
          foreignField: '_id',
          as: 'place',
        },
      },
      { $unwind: '$place' },
      {
        $match: {
          'place.deletedAt': null,
          ...(destinationId
            ? { 'place.destinationId': new Types.ObjectId(destinationId) }
            : {}),
          ...(search ? { 'place.searchText': { $regex: search } } : {}),
          $or: [
            { kind: { $nin: ['draft', 'price'] } },
            { kind: 'draft', 'place.publicationStatus': 'draft' },
            {
              kind: 'price',
              'place.referencePrice.reviewAfter': { $lt: catalogToday() },
              'place.publicationStatus': { $ne: 'archived' },
            },
          ],
        },
      },
      {
        $lookup: {
          from: 'catalog_reviews',
          let: { placeId: '$placeId' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$placeId', '$$placeId'] },
                kind: { $in: ['source', 'duplicate'] },
                state: { $ne: 'resolved' },
              },
            },
            { $limit: 1 },
            { $project: { _id: 1 } },
          ],
          as: 'blocking',
        },
      },
      {
        $match: {
          $or: [
            { kind: { $nin: ['draft', 'quality'] } },
            { 'blocking.0': { $exists: false } },
          ],
        },
      },
      {
        $facet: {
          items: [
            ...(kind ? [{ $match: { kind } }] : []),
            {
              $sort:
                sort === 'newest'
                  ? { updatedAt: -1, _id: -1 }
                  : { 'place.publicationStatus': -1, updatedAt: -1, _id: -1 },
            },
            { $skip: offset },
            { $limit: 20 },
            { $project: { _id: 1 } },
          ],
          count: [...(kind ? [{ $match: { kind } }] : []), { $count: 'total' }],
          groups: [{ $group: { _id: '$kind', count: { $sum: 1 } } }],
          published: [
            { $match: { 'place.publicationStatus': 'published' } },
            { $count: 'total' },
          ],
        },
      },
    ]);
    const ordered = page?.items.map((p) => String(p._id)) ?? [];
    const rows = await Review.find({ _id: { $in: ordered } });
    rows.sort(
      (a, b) => ordered.indexOf(String(a._id)) - ordered.indexOf(String(b._id)),
    );
    const total = page?.count[0]?.total ?? 0;
    const items: CatalogReviewDto[] = [];
    for (const row of rows) {
      const p = await Place.findOne({ _id: row.placeId, deletedAt: null });
      if (!p) continue;
      const effective = catalog.dto(await catalog.proposal(p));
      items.push({
        id: String(row._id),
        revision: row.revision,
        kind: row.kind as CatalogReviewDto['kind'],
        place: effective,
        currentLocation: p.mapLocation
          ? {
              latitude: p.mapLocation.latitude,
              longitude: p.mapLocation.longitude,
            }
          : null,
        reason:
          row.kind === 'quality' || row.kind === 'draft'
            ? catalogQuality(effective, freshnessDays)
                .issues.map((i) => i.label)
                .join(' · ') || reason[row.kind]
            : reason[row.kind as CatalogReviewDto['kind']],
        updatedAt: row.updatedAt.toISOString(),
        incoming: row.incoming
          ? sourceSnapshotSchema.parse(row.toObject().incoming)
          : null,
        previous: row.previous
          ? sourceSnapshotSchema.parse(row.toObject().previous)
          : null,
        fetchedAt: row.fetchedAt?.toISOString() ?? null,
        duplicates: row.duplicates,
        duplicatePlaces: row.duplicates.length
          ? (
              await Place.find({
                _id: { $ne: p._id },
                destinationId: p.destinationId,
                deletedAt: null,
                $or: [
                  { name: { $in: row.duplicates } },
                  { 'sourceSnapshot.name': { $in: row.duplicates } },
                ],
              }).limit(20)
            ).map((other) => ({
              id: String(other._id),
              name: other.name,
              locationQuery: other.planning?.locationQuery ?? 'Chưa có địa chỉ',
              sourceUrl: other.sourceUrl,
              publicationStatus: other.publicationStatus as
                'draft' | 'published' | 'archived',
            }))
          : [],
      });
    }
    return {
      items,
      total,
      hasMore: total > offset + 20,
      counts: Object.fromEntries(
        ['draft', 'duplicate', 'source', 'price', 'quality'].map((code) => [
          code,
          page?.groups.find((g) => g._id === code)?.count ?? 0,
        ]),
      ) as Record<CatalogReviewDto['kind'], number>,
      publishedCount: page?.published[0]?.total ?? 0,
    };
  }
  async function decide(
    actor: Types.ObjectId,
    id: string,
    input: ReviewDecision,
    key: string,
  ) {
    return transaction(async (session) => {
      await catalog.requireAdmin(actor, session);
      if (
        await receipt(actor, 'catalog.review', key, { id, ...input }, session)
      )
        return { saved: true };
      const review = await Review.findById(id).session(session);
      if (
        !review ||
        review.state !== 'open' ||
        review.revision !== input.expectedRevision
      )
        throw conflict();
      let place = await Place.findOne({
        _id: review.placeId,
        deletedAt: null,
      }).session(session);
      if (!place || place.revision !== input.expectedPlaceRevision)
        throw conflict();
      const { decision } = input;
      if (
        ['reject', 'revise', 'ignore'].includes(decision) &&
        !input.note?.trim()
      )
        throw new HttpError(
          400,
          'DECISION_REASON_REQUIRED',
          'Nhập lý do quyết định để người vận hành có thể theo dõi.',
        );
      await audit.capturePlace(String(place._id), session);
      if (
        (decision === 'apply' &&
          (review.kind !== 'source' || !review.incoming)) ||
        (decision === 'distinct' && review.kind !== 'duplicate') ||
        (decision === 'keep' && review.kind === 'duplicate')
      )
        throw new HttpError(
          400,
          'INVALID_DECISION',
          'Hành động này không phù hợp với việc đang xem.',
        );
      if (decision === 'later') {
        const date = input.revisitAt ? new Date(input.revisitAt) : null;
        if (
          !date ||
          date.getTime() <= Date.now() ||
          date.getTime() > Date.now() + 90 * 86400000
        )
          throw new HttpError(
            400,
            'INVALID_REVISIT',
            'Chọn thời điểm xem lại trong 90 ngày tới.',
          );
        review.state = 'snoozed';
        review.revisitAt = date;
      } else {
        review.state = decision === 'revise' ? 'open' : 'resolved';
        review.revisitAt = null;
      }

      if (decision === 'apply') {
        const incoming = sourceSnapshotSchema.parse(review.toObject().incoming);
        const previous = review.previous
          ? sourceSnapshotSchema.parse(review.toObject().previous)
          : null;
        const effective = await catalog.proposal(place, session);
        const fields: Record<string, unknown> = {};
        const changed = (field: keyof SourceSnapshot) =>
          !previous ||
          JSON.stringify(previous[field]) !== JSON.stringify(incoming[field]);
        if (changed('name')) fields.name = incoming.name;
        if (changed('category')) fields.category = incoming.category;
        if (changed('venueType')) fields.venueType = incoming.venueType;
        if (effective.planning && changed('address') && incoming.address)
          fields.planning = {
            ...effective.toObject().planning,
            locationQuery: incoming.address,
          };
        if (changed('openingHoursNote'))
          fields.openingHoursNote = incoming.openingHoursNote;
        if (changed('latitude') || changed('longitude') || changed('address'))
          fields.mapLocation = {
            latitude: incoming.latitude,
            longitude: incoming.longitude,
            precision: 'area',
            label: `${incoming.name} · vị trí nguồn`.slice(0, 150),
            sourceUrl: incoming.sourceUrl,
            checkedAt: (review.fetchedAt ?? new Date())
              .toISOString()
              .slice(0, 10),
          };
        if (incoming.closed === true) fields.publicationStatus = 'archived';
        place = await catalog.stageInSession(place, fields, session, {
          origin: 'geoapify',
          actorId: String(actor),
          reason: 'source',
          receivedAt: review.fetchedAt?.toISOString() ?? null,
        });
      } else {
        // Fence the editorial revision even when only the review decision changes.
        if (
          place.publicationStatus === 'published' &&
          place.publicRevision == null
        )
          place.publicRevision = place.revision;
        place.revision++;
        place.updatedBy = actor;
        place.updatedByType = 'user';
        await place.save({ session });
      }
      if (
        input.publish &&
        (!['keep', 'apply'].includes(decision) || review.incoming?.closed)
      )
        throw new HttpError(
          400,
          'PUBLICATION_NOT_READY',
          'Hoàn thiện dữ liệu trước khi chấp thuận và xuất bản.',
        );
      if (review.kind === 'draft') review.signature = String(place.revision);
      review.decision = decision;
      review.decisionNote = input.note ?? '';
      review.decidedBy = actor;
      review.decidedAt = new Date();
      review.revision++;
      await review.save({ session });
      if (input.publish) {
        place = await catalog.publishInSession(
          actor,
          String(place._id),
          place.revision,
          session,
        );
        await event(
          'catalog.published',
          String(place._id),
          session,
          actor,
          place.revision,
        );
      }
      const decisionOperation = randomUUID();
      await new Decision({
        operationId: decisionOperation,
        reviewId: review._id,
        placeId: place._id,
        actorId: actor,
        decision,
        note: input.note ?? '',
        placeRevision: place.revision,
        published: input.publish ?? false,
      }).save({ session });
      await event(
        `catalog.review_${decision}`,
        String(place._id),
        session,
        actor,
        place.revision,
        decisionOperation,
      );
      await complete(
        actor,
        'catalog.review',
        key,
        { id, ...input },
        id,
        session,
      );
      return { saved: true };
    });
  }
  async function eligibility(
    id: string,
    revision: number,
    status: 'published' | 'archived',
    session?: ClientSession,
  ): Promise<CatalogBatchItem> {
    const p = await Place.findOne({
      _id: id,
      deletedAt: null,
    }).session(session ?? null);
    const blocked = (reason: string): CatalogBatchItem => ({
      id,
      name: p?.name ?? 'Địa điểm không còn khả dụng',
      eligible: false,
      reason,
    });
    if (!p) return blocked('Không tìm thấy địa điểm.');
    if (p.revision !== revision)
      return blocked('Đã được sửa ở nơi khác. Mở bản mới để xem lại.');
    if (
      p.publicationStatus === status &&
      !(status === 'published' && p.proposalRevision != null)
    )
      return blocked(
        status === 'published' ? 'Đã đăng địa điểm này.' : 'Đã ngừng hiển thị.',
      );
    if (status === 'published') {
      if (
        !(await trips.models.Destination.exists({
          _id: p.destinationId,
          catalogKind: { $ne: 'legacy' },
          publicationStatus: 'published',
          deletedAt: null,
        }).session(session ?? null))
      )
        return blocked('Điểm đến chưa được xuất bản.');
      if (
        await Review.exists({
          placeId: p._id,
          kind: { $in: ['source', 'duplicate'] },
          state: { $ne: 'resolved' },
        }).session(session ?? null)
      )
        return blocked('Cần quyết định thông tin nguồn hoặc nghi trùng trước.');
      const form = catalog.input(await catalog.proposal(p, session));
      if (!approvedCover(form.images?.[0]))
        return blocked('Thiếu ảnh bìa hợp lệ và đủ nguồn/quyền sử dụng.');
      if (form.images?.[0]?.storage === 'source')
        return blocked('Lưu ảnh bìa lên Cloudinary trước khi xuất bản.');
      if (
        !adminPlaceInputSchema.safeParse({ ...form, publicationStatus: status })
          .success
      )
        return blocked(
          'Cần đủ tên, mô tả, địa chỉ và nguồn hợp lệ để khám phá.',
        );
      if (
        p.sourceSnapshot?.closed &&
        !(await Review.exists({
          placeId: p._id,
          kind: 'source',
          state: 'resolved',
          decision: 'keep',
        }).session(session ?? null))
      )
        return blocked(
          'Nguồn có dấu hiệu đóng cửa. Mở Việc cần làm để đối chiếu trước.',
        );
    }
    return {
      id,
      name: p.name,
      eligible: true,
      reason:
        status === 'published'
          ? 'Khách sẽ thấy trong Khám phá và có thể chọn cho lịch mới.'
          : 'Khách không còn thấy địa điểm; lịch đã lưu giữ nguyên.',
    };
  }
  async function batch(
    actor: Types.ObjectId,
    input: CatalogBatchInput,
    key?: string,
  ) {
    await catalog.requireAdmin(actor);
    if (!key) {
      const items = [];
      for (const p of input.items)
        items.push(await eligibility(p.id, p.expectedRevision, input.status));
      return { items };
    }
    return transaction(async (session) => {
      await catalog.requireAdmin(actor, session);
      const old = await receipt(actor, 'catalog.batch', key, input, session);
      if (old)
        return {
          items: old.catalogResults!.map((r) =>
            r.toObject(),
          ) as CatalogBatchItem[],
        };
      const items: CatalogBatchItem[] = [];
      for (const p of input.items) {
        const result = await eligibility(
          p.id,
          p.expectedRevision,
          input.status,
          session,
        );
        if (result.eligible) {
          await catalog.publishInSession(
            actor,
            p.id,
            p.expectedRevision,
            session,
            input.status,
          );
          await event(
            'catalog.publication_changed',
            p.id,
            session,
            actor,
            p.expectedRevision + 1,
          );
          await Review.updateMany(
            { placeId: p.id, kind: 'draft' },
            {
              $set: { state: 'resolved', revisitAt: null },
              $inc: { revision: 1 },
            },
            { session },
          );
          result.applied = true;
        } else result.applied = false;
        items.push(result);
      }
      await complete(
        actor,
        'catalog.batch',
        key,
        input,
        String(new Types.ObjectId()),
        session,
        items,
      );
      return { items };
    });
  }
  async function status(
    actor: Types.ObjectId,
    destinationId?: string,
  ): Promise<CatalogOperationsDto> {
    const scope = destinationId ? scopeKey(destinationId) : undefined;
    await catalog.requireAdmin(actor);
    const s =
      (scope ? await Schedule.findOne({ scope }) : null) ??
      new Schedule({ scope: scope ?? 'unselected' });
    const runs = await Run.find(scope ? { scope } : {})
      .sort({ createdAt: -1 })
      .limit(30);
    return {
      connected,
      schedule: {
        destinationId,
        enabled: s.enabled,
        frequency: s.frequency as 'daily' | 'weekly',
        hour: s.hour,
        minute: s.minute,
        weekday: s.weekday,
        group: s.group as CatalogScheduleInput['group'],
        revision: s.revision,
        nextRunAt: s.nextRunAt?.toISOString() ?? null,
      },
      runs: runs.map((r) => ({
        id: String(r._id),
        state: r.state as CatalogOperationsDto['runs'][number]['state'],
        actor: r.actorId ? 'user' : 'system',
        createdAt: r.createdAt.toISOString(),
        finishedAt: r.finishedAt?.toISOString() ?? null,
        nextAttemptAt: r.nextAttemptAt.toISOString(),
        attempts: r.attempts,
        message: r.message,
        counts: {
          created: r.counts?.created ?? 0,
          unchanged: r.counts?.unchanged ?? 0,
          updated: r.counts?.updated ?? 0,
          review: r.counts?.review ?? 0,
          skipped: r.counts?.skipped ?? 0,
          errors: r.counts?.errors ?? 0,
        },
      })),
    };
  }
  async function schedules(
    actor: Types.ObjectId,
    offset: number,
  ): Promise<CatalogScheduleListDto> {
    await catalog.requireAdmin(actor);
    // Only deliberately saved schedules, never quota records or defaults created by a run.
    const filter = { scope: /^(hoi-an|[a-f0-9]{24})$/, revision: { $gt: 0 } };
    const [rows, total] = await Promise.all([
      Schedule.find(filter).sort({ scope: 1 }).skip(offset).limit(50),
      Schedule.countDocuments(filter),
    ]);
    return {
      connected,
      total,
      hasMore: offset + rows.length < total,
      items: rows.map((s) => ({
        destinationId: scopeDestination(s.scope),
        enabled: s.enabled,
        frequency: s.frequency as 'daily' | 'weekly',
        hour: s.hour,
        minute: s.minute,
        weekday: s.weekday,
        group: s.group as CatalogScheduleInput['group'],
        revision: s.revision,
        nextRunAt: s.nextRunAt?.toISOString() ?? null,
      })),
    };
  }
  async function saveSchedule(
    actor: Types.ObjectId,
    input: CatalogScheduleInput,
    key: string,
  ) {
    await catalog.requireAdmin(actor);
    const scope = scopeKey(input.destinationId);
    if (input.enabled) await ingestionScope(connection, input.destinationId);
    await ensureSchedule(scope);
    await transaction(async (session) => {
      await catalog.requireAdmin(actor, session);
      if (await receipt(actor, 'catalog.schedule', key, input, session)) return;
      if (input.enabled)
        await importer.requireDestination(session, input.destinationId);
      const {
        expectedRevision,
        destinationId: _destinationId,
        ...settings
      } = input;
      void _destinationId;
      const saved = await Schedule.findOneAndUpdate(
        { scope, revision: expectedRevision },
        {
          $set: {
            ...settings,
            nextRunAt: input.enabled ? nextCatalogRun(input) : null,
          },
          $inc: { revision: 1 },
        },
        { session, returnDocument: 'after', runValidators: true },
      );
      if (!saved) throw conflict();
      await event(
        'catalog.schedule_saved',
        String(saved._id),
        session,
        actor,
        saved.revision,
      );
      await complete(
        actor,
        'catalog.schedule',
        key,
        input,
        String(saved._id),
        session,
      );
    });
    return status(actor, input.destinationId);
  }
  async function enqueue(
    actor: Types.ObjectId,
    key: string,
    destinationId?: string,
  ) {
    await catalog.requireAdmin(actor);
    const scope = scopeKey(destinationId);
    await ingestionScope(connection, destinationId);
    await ensureSchedule(scope);
    return transaction(async (session) => {
      await catalog.requireAdmin(actor, session);
      const old = await receipt(actor, 'catalog.run', key, { scope }, session);
      if (old) return { runId: old.resourceId };
      await importer.requireDestination(session, destinationId);
      if (!connected)
        throw new HttpError(
          503,
          'GEOAPIFY_NOT_CONFIGURED',
          'Chưa kết nối nguồn dữ liệu. Nhờ người thiết lập bổ sung khóa Geoapify và khởi động lại API.',
        );
      const s = (await Schedule.findOne({ scope }).session(session))!;
      const active = await Run.findOne({ scope, active: true }).session(
        session,
      );
      const run =
        active ??
        (await new Run({
          scope,
          group: s.group,
          actorId: actor,
          scopeSnapshot: {
            ...(await ingestionScope(connection, destinationId, session)),
            destinationId,
            destinationName: (
              await importer.requireDestination(session, destinationId)
            ).name,
          },
          policySnapshot: {
            autoApplyDraftHours: false,
            autoPublish: false,
            version: 0,
          },
        }).save({
          session,
        }));
      if (!active)
        await event(
          'catalog.run_requested',
          String(run._id),
          session,
          actor,
          undefined,
          run.operationId,
        );
      await complete(
        actor,
        'catalog.run',
        key,
        { scope },
        String(run._id),
        session,
      );
      return { runId: String(run._id) };
    });
  }
  async function history(
    actor: Types.ObjectId,
    query: CatalogHistoryQuery = catalogHistoryQuerySchema.parse({}),
  ): Promise<CatalogHistoryListDto> {
    await catalog.requireAdmin(actor);
    const match: Record<string, unknown> = { category: 'catalog' };
    if (query.kind !== 'all')
      match.action = { $in: catalogHistoryActionGroups[query.kind] };
    if (query.period !== 'all') {
      const today = new Date(Date.now() + 7 * 3600000)
        .toISOString()
        .slice(0, 10);
      const start = new Date(`${today}T00:00:00+07:00`);
      const days =
        query.period === '7days' ? 7 : query.period === '30days' ? 30 : 1;
      match.occurredAt = {
        $gte: new Date(start.getTime() - (days - 1) * 86400000),
        $lt: new Date(start.getTime() + 86400000),
      };
    }
    const objectId = (input: string) => ({
      $convert: { input, to: 'objectId', onError: null, onNull: null },
    });
    const ref = (type: string) => ({
      $cond: [{ $eq: ['$entityType', type] }, objectId('$entityId'), null],
    });
    const textMatch: Record<string, unknown> = {};
    if (query.q) {
      const literal = query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      textMatch.$or = [
        'historyActor',
        'historyPlace.name',
        'historyDestination.name',
        'historyRun.scopeSnapshot.destinationName',
      ].map((key) => ({ [key]: { $regex: literal, $options: 'i' } }));
    }
    const [result] = await connection
      .collection('audit_logs')
      .aggregate([
        { $match: match },
        {
          $project: {
            action: 1,
            actor: 1,
            entityId: 1,
            entityType: 1,
            entityRevision: 1,
            previousRevision: 1,
            campaignId: 1,
            batchId: 1,
            runId: 1,
            occurredAt: 1,
            outcome: 1,
            operationId: 1,
          },
        },
        {
          $set: {
            historyUserId: objectId('$actor.userId'),
            historyPlaceId: ref('place'),
            historyDestinationId: ref('destination'),
            historyRunId: ref('catalog_run'),
          },
        },
        {
          $lookup: {
            from: 'users',
            localField: 'historyUserId',
            foreignField: '_id',
            pipeline: [{ $project: { displayName: 1 } }],
            as: 'historyUser',
          },
        },
        {
          $lookup: {
            from: Place.collection.name,
            localField: 'historyPlaceId',
            foreignField: '_id',
            pipeline: [{ $project: { name: 1, destinationId: 1 } }],
            as: 'historyPlace',
          },
        },
        {
          $lookup: {
            from: trips.models.Destination.collection.name,
            localField: 'historyDestinationId',
            foreignField: '_id',
            pipeline: [{ $project: { name: 1 } }],
            as: 'historyDestination',
          },
        },
        {
          $lookup: {
            from: Run.collection.name,
            localField: 'historyRunId',
            foreignField: '_id',
            pipeline: [{ $project: { scopeSnapshot: 1 } }],
            as: 'historyRun',
          },
        },
        {
          $set: {
            historyActor: {
              $cond: [
                { $eq: ['$actor.type', 'system'] },
                'Hệ thống',
                {
                  $ifNull: [
                    { $first: '$historyUser.displayName' },
                    'Người vận hành',
                  ],
                },
              ],
            },
          },
        },
        { $match: textMatch },
        {
          $facet: {
            items: [
              { $sort: { occurredAt: -1, _id: -1 } },
              { $skip: query.offset },
              { $limit: 31 },
            ],
            total: [{ $count: 'value' }],
          },
        },
      ])
      .toArray();
    const events = result?.items ?? [];
    const items = [];
    for (const e of events.slice(0, 30)) {
      const p = e.historyPlace[0];
      const destination = e.historyDestination[0];
      const run = e.historyRun[0];
      const placeDestination = p?.destinationId
        ? await trips.models.Destination.findById(p.destinationId).select(
            'name',
          )
        : null;
      const destinationName =
        placeDestination?.name ??
        destination?.name ??
        run?.scopeSnapshot?.destinationName ??
        null;
      items.push({
        id: String(e._id),
        action: String(e.action),
        actor: String(e.historyActor),
        actorType:
          e.actor?.type === 'system' ? ('system' as const) : ('user' as const),
        placeId: p ? String(p._id) : null,
        destinationName,
        entityRevision: e.entityRevision,
        previousRevision: e.previousRevision,
        campaignId: e.campaignId,
        batchId: e.batchId,
        runId: e.runId,
        name:
          p?.name ??
          destination?.name ??
          (e.entityType === 'catalog_run'
            ? destinationName
              ? `${destinationName} · Lượt lấy dữ liệu`
              : 'Lượt lấy dữ liệu'
            : e.entityType === 'catalog_campaign'
              ? 'Đợt thu thập'
              : e.entityType === 'catalog_policy'
                ? 'Bộ quy tắc'
                : e.entityType === 'destination'
                  ? 'Điểm đến'
                  : 'Cài đặt dữ liệu'),
        occurredAt: new Date(e.occurredAt).toISOString(),
        outcome: e.outcome,
        note:
          typeof e.operationId === 'string'
            ? ((
                await Decision.findOne({ operationId: e.operationId }).select(
                  'note',
                )
              )?.note ?? '')
            : '',
      });
    }
    return {
      items,
      total: result?.total[0]?.value ?? 0,
      hasMore: events.length > 30,
    };
  }

  async function tick() {
    await transaction(async (session) => {
      const s = await Schedule.findOne({
        enabled: true,
        nextRunAt: { $lte: new Date() },
      }).session(session);
      if (!s) return;
      if (
        !(await Run.exists({ scope: s.scope, active: true }).session(session))
      ) {
        const destinationId = scopeDestination(s.scope);
        const area = await ingestionScope(connection, destinationId, session);
        const destination = await importer.requireDestination(
          session,
          destinationId,
        );
        const run = await new Run({
          scope: s.scope,
          group: s.group,
          scopeSnapshot: {
            ...area,
            destinationId,
            destinationName: destination.name,
          },
          policySnapshot: {
            autoApplyDraftHours: false,
            autoPublish: false,
            version: 0,
          },
        }).save({
          session,
        });
        await event(
          'catalog.run_requested',
          String(run._id),
          session,
          undefined,
          undefined,
          run.operationId,
        );
      }
      s.nextRunAt = nextCatalogRun({
        ...s.toObject(),
        frequency: s.frequency as 'daily' | 'weekly',
      });
      await s.save({ session });
    });
    const token = randomUUID();
    const run = await Run.findOneAndUpdate(
      {
        active: true,
        nextAttemptAt: { $lte: new Date() },
        $or: [
          { state: { $in: ['queued', 'retry'] } },
          { state: 'running', leaseUntil: { $lte: new Date() } },
        ],
      },
      {
        $set: {
          state: 'running',
          leaseToken: token,
          leaseUntil: new Date(Date.now() + 120000),
        },
        $inc: { attempts: 1 },
      },
      { returnDocument: 'after' },
    );
    if (!run) return;
    const fence = {
      _id: run._id,
      active: true,
      leaseToken: token,
      leaseUntil: { $gt: new Date() },
    };
    const heartbeat = setInterval(() => {
      void Run.updateOne(
        { ...fence, leaseUntil: { $gt: new Date() } },
        { $set: { leaseUntil: new Date(Date.now() + 120000) } },
      ).catch(() => {});
    }, 20000);
    heartbeat.unref();
    let release: (() => Promise<void>) | undefined;
    try {
      if (run.attempts > 3)
        throw new HttpError(
          409,
          'RUN_INTERRUPTED',
          'Lượt cập nhật bị gián đoạn nhiều lần. Kiểm tra kết nối rồi chọn Thử lại.',
        );
      if (!connected)
        throw new HttpError(
          503,
          'GEOAPIFY_NOT_CONFIGURED',
          'Chưa kết nối nguồn dữ liệu. Nhờ người thiết lập bổ sung khóa Geoapify rồi khởi động lại API.',
        );
      release = await reserveSearch(
        run.actorId ? String(run.actorId) : 'catalog-worker',
      );
      const area =
        run.scopeSnapshot ??
        (await ingestionScope(connection, scopeDestination(run.scope)));
      const queries: { group: GeoapifyGroup; limit: number }[] =
        run.group === 'mixed'
          ? [
              { group: 'sights', limit: 20 },
              { group: 'restaurant', limit: 15 },
              { group: 'cafe', limit: 15 },
            ]
          : [{ group: run.group as GeoapifyGroup, limit: 50 }];
      const batches: GeoapifyBatch[] = [];
      for (const query of queries) {
        // Persist the request before calling the provider, including failures.
        // This is internal usage, never a claimed provider credit balance.
        if (!(await Run.exists({ ...fence, leaseUntil: { $gt: new Date() } })))
          throw new HttpError(
            409,
            'LEASE_LOST',
            'Lượt cập nhật đã được tiếp tục ở nơi khác.',
          );
        const usage = await new Usage({
          runId: run._id,
          group: query.group,
          requestedLimit: query.limit,
        }).save();
        try {
          const batch = await provider(query.group, query.limit, {
            latitude: area.latitude,
            longitude: area.longitude,
            radiusMeters: area.radiusMeters,
          });
          batches.push(batch);
          await Usage.updateOne(
            { _id: usage._id },
            { $set: { state: 'fetched', received: batch.received } },
          );
        } catch (error) {
          await Usage.updateOne(
            { _id: usage._id },
            {
              $set: {
                state: 'failed',
                errorCode:
                  error instanceof HttpError
                    ? error.code
                    : 'PROVIDER_UNAVAILABLE',
              },
            },
          );
          throw error;
        }
      }
      const all = batches.flatMap((b) => b.items);
      const unique = [...new Map(all.map((p) => [p.externalId, p])).values()];
      const fetchedAt = new Date();
      await transaction(async (session) => {
        // A write on the claimed run in the SAME transaction fences every side effect.
        const owned = await Run.updateOne(
          { ...fence, leaseUntil: { $gt: new Date() } },
          { $set: { leaseUntil: new Date(Date.now() + 120000) } },
          { session },
        );
        if (owned.modifiedCount !== 1)
          throw new HttpError(
            409,
            'LEASE_LOST',
            'Lượt cập nhật đã được tiến trình khác tiếp tục.',
          );
        const destination = await importer.requireDestination(
          session,
          scopeDestination(run.scope),
        );
        const candidates = await importer.markDuplicates(
          unique.map((p) => ({ ...p, possibleDuplicates: [] })),
          session,
          scopeDestination(run.scope),
        );
        const counts = {
          created: 0,
          unchanged: 0,
          updated: 0,
          review: 0,
          skipped:
            batches.reduce((n, b) => n + b.rejected, 0) +
            all.length -
            unique.length,
          errors: 0,
        };
        for (const candidate of candidates) {
          const incoming = snapshot(candidate);
          const p = await Place.findOne({
            'source.provider': 'geoapify',
            'source.externalId': candidate.externalId,
          }).session(session);
          if (p) {
            if (
              String(p.destinationId) !== String(destination._id) ||
              p.deletedAt ||
              (p.publicationStatus === 'archived' &&
                !(await Review.exists({
                  placeId: p._id,
                  decision: 'ignore',
                }).session(session)))
            ) {
              counts.skipped++;
              continue;
            }
            const previous = p.sourceSnapshot
              ? sourceSnapshotSchema.parse(p.toObject().sourceSnapshot)
              : null;
            const same =
              previous && fingerprint(previous) === fingerprint(incoming);
            const effective = await catalog.proposal(p, session);
            const existingConflict = await Review.exists({
              placeId: p._id,
              kind: { $in: ['source', 'duplicate'] },
              state: { $ne: 'resolved' },
            }).session(session);
            const rule = evaluateDraftHours({
              enabled: run.policySnapshot?.autoApplyDraftHours ?? false,
              publicationStatus: p.publicationStatus,
              locks: p.fieldLocks,
              currentHours: effective.openingHoursNote,
              previous,
              incoming,
              hasConflict:
                candidate.possibleDuplicates.length > 0 ||
                Boolean(existingConflict),
            });
            const safeHours = !same && rule.eligible;
            if (safeHours) {
              await audit.capturePlace(String(p._id), session);
              const saved = await catalog.stageInSession(
                p,
                { openingHoursNote: incoming.openingHoursNote },
                session,
                {
                  origin: 'geoapify',
                  actorId: null,
                  reason: 'source',
                  receivedAt: fetchedAt.toISOString(),
                  runId: run._id,
                  ruleRevision: run.policySnapshot?.version ?? 0,
                },
              );
              await event(
                'catalog.proposal_saved',
                String(p._id),
                session,
                undefined,
                saved.revision,
                run.operationId,
              );
              counts.updated++;
            } else if (same) counts.unchanged++;
            else {
              await upsertReview(
                p._id,
                'source',
                fingerprint(incoming),
                session,
                { incoming, previous, fetchedAt },
              );
              counts.review++;
              await event(
                'catalog.source_changed',
                String(p._id),
                session,
                undefined,
                p.revision,
                run.operationId,
              );
            }
            await Place.updateOne(
              { _id: p._id },
              {
                $set: {
                  sourceSnapshot: incoming,
                  sourceCheckedAt: fetchedAt,
                  'source.fetchedAt': fetchedAt,
                },
              },
              { session, timestamps: false },
            );
            // Checks are summarized by the run audit; unchanged checks do not spam per-place audit.
            continue;
          }
          const saved = await new Place({
            destinationId: destination._id,
            destinationName: destination.name,
            revision: 1,
            createdByType: 'system',
            updatedByType: 'system',
            name: incoming.name,
            category: incoming.category,
            venueType: incoming.venueType,
            description: '',
            internalNote:
              'Nhập từ Geoapify / OpenStreetMap; cần kiểm tra thông tin trước khi xuất bản.',
            visitSearch: { state: 'pending', nextAttemptAt: new Date() },
            descriptionSearch: { state: 'pending', nextAttemptAt: new Date() },
            subtitle: '',
            searchText: normalizeSearch(
              `${incoming.name} ${incoming.address}`,
            ).slice(0, 2500),
            source: {
              provider: 'geoapify',
              externalId: candidate.externalId,
              fetchedAt,
              attribution: 'Powered by Geoapify · © OpenStreetMap contributors',
              license: 'ODbL-1.0',
            },
            sourceSnapshot: incoming,
            fieldProvenance: initialSourceProvenance(
              incoming,
              fetchedAt.toISOString(),
            ),
            sourceCheckedAt: fetchedAt,
            sourceUrl: incoming.sourceUrl,
            openingHoursNote: incoming.openingHoursNote,
            mapLocation: {
              latitude: incoming.latitude,
              longitude: incoming.longitude,
              precision: 'area',
              label: `${incoming.name} · vị trí nguồn`.slice(0, 150),
              sourceUrl: incoming.sourceUrl,
              checkedAt: fetchedAt.toISOString().slice(0, 10),
            },
            referencePrice: null,
            publicationStatus: 'draft',
            imageUrl: '',
            imageCredit: 'Chưa có ảnh thật được duyệt',
            durationLabel: 'Ước tính 60 phút',
            travelLabel: 'Kiểm tra đường đi',
            bestTimeLabel: 'Kiểm tra giờ mở cửa',
            tip: 'Giá chưa rõ; thời lượng 60 phút là gợi ý ban đầu của GoEase.',
            highlights: [],
            planning: {
              durationMinutes: 60,
              locationQuery:
                incoming.address ||
                `${incoming.name}, ${destination.name}`.slice(0, 200),
              costNote: 'Chưa có giá tham khảo để tự tính.',
              priceOptions: [],
            },
          }).save({ session });
          await event(
            'catalog.imported',
            String(saved._id),
            session,
            undefined,
            1,
            run.operationId,
          );
          await upsertReview(
            saved._id,
            candidate.possibleDuplicates.length ? 'duplicate' : 'draft',
            candidate.possibleDuplicates.length ? fingerprint(incoming) : '1',
            session,
            { incoming, fetchedAt, duplicates: candidate.possibleDuplicates },
          );
          if (incoming.closed)
            await upsertReview(
              saved._id,
              'source',
              fingerprint(incoming),
              session,
              { incoming, fetchedAt },
            );
          counts.created++;
          if (candidate.possibleDuplicates.length || incoming.closed)
            counts.review++;
        }
        await Run.updateOne(
          { _id: run._id, leaseToken: token },
          {
            $set: {
              state: 'succeeded',
              active: false,
              counts,
              finishedAt: new Date(),
              leaseToken: null,
              leaseUntil: null,
              message:
                'Đã kiểm tra nguồn. Bản nháp và thay đổi đang chờ người vận hành quyết định.',
            },
          },
          { session },
        );
        await event(
          'catalog.run_succeeded',
          String(run._id),
          session,
          undefined,
          undefined,
          run.operationId,
        );
      });
    } catch (error) {
      const code =
        error instanceof HttpError ? error.code : 'UPDATE_UNAVAILABLE';
      const retryable = ![
        'GEOAPIFY_NOT_CONFIGURED',
        'GEOAPIFY_AUTH',
        'INVALID_DESTINATION',
        'IMPORT_CATALOG_LIMIT',
        'RUN_INTERRUPTED',
      ].includes(code);
      const retry = retryable && run.attempts < 3;
      const next =
        error instanceof GeoapifyRateLimit
          ? error.retryAt
          : new Date(
              code === 'IMPORT_SEARCH_LIMIT'
                ? (Math.floor(Date.now() / 3600000) + 1) * 3600000
                : Date.now() +
                    (error instanceof HttpError && error.status === 429
                      ? 15 * 60000
                      : 60000 * 2 ** (run.attempts - 1)),
            );
      const message =
        code === 'GEOAPIFY_AUTH'
          ? 'Nguồn chưa chấp nhận kết nối. Nhờ người thiết lập kiểm tra khóa và quyền truy cập Geoapify.'
          : code === 'GEOAPIFY_NOT_CONFIGURED'
            ? 'Chưa kết nối nguồn dữ liệu. Nhờ người thiết lập bổ sung khóa Geoapify rồi khởi động lại API.'
            : retry
              ? 'Nguồn dữ liệu tạm chưa sẵn sàng hoặc đang giới hạn truy cập. Hệ thống sẽ tự thử lại.'
              : 'Lượt cập nhật chưa hoàn tất sau các lần thử. Kiểm tra kết nối hoặc cấu hình nguồn rồi chọn Thử lại.';
      await transaction(async (session) => {
        const updated = await Run.updateOne(
          { ...fence, leaseUntil: { $gt: new Date() } },
          {
            $set: {
              state: retry ? 'retry' : 'failed',
              active: retry,
              nextAttemptAt: next,
              leaseToken: null,
              leaseUntil: null,
              message,
              ...(retry ? {} : { finishedAt: new Date(), 'counts.errors': 1 }),
            },
          },
          { session },
        );
        if (updated.modifiedCount && !retry)
          await event(
            'catalog.run_failed',
            String(run._id),
            session,
            undefined,
            undefined,
            run.operationId,
          );
      });
    } finally {
      clearInterval(heartbeat);
      await release?.();
    }
  }
  let timer: ReturnType<typeof setInterval> | undefined;
  let running: Promise<void> | undefined;
  const start = () => {
    if (timer) return;
    const poll = () => {
      if (!running) {
        running = tick()
          .catch(() => logger.write('catalog.worker_failed'))
          .finally(() => {
            running = undefined;
          });
      }
    };
    timer = setInterval(poll, 5000);
    timer.unref();
    poll();
  };
  const stop = async () => {
    clearInterval(timer);
    timer = undefined;
    await running;
  };
  return {
    models,
    eligibility,
    reserveSearch,
    reviews,
    decide,
    batch,
    status,
    schedules,
    saveSchedule,
    enqueue,
    history,
    tick,
    start,
    stop,
  };
}
