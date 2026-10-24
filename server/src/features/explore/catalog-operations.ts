import {
  ingestionScope,
  initialDestinationId,
  scopeKey,
  scopeDestination,
} from './ingestion-scope.js';
import mongoose, { Types, type ClientSession, type Connection } from 'mongoose';
import { randomUUID } from 'node:crypto';
import {
  adminPlaceInputSchema,
  catalogToday,
  catalogQuality,
  sourceSnapshotSchema,
  type CatalogBatchInput,
  type CatalogBatchItem,
  type CatalogOperationsDto,
  type CatalogReviewDto,
  type CatalogScheduleInput,
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
    await audit.append(
      {
        action,
        entityId: id,
        entityRevision: revision,
        requestId: requestId(),
        operationId,
        ...(actor
          ? { actorUserId: String(actor) }
          : { catalogSystem: true as const }),
      },
      session,
    );
  }
  async function ensureSchedule(scope = 'hoi-an') {
    await Schedule.updateOne(
      { scope },
      { $setOnInsert: { scope } },
      { upsert: true },
    );
  }
  async function reserveSearch(actor: string) {
    await ensureSchedule();
    const token = randomUUID();
    await transaction(async (session) => {
      const doc = (await Schedule.findOne({ scope: 'hoi-an' }).session(
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
      await doc.save({ session });
    });
    return async () => {
      await Schedule.updateOne(
        { scope: 'hoi-an' },
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
  async function reconcileReviews() {
    const settings = await Settings.findOne({ scope: 'global' });
    await transaction(async (session) => {
      const places = await Place.find({
        deletedAt: null,
        publicationStatus: { $ne: 'archived' },
      })
        .limit(5001)
        .session(session);
      if (places.length > 5000)
        throw new HttpError(
          409,
          'CATALOG_LIMIT',
          'Danh mục vượt phạm vi vận hành hiện tại. Nhờ người thiết lập kiểm tra.',
        );
      for (const p of places) {
        const quality = catalogQuality(
          catalog.dto(p),
          settings?.freshnessDays ?? 90,
        );
        if (quality.issues.length && p.publicationStatus === 'published')
          await upsertReview(
            p._id,
            'quality',
            fingerprint(quality.issues),
            session,
          );
        else
          await Review.updateMany(
            { placeId: p._id, kind: 'quality', state: { $ne: 'resolved' } },
            { $set: { state: 'resolved' }, $inc: { revision: 1 } },
            { session },
          );
        if (p.publicationStatus === 'draft')
          await upsertReview(p._id, 'draft', String(p.revision), session);
        if (p.sourceSnapshot?.closed) {
          const incoming = sourceSnapshotSchema.parse(
            p.toObject().sourceSnapshot,
          );
          await upsertReview(p._id, 'source', fingerprint(incoming), session, {
            incoming,
            fetchedAt: p.sourceCheckedAt ?? p.source!.fetchedAt,
          });
        }
        if (p.referencePrice && p.referencePrice.reviewAfter < catalogToday())
          await upsertReview(
            p._id,
            'price',
            fingerprint(p.toObject().referencePrice),
            session,
          );
      }
      await Review.updateMany(
        { state: 'snoozed', revisitAt: { $lte: new Date() } },
        { $set: { state: 'open', revisitAt: null }, $inc: { revision: 1 } },
        { session },
      );
    });
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
  ) {
    await catalog.requireAdmin(actor);
    await reconcileReviews();
    const freshnessDays =
      (await Settings.findOne({ scope: 'global' }))?.freshnessDays ?? 90;
    const rows = await Review.find({ state: 'open' })
      .sort({ updatedAt: -1, _id: -1 })
      .limit(20001);
    if (rows.length > 20000)
      throw new HttpError(
        409,
        'CATALOG_LIMIT',
        'Danh sách việc vượt phạm vi vận hành hiện tại. Nhờ người thiết lập kiểm tra.',
      );
    const blocking = new Set(
      (
        await Review.find({
          kind: { $in: ['duplicate', 'source'] },
          state: { $ne: 'resolved' },
        }).select('placeId')
      ).map((r) => String(r.placeId)),
    );
    const items: CatalogReviewDto[] = [];
    for (const row of rows) {
      const p = await Place.findOne({ _id: row.placeId, deletedAt: null });
      if (
        p &&
        ((destinationId && String(p.destinationId) !== destinationId) ||
          (kind && row.kind !== kind) ||
          (query &&
            !normalizeSearch(
              `${p.name} ${p.planning?.locationQuery ?? ''}`,
            ).includes(normalizeSearch(query))))
      )
        continue;
      if (
        !p ||
        (row.kind === 'draft' && p.publicationStatus !== 'draft') ||
        (row.kind === 'price' &&
          (!p.referencePrice ||
            p.referencePrice.reviewAfter >= catalogToday() ||
            p.publicationStatus === 'archived'))
      )
        continue;
      if (
        ['draft', 'quality'].includes(row.kind) &&
        blocking.has(String(p._id))
      )
        continue;
      items.push({
        id: String(row._id),
        revision: row.revision,
        kind: row.kind as CatalogReviewDto['kind'],
        place: catalog.dto(p),
        currentLocation: p.mapLocation
          ? {
              latitude: p.mapLocation.latitude,
              longitude: p.mapLocation.longitude,
            }
          : null,
        reason:
          row.kind === 'quality' || row.kind === 'draft'
            ? catalogQuality(catalog.dto(p), freshnessDays)
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
      items: items
        .sort(
          (a, b) =>
            Number(b.place.publicationStatus === 'published') -
            Number(a.place.publicationStatus === 'published'),
        )
        .slice(offset, offset + 20),
      total: items.length,
      hasMore: items.length > offset + 20,
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
      const place = await Place.findOne({
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
        // Apply only fields changed in the source since its previous observation.
        const changed = (field: keyof SourceSnapshot) =>
          !previous ||
          JSON.stringify(previous[field]) !== JSON.stringify(incoming[field]);
        if (changed('name')) place.name = incoming.name;
        if (changed('category') || changed('venueType')) {
          place.category = incoming.category;
          place.venueType = incoming.venueType;
        }
        if (place.planning && changed('address') && incoming.address)
          place.planning.locationQuery = incoming.address;
        if (changed('openingHoursNote'))
          place.openingHoursNote = incoming.openingHoursNote;
        if (changed('latitude') || changed('longitude') || changed('address'))
          place.set('mapLocation', {
            latitude: incoming.latitude,
            longitude: incoming.longitude,
            precision: 'area',
            label: `${incoming.name} · vị trí nguồn`.slice(0, 150),
            sourceUrl: incoming.sourceUrl,
            checkedAt: review.fetchedAt!.toISOString().slice(0, 10),
          });
        if (incoming.closed === true) place.publicationStatus = 'archived';
        // A source reclassification must never leave an incompatible food-idea price.
        place.searchText = normalizeSearch(
          `${place.name} ${place.description} ${place.planning?.locationQuery ?? ''}`,
        ).slice(0, 2500);
      }
      if (input.publish) {
        // Validate the writable projection rather than trusting UI eligibility.
        const {
          id: _id,
          revision: _revision,
          updatedAt: _updated,
          source: _source,
          imageUrl: _image,
          imageCredit: _credit,
          ...writable
        } = catalog.dto(place);
        void _id;
        void _revision;
        void _updated;
        void _source;
        void _image;
        void _credit;
        if (
          !['keep', 'apply'].includes(decision) ||
          !adminPlaceInputSchema.safeParse({
            ...writable,
            publicationStatus: 'published',
          }).success ||
          review.incoming?.closed
        )
          throw new HttpError(
            400,
            'PUBLICATION_NOT_READY',
            'Hoàn thiện dữ liệu trước khi chấp thuận và xuất bản.',
          );
        if (
          await Review.exists({
            placeId: place._id,
            _id: { $ne: review._id },
            kind: { $in: ['source', 'duplicate'] },
            state: { $ne: 'resolved' },
          }).session(session)
        )
          throw conflict();
        place.publicationStatus = 'published';
      }
      // Write the place as well as the review, so an edit racing a keep/defer
      // decision conflicts and retries against the new editorial revision.
      place.revision++;
      place.updatedBy = actor;
      place.updatedByType = 'user';
      await place.save({ session });
      if (review.kind === 'draft') review.signature = String(place.revision);
      review.decision = decision;
      review.decisionNote = input.note ?? '';
      review.decidedBy = actor;
      review.decidedAt = new Date();
      review.revision++;
      await review.save({ session });
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
    if (!p) return blocked('Không tìm thấy địa điểm Hội An.');
    if (p.revision !== revision)
      return blocked('Đã được sửa ở nơi khác. Mở bản mới để xem lại.');
    if (p.publicationStatus === status)
      return blocked(
        status === 'published' ? 'Đã đăng địa điểm này.' : 'Đã ngừng hiển thị.',
      );
    if (status === 'published') {
      if (
        await Review.exists({
          placeId: p._id,
          kind: { $in: ['source', 'duplicate'] },
          state: { $ne: 'resolved' },
        }).session(session ?? null)
      )
        return blocked('Cần quyết định thông tin nguồn hoặc nghi trùng trước.');
      const {
        id: _id,
        revision: _revision,
        updatedAt: _date,
        source: _source,
        imageUrl: _image,
        imageCredit: _credit,
        ...form
      } = catalog.dto(p);
      void _id;
      void _revision;
      void _date;
      void _source;
      void _image;
      void _credit;
      if (
        !adminPlaceInputSchema.safeParse({ ...form, publicationStatus: status })
          .success
      )
        return blocked(
          'Cần đủ thông tin địa điểm và giá còn hạn, nguồn, điều kiện, phần bao gồm/không bao gồm trước khi đăng.',
        );
      if (
        p.referencePrice &&
        (p.referencePrice.checkedAt > catalogToday() ||
          p.referencePrice.reviewAfter < catalogToday())
      )
        return blocked(
          'Giá cần kiểm tra lại trước khi đăng. Có thể giữ bản nháp.',
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
          await audit.capturePlace(p.id, session);
          const changed = await Place.updateOne(
            { _id: p.id, revision: p.expectedRevision },
            {
              $set: {
                publicationStatus: input.status,
                updatedBy: actor,
                updatedByType: 'user',
              },
              $inc: { revision: 1 },
            },
            { session },
          );
          if (changed.modifiedCount !== 1) throw conflict();
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
    destinationId = initialDestinationId,
  ): Promise<CatalogOperationsDto> {
    const scope = scopeKey(destinationId);
    await catalog.requireAdmin(actor);
    await ensureSchedule(scope);
    const s = (await Schedule.findOne({ scope }))!;
    const runs = await Run.find({ scope }).sort({ createdAt: -1 }).limit(30);
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
  async function saveSchedule(
    actor: Types.ObjectId,
    input: CatalogScheduleInput,
    key: string,
  ) {
    const scope = scopeKey(input.destinationId);
    if (input.enabled) await ingestionScope(connection, input.destinationId);
    await ensureSchedule(scope);
    await transaction(async (session) => {
      await catalog.requireAdmin(actor, session);
      if (await receipt(actor, 'catalog.schedule', key, input, session)) return;
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
    destinationId = initialDestinationId,
  ) {
    const scope = scopeKey(destinationId);
    await ingestionScope(connection, destinationId);
    await ensureSchedule(scope);
    return transaction(async (session) => {
      await catalog.requireAdmin(actor, session);
      const old = await receipt(actor, 'catalog.run', key, { scope }, session);
      if (old) return { runId: old.resourceId };
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
        (await new Run({ scope, group: s.group, actorId: actor }).save({
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
  async function history(actor: Types.ObjectId, offset = 0) {
    await catalog.requireAdmin(actor);
    const events = await connection
      .collection('audit_logs')
      .find(
        { category: 'catalog' },
        {
          projection: {
            action: 1,
            operationId: 1,
            actor: 1,
            entityId: 1,
            entityType: 1,
            occurredAt: 1,
            outcome: 1,
          },
        },
      )
      .sort({ occurredAt: -1, _id: -1 })
      .skip(offset)
      .limit(31)
      .toArray();
    const items = [];
    for (const e of events.slice(0, 30)) {
      const p =
        e.entityType === 'place'
          ? await Place.findById(e.entityId).select('name')
          : null;
      items.push({
        id: String(e._id),
        action: String(e.action),
        actor:
          e.actor.type === 'system'
            ? 'Hệ thống'
            : String(
                (
                  await connection
                    .collection('users')
                    .findOne(
                      { _id: new Types.ObjectId(e.actor.userId) },
                      { projection: { displayName: 1 } },
                    )
                )?.displayName ?? 'Người vận hành',
              ),
        placeId: p ? String(p._id) : null,
        name:
          p?.name ??
          (e.entityType === 'catalog_run'
            ? 'Lượt cập nhật dữ liệu'
            : 'Cấu hình cập nhật'),
        occurredAt: e.occurredAt,
        outcome: e.outcome,
        note:
          (
            await Decision.findOne({ operationId: e.operationId }).select(
              'note',
            )
          )?.note ?? '',
      });
    }
    return { items, hasMore: events.length > 30 };
  }

  async function tick() {
    await ensureSchedule();
    await transaction(async (session) => {
      const s = await Schedule.findOne({
        enabled: true,
        nextRunAt: { $lte: new Date() },
      }).session(session);
      if (!s) return;
      if (
        !(await Run.exists({ scope: s.scope, active: true }).session(session))
      ) {
        const run = await new Run({ scope: s.scope, group: s.group }).save({
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
      const area = await ingestionScope(
        connection,
        scopeDestination(run.scope),
      );
      const queries: { group: GeoapifyGroup; limit: number }[] =
        run.group === 'mixed'
          ? [
              { group: 'sights', limit: 20 },
              { group: 'restaurant', limit: 15 },
              { group: 'cafe', limit: 15 },
            ]
          : [{ group: run.group as GeoapifyGroup, limit: 50 }];
      const batches: GeoapifyBatch[] = [];
      for (const query of queries)
        batches.push(await provider(query.group, query.limit, area));
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
        const settings = await Settings.findOne({ scope: 'global' }).session(
          session,
        );
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
            const onlyHours =
              previous &&
              Object.keys(incoming).every(
                (k) =>
                  k === 'openingHoursNote' ||
                  JSON.stringify(previous[k as keyof SourceSnapshot]) ===
                    JSON.stringify(incoming[k as keyof SourceSnapshot]),
              );
            const safeHours =
              !same &&
              onlyHours &&
              settings?.autoApplyDraftHours &&
              p.publicationStatus === 'draft' &&
              p.openingHoursNote === previous?.openingHoursNote &&
              !candidate.possibleDuplicates.length &&
              !(await Review.exists({
                placeId: p._id,
                kind: { $in: ['source', 'duplicate'] },
                state: { $ne: 'resolved' },
              }).session(session));
            if (safeHours) {
              await audit.capturePlace(String(p._id), session);
              p.openingHoursNote = incoming.openingHoursNote;
              p.revision++;
              p.updatedByType = 'system';
              p.updatedBy = null;
              await p.save({ session });
              await event(
                'catalog.updated',
                String(p._id),
                session,
                undefined,
                p.revision,
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
            description:
              'Địa điểm nhập từ Geoapify / OpenStreetMap; cần biên tập và kiểm tra thông tin trước khi đi.',
            subtitle: 'Thông tin nguồn mở, chưa xác minh tại cơ sở.',
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
            imageUrl: '/images/explore-hoian.png',
            imageCredit: 'Ảnh minh họa AI, không phải ảnh cơ sở',
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
    reserveSearch,
    reviews,
    decide,
    batch,
    status,
    saveSchedule,
    enqueue,
    history,
    tick,
    start,
    stop,
  };
}
