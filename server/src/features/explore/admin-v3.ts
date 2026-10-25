import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { Types, type Connection, type ClientSession } from 'mongoose';
import {
  adminPlaceInputSchema,
  approvedPhoto,
  adminPlaceQuerySchema,
  sourceSnapshotSchema,
  type CampaignInput,
  type CatalogPolicyInput,
  type BulkPreviewInput,
  type AdminMapQuery,
  type BulkJobDto,
  type CampaignSummary,
  type ProvinceImportInput,
} from '@goease/contracts';
import { adminV3Models } from './admin-v3.models.js';
import {
  scopeKey,
  scopeDestination,
  ingestionScope,
} from './ingestion-scope.js';
import { catalogQuery } from './catalog-query.js';
import { evaluateDraftHours } from './catalog-rules.js';
import type { adminCatalog } from './admin-catalog.js';
import type { catalogOperations } from './catalog-operations.js';
import type { exploreService } from './explore.service.js';
import type { tripService } from '../trips/trip.service.js';
import type { businessAudit } from '../audit/business-audit.js';
import { requestId } from '../auth/auth.service.js';
import { tokenHash } from '../auth/security.js';
import { HttpError } from '../../http-error.js';
import type { ResolveProvinceArea } from './province-geocoder.js';
import { adminOperationsModels } from './admin-operations.models.js';
import { provinces } from '../trips/province-data.js';
import type { IngestionArea } from './ingestion-scope.js';

const notFound = () =>
  new HttpError(404, 'OPERATION_NOT_FOUND', 'Không tìm thấy đợt hoặc lô này.');
const changed = () =>
  new HttpError(
    409,
    'CATALOG_CONFLICT',
    'Dữ liệu đã thay đổi. Tạo bản xem trước mới để đối chiếu.',
  );
export function adminV3Service(
  connection: Connection,
  catalog: ReturnType<typeof adminCatalog>,
  operations: ReturnType<typeof catalogOperations>,
  explore: ReturnType<typeof exploreService>,
  trips: ReturnType<typeof tripService>,
  audit: ReturnType<typeof businessAudit>,
  connected: boolean,
  resolveArea?: ResolveProvinceArea,
) {
  const models = adminV3Models(connection);
  const { Campaign, Policy, Bulk, Item, Usage } = models;
  const { Run, Review, Schedule } = operations.models;
  const { Place } = explore.models;
  const { Destination } = trips.models;
  async function fenceSourceDestination(
    destinationId: string,
    session: ClientSession,
  ) {
    const destination = await Destination.findOne({
      _id: destinationId,
      deletedAt: null,
    }).session(session);
    if (!destination) throw notFound();
    if (destination.publicationStatus === 'archived')
      throw new HttpError(
        409,
        'REGION_ARCHIVED',
        'Điểm đến đã lưu trữ. Mở lại trước khi thu thập hoặc tiếp tục đợt.',
      );
    if (
      await Bulk.exists({
        destinationId: destination._id,
        action: 'archive_destination',
        state: 'running',
      }).session(session)
    )
      throw new HttpError(
        409,
        'REGION_ARCHIVING',
        'Điểm đến đang lưu trữ theo kế hoạch. Hoàn tất lô trước khi tiếp nhận nguồn.',
      );
    await Destination.updateOne(
      { _id: destination._id },
      { $inc: { catalogWriteFence: 1 } },
      { session },
    );
    return destination;
  }
  async function archiveDependencies(
    destinationId: string,
    session: ClientSession,
  ) {
    const scope = scopeKey(destinationId);
    if (
      await Run.exists({
        scope,
        active: true,
        state: { $in: ['queued', 'running', 'retry'] },
      }).session(session)
    )
      throw new HttpError(
        409,
        'ARCHIVE_DEPENDENCIES',
        'Tạm dừng hoặc hoàn tất đợt thu thập của điểm đến trước khi lưu trữ.',
      );
    if (await Schedule.exists({ scope, enabled: true }).session(session))
      throw new HttpError(
        409,
        'ARCHIVE_DEPENDENCIES',
        'Tắt lịch thu thập của điểm đến trước khi lưu trữ.',
      );
    await Destination.updateOne(
      { _id: destinationId, deletedAt: null },
      { $inc: { catalogWriteFence: 1 } },
      { session },
    );
  }
  async function transaction<T>(
    fn: (session: ClientSession) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await connection.transaction(fn);
      } catch (error) {
        if (
          error instanceof mongoose.mongo.MongoServerError &&
          error.code === 11000
        ) {
          if (attempt < 2) continue;
          throw changed();
        }
        throw error;
      }
    }
  }
  const policyDto = (
    p: NonNullable<Awaited<ReturnType<typeof Policy.findOne>>>,
  ) => ({
    id: String(p._id),
    name: p.name,
    version: p.version,
    autoApplyDraftHours: p.autoApplyDraftHours,
    autoPublish: false as const,
    createdAt: p.createdAt.toISOString(),
  });
  async function campaignDetail(actor: Types.ObjectId, id: string) {
    await catalog.requireAdmin(actor);
    const campaign = await Campaign.findById(id);
    if (!campaign) throw notFound();
    const runs = await Run.find({ campaignId: campaign._id })
      .sort({ createdAt: 1, _id: 1 })
      .limit(20);
    const count = await Run.countDocuments({ campaignId: campaign._id });
    const completed = runs.filter((p) => p.state === 'succeeded').length;
    const failed = runs.filter((p) => p.state === 'failed').length;
    const paused = runs.filter((p) => p.state === 'paused').length;
    const summary: CampaignSummary = {
      id,
      state:
        campaign.state === 'paused'
          ? 'paused'
          : completed === count
            ? 'succeeded'
            : completed + failed === count
              ? completed
                ? 'partial'
                : 'failed'
              : 'running',
      createdAt: campaign.createdAt.toISOString(),
      totalTasks: count,
      completedTasks: completed,
      failedTasks: failed,
      pausedTasks: paused,
    };
    return {
      campaign: {
        ...summary,
        source: campaign.source,
        policy: campaign.toObject().policy,
      },
      totalTasks: count,
      tasks: runs.map((r) => ({
        id: String(r._id),
        destinationId:
          r.scopeSnapshot?.destinationId ?? scopeDestination(r.scope),
        destinationName: r.scopeSnapshot?.destinationName ?? '',
        scope: r.toObject().scopeSnapshot ?? null,
        state: r.state,
        actor: r.actorId ? 'user' : 'system',
        createdAt: r.createdAt.toISOString(),
        finishedAt: r.finishedAt?.toISOString() ?? null,
        nextAttemptAt: r.nextAttemptAt.toISOString(),
        attempts: r.attempts,
        message: r.message,
        counts: r.toObject().counts ?? {},
      })),
    };
  }
  async function createCampaign(
    actor: Types.ObjectId,
    input: CampaignInput,
    key: string,
    quick?: {
      hash: string;
      area: IngestionArea;
      label: string;
      source: 'geoapify' | 'configured';
    },
  ) {
    await catalog.requireAdmin(actor);
    if (!connected)
      throw new HttpError(
        503,
        'GEOAPIFY_NOT_CONFIGURED',
        'Chưa cấu hình khóa Geoapify trên máy chủ.',
      );
    const hash = quick?.hash ?? tokenHash(JSON.stringify(input));
    const id = await transaction(async (session) => {
      await catalog.requireAdmin(actor, session);
      const old = await Campaign.findOne({
        actorId: actor,
        requestKey: key,
      }).session(session);
      if (old) {
        if (old.requestHash !== hash) throw changed();
        return String(old._id);
      }
      const policy = input.policyId
        ? await Policy.findById(input.policyId).session(session)
        : null;
      if (input.policyId && !policy) throw notFound();
      const capturedPolicy = {
        policyId: policy?._id ?? null,
        version: policy?.version ?? 0,
        autoApplyDraftHours: policy?.autoApplyDraftHours ?? false,
        autoPublish: false,
      };
      const campaign = await new Campaign({
        actorId: actor,
        requestKey: key,
        requestHash: hash,
        policy: capturedPolicy,
      }).save({ session });
      for (const destinationId of input.destinationIds) {
        const scope = scopeKey(destinationId);
        const destination = await fenceSourceDestination(
          destinationId,
          session,
        );
        if (
          quick &&
          (destination.catalogKind !== 'province' ||
            destination.publicationStatus !== 'published')
        )
          throw new HttpError(
            409,
            'PROVINCE_DISABLED',
            'Bật tỉnh/thành trước khi lấy địa điểm.',
          );
        const area =
          quick?.area ??
          (await ingestionScope(connection, destinationId, session));
        if (await Run.exists({ scope, active: true }).session(session))
          throw new HttpError(
            409,
            'SCOPE_RUN_ACTIVE',
            'Điểm đến đang có đợt chạy hoặc tạm dừng. Hoàn tất đợt đó trước.',
          );
        const run = await new Run({
          campaignId: campaign._id,
          scope,
          actorId: actor,
          group: input.group,
          scopeSnapshot: {
            ...area,
            destinationId,
            destinationName: destination.name,
            ...(quick
              ? { areaLabel: quick.label, areaSource: quick.source }
              : {}),
          },
          policySnapshot: capturedPolicy,
        }).save({ session });
        await audit.append(
          {
            action: 'catalog.run_requested',
            actorUserId: String(actor),
            entityId: String(run._id),
            operationId: run.operationId,
            requestId: requestId(),
            campaignId: String(campaign._id),
            runId: String(run._id),
          },
          session,
        );
      }
      return String(campaign._id);
    });
    return campaignDetail(actor, id);
  }
  async function startProvinceImport(
    actor: Types.ObjectId,
    input: ProvinceImportInput,
    key: string,
  ) {
    await catalog.requireAdmin(actor);
    const hash = tokenHash(JSON.stringify({ provinceImport: input }));
    const old = await Campaign.findOne({ actorId: actor, requestKey: key });
    if (old) {
      if (old.requestHash !== hash) throw changed();
      return campaignDetail(actor, String(old._id));
    }
    if (!connected || !resolveArea)
      throw new HttpError(
        503,
        'GEOAPIFY_NOT_CONFIGURED',
        'Chưa kết nối nguồn Geoapify. Tỉnh vẫn bật; cấu hình nguồn rồi nhấn Lấy địa điểm để thử lại.',
      );
    const destination = await Destination.findOne({
      _id: input.destinationId,
      deletedAt: null,
      catalogKind: 'province',
      publicationStatus: 'published',
    });
    const province = provinces.find(
      (p) => p.code === destination?.provinceCode,
    );
    if (!destination || !province)
      throw new HttpError(
        409,
        'PROVINCE_DISABLED',
        'Bật tỉnh/thành trước khi lấy địa điểm.',
      );
    if (
      input.areaName &&
      ![province.name, ...province.areas].includes(input.areaName)
    )
      throw new HttpError(
        400,
        'INVALID_AREA',
        'Chọn khu vực trong danh mục của tỉnh/thành.',
      );
    if (
      await Run.exists({ scope: scopeKey(input.destinationId), active: true })
    )
      throw new HttpError(
        409,
        'SCOPE_RUN_ACTIVE',
        'Tỉnh đang có đợt thu thập. Mở Đợt thu thập để xem tiến trình hoặc tiếp tục đợt đã tạm dừng.',
      );
    const configured = !input.areaName
      ? (
          await adminOperationsModels(connection).Settings.findOne({
            scope: 'global',
          })
        )?.regions.find(
          (r) => r.destinationId === input.destinationId && r.enabled,
        )
      : undefined;
    let area: IngestionArea;
    const label = input.areaName ?? province.name;
    if (
      configured?.latitude != null &&
      configured.longitude != null &&
      configured.radiusMeters != null
    ) {
      area = {
        latitude: configured.latitude,
        longitude: configured.longitude,
        radiusMeters: configured.radiusMeters,
      };
    } else {
      const release = await operations.reserveSearch(String(actor));
      const usage = new Usage({ group: 'geocode', requestedLimit: 5 });
      try {
        await usage.save();
        area = await resolveArea(label, province.name);
        await Usage.updateOne(
          { _id: usage._id },
          { $set: { state: 'fetched', received: 1 } },
        );
      } catch (error) {
        await Usage.updateOne(
          { _id: usage._id },
          {
            $set: {
              state: 'failed',
              errorCode:
                error instanceof HttpError ? error.code : 'AREA_LOOKUP_FAILED',
            },
          },
        );
        throw error;
      } finally {
        await release();
      }
    }
    return createCampaign(
      actor,
      { destinationIds: [input.destinationId], group: 'sights' },
      key,
      { hash, area, label, source: configured ? 'configured' : 'geoapify' },
    );
  }
  async function controlCampaign(
    actor: Types.ObjectId,
    id: string,
    action: 'pause' | 'resume' | 'retry_failed',
  ) {
    await transaction(async (session) => {
      await catalog.requireAdmin(actor, session);
      const campaign = await Campaign.findById(id).session(session);
      if (!campaign) throw notFound();
      if (action === 'pause') {
        if (campaign.state === 'paused') return;
        campaign.state = 'paused';
        await Run.updateMany(
          {
            campaignId: campaign._id,
            active: true,
            state: { $in: ['queued', 'running', 'retry'] },
          },
          {
            $set: {
              state: 'paused',
              leaseToken: null,
              leaseUntil: null,
              message: 'Người vận hành đã tạm dừng đợt.',
            },
          },
          { session },
        );
      } else {
        const wasActive = campaign.state === 'active';
        campaign.state = 'active';
        const tasks = await Run.find({
          campaignId: campaign._id,
          state: action === 'resume' ? 'paused' : 'failed',
        }).session(session);
        if (!tasks.length && wasActive) return;
        for (const task of tasks) {
          await fenceSourceDestination(scopeDestination(task.scope), session);
          if (
            await Run.exists({
              scope: task.scope,
              active: true,
              _id: { $ne: task._id },
            }).session(session)
          )
            throw new HttpError(
              409,
              'SCOPE_RUN_ACTIVE',
              'Phạm vi đang được đợt khác xử lý.',
            );
          task.state = 'queued';
          task.active = true;
          task.attempts = 0;
          task.nextAttemptAt = new Date();
          task.finishedAt = null;
          task.message = 'Đang chờ tiếp tục.';
          task.leaseToken = null;
          task.leaseUntil = null;
          await task.save({ session });
        }
      }
      await campaign.save({ session });
      await audit.append(
        {
          action:
            action === 'pause'
              ? 'catalog.campaign_paused'
              : 'catalog.campaign_resumed',
          actorUserId: String(actor),
          entityId: id,
          campaignId: id,
          operationId: randomUUID(),
          requestId: requestId(),
        },
        session,
      );
    });
    return campaignDetail(actor, id);
  }
  async function createPolicy(
    actor: Types.ObjectId,
    input: CatalogPolicyInput,
    key: string = randomUUID(),
  ) {
    const hash = tokenHash(JSON.stringify(input));
    for (let attempt = 0; ; attempt++) {
      try {
        return await transaction(async (session) => {
          await catalog.requireAdmin(actor, session);
          const old = await Policy.findOne({
            createdBy: actor,
            requestKey: key,
          }).session(session);
          if (old) {
            if (old.requestHash !== hash) throw changed();
            return policyDto(old);
          }
          const latest = await Policy.findOne()
            .sort({ version: -1 })
            .session(session);
          const saved = await new Policy({
            ...input,
            version: (latest?.version ?? 0) + 1,
            createdBy: actor,
            requestKey: key,
            requestHash: hash,
          }).save({ session });
          await audit.append(
            {
              action: 'catalog.policy_created',
              actorUserId: String(actor),
              entityId: String(saved._id),
              entityRevision: saved.version,
              operationId: randomUUID(),
              requestId: requestId(),
            },
            session,
          );
          return policyDto(saved);
        });
      } catch (error) {
        if (
          attempt < 2 &&
          error instanceof mongoose.mongo.MongoServerError &&
          error.code === 11000
        )
          continue;
        throw error;
      }
    }
  }
  async function bulkDetail(
    actor: Types.ObjectId,
    id: string,
    offset = 0,
  ): Promise<BulkJobDto> {
    await catalog.requireAdmin(actor);
    const job = await Bulk.findById(id);
    if (!job) throw notFound();
    const counts = await Item.aggregate<{ _id: string; count: number }>([
      { $match: { jobId: job._id } },
      { $group: { _id: '$state', count: { $sum: 1 } } },
    ]);
    const count = (state: string) =>
      counts.find((p) => p._id === state)?.count ?? 0;
    const rows = await Item.find({ jobId: job._id })
      .sort({ _id: 1 })
      .skip(offset)
      .limit(51);
    return {
      id,
      action: job.action,
      state: job.state,
      total: job.total,
      eligible: await Item.countDocuments({ jobId: job._id, eligible: true }),
      succeeded: count('succeeded'),
      blocked: count('blocked'),
      failed: count('failed'),
      pending: count('pending'),
      createdAt: job.createdAt.toISOString(),
      selection: job.selection as BulkPreviewInput['selection'],
      destinationId: job.destinationId ? String(job.destinationId) : null,
      destinationName: job.destinationName ?? null,
      snapshotAt: job.snapshotAt.toISOString(),
      items: rows.slice(0, 50).map((p) => ({
        id: String(p._id),
        placeId: String(p.placeId),
        name: p.name,
        expectedRevision: p.expectedRevision,
        state: p.state,
        eligible: p.eligible,
        reason: p.reason,
      })),
      hasMore: rows.length > 50,
    };
  }
  async function previewBulk(
    actor: Types.ObjectId,
    input: BulkPreviewInput,
    key: string,
  ) {
    await catalog.requireAdmin(actor);
    const hash = tokenHash(JSON.stringify(input));
    const id = await transaction(async (session) => {
      await catalog.requireAdmin(actor, session);
      const old = await Bulk.findOne({
        actorId: actor,
        requestKey: key,
      }).session(session);
      if (old) {
        if (old.requestHash !== hash) throw changed();
        return String(old._id);
      }
      const destination =
        input.action === 'archive_destination'
          ? await Destination.findOne({
              _id: input.destinationId,
              deletedAt: null,
            }).session(session)
          : null;
      if (input.action === 'archive_destination' && !destination)
        throw notFound();
      if (destination)
        await archiveDependencies(String(destination._id), session);
      const scopeId = destination
        ? String(destination._id)
        : input.selection.mode === 'filter'
          ? input.selection.filter.destinationId
          : undefined;
      const scopeName =
        destination?.name ??
        (scopeId
          ? (
              await Destination.findById(scopeId)
                .select('name')
                .session(session)
            )?.name
          : null);
      const job = await new Bulk({
        actorId: actor,
        requestKey: key,
        requestHash: hash,
        action: input.action,
        selection: input.selection,
        destinationId: scopeId ?? null,
        destinationName: scopeName ?? null,
        destinationRevision: destination?.revision ?? null,
      }).save({ session });
      const filter = destination
        ? {
            destinationId: destination._id,
            deletedAt: null,
            publicationStatus: { $ne: 'archived' as const },
          }
        : input.selection.mode === 'page'
          ? {
              _id: {
                $in: input.selection.items.map((p) => new Types.ObjectId(p.id)),
              },
              deletedAt: null,
            }
          : catalogQuery(input.selection.filter);
      const cursor = Place.find(filter)
        .sort({ _id: 1 })
        .session(session)
        .cursor({ batchSize: 100 });
      let total = 0;
      type PlaceDoc = NonNullable<Awaited<ReturnType<typeof Place.findOne>>>;
      let chunk: PlaceDoc[] = [];
      const freeze = async () => {
        const ids = chunk.map((p) => p._id);
        const reviews =
          input.action === 'publish'
            ? await Review.find({
                placeId: { $in: ids },
                kind: { $in: ['source', 'duplicate'] },
              }).session(session)
            : [];
        const blocked = new Set(
          reviews
            .filter((r) => r.state !== 'resolved')
            .map((r) => String(r.placeId)),
        );
        const kept = new Set(
          reviews
            .filter(
              (r) =>
                r.kind === 'source' &&
                r.state === 'resolved' &&
                r.decision === 'keep',
            )
            .map((r) => String(r.placeId)),
        );
        const proposals = chunk.filter((p) => p.proposalRevision != null);
        const versions =
          input.action === 'publish' && proposals.length
            ? await connection
                .collection('catalog_versions')
                .find(
                  {
                    $or: proposals.map((p) => ({
                      placeId: p._id,
                      revision: p.proposalRevision,
                    })),
                  },
                  { session },
                )
                .toArray()
            : [];
        const visible =
          input.action === 'publish'
            ? new Set(
                (
                  await Destination.find({
                    _id: { $in: chunk.map((p) => p.destinationId) },
                    deletedAt: null,
                    publicationStatus: 'published',
                  })
                    .select('_id')
                    .session(session)
                ).map((p) => String(p._id)),
              )
            : new Set<string>();
        const rows = chunk.map((place) => {
          const expectedRevision =
            input.selection.mode === 'page' && !destination
              ? input.selection.items.find((p) => p.id === String(place._id))!
                  .expectedRevision
              : place.revision;
          let reason =
            expectedRevision !== place.revision
              ? 'Đã được sửa ở nơi khác. Mở bản mới để xem lại.'
              : input.action !== 'publish' &&
                  place.publicationStatus === 'archived'
                ? 'Đã ngừng hiển thị.'
                : '';
          if (input.action === 'publish' && !reason) {
            const version = versions.find(
              (v) =>
                String(v.placeId) === String(place._id) &&
                v.revision === place.proposalRevision,
            );
            const effective = catalog.withDefaultCover(
              version
                ? Place.hydrate({
                    ...version.snapshot,
                    imageSearch: place.toObject().imageSearch,
                    fieldLocks: place.fieldLocks,
                    _id: place._id,
                    revision: place.revision,
                  })
                : place,
            );
            if (!visible.has(String(place.destinationId)))
              reason = 'Điểm đến chưa được xuất bản.';
            else if (place.proposalRevision != null && !version)
              reason = 'Bản đề xuất không còn hợp lệ.';
            else if (blocked.has(String(place._id)))
              reason = 'Cần quyết định thông tin nguồn hoặc nghi trùng trước.';
            else if (
              place.sourceSnapshot?.closed &&
              !kept.has(String(place._id))
            )
              reason = 'Cần đối chiếu dấu hiệu đóng cửa.';
            else if (
              place.publicationStatus === 'published' &&
              place.proposalRevision == null
            )
              reason = 'Đã đăng địa điểm này.';
            else if (!approvedPhoto(catalog.input(effective).images?.[0]))
              reason =
                'Chưa có ảnh bìa. Chờ hệ thống lấy ảnh hoặc bổ sung ảnh.';
            else if (
              !adminPlaceInputSchema.safeParse({
                ...catalog.input(effective),
                publicationStatus: 'published',
              }).success
            )
              reason = 'Cần đủ thông tin hợp lệ để khám phá.';
          }
          return {
            jobId: job._id,
            placeId: place._id,
            expectedRevision,
            name: place.name,
            eligible: !reason,
            state: reason ? 'blocked' : 'pending',
            reason:
              reason ||
              (input.action === 'publish'
                ? 'Sẵn sàng kiểm tra lại và xuất bản.'
                : 'Khách không còn thấy địa điểm; lịch đã lưu giữ nguyên.'),
            operationKey: randomUUID(),
          };
        });
        if (rows.length) await Item.insertMany(rows, { session });
        total += chunk.length;
        chunk = [];
      };
      for await (const place of cursor) {
        chunk.push(place);
        if (chunk.length >= 200) await freeze();
      }
      await freeze();
      if (input.selection.mode === 'page' && !destination)
        for (const selected of input.selection.items) {
          if (
            !(await Item.exists({
              jobId: job._id,
              placeId: selected.id,
            }).session(session))
          ) {
            await new Item({
              jobId: job._id,
              placeId: selected.id,
              expectedRevision: selected.expectedRevision,
              name: 'Địa điểm không còn khả dụng',
              eligible: false,
              state: 'blocked',
              reason: 'Không tìm thấy địa điểm.',
              operationKey: randomUUID(),
            }).save({ session });
            total++;
          }
        }
      job.total = total;
      job.state = 'preview';
      await job.save({ session });
      return String(job._id);
    });
    return bulkDetail(actor, id);
  }
  async function executeBulk(
    actor: Types.ObjectId,
    id: string,
    retryFailed = false,
  ) {
    await catalog.requireAdmin(actor);
    const job = await Bulk.findById(id);
    if (!job) throw notFound();
    if (job.state === 'completed') return bulkDetail(actor, id);
    try {
      if (job.state === 'preparing')
        throw new HttpError(
          409,
          'PREVIEW_PREPARING',
          'Bản xem trước chưa sẵn sàng.',
        );
      if (retryFailed)
        await Item.updateMany(
          { jobId: job._id, state: 'failed' },
          { $set: { state: 'pending' } },
        );
      if (job.action === 'archive_destination')
        await transaction(async (session) => {
          await catalog.requireAdmin(actor, session);
          if (
            !(await Destination.exists({
              _id: job.destinationId!,
              revision: job.destinationRevision!,
              deletedAt: null,
            }).session(session))
          )
            throw changed();
          await archiveDependencies(String(job.destinationId), session);
          await Bulk.updateOne(
            { _id: job._id },
            { $set: { state: 'running' } },
            { session },
          );
        });
      else
        await Bulk.updateOne({ _id: job._id }, { $set: { state: 'running' } });
      const page = await Item.find({ jobId: job._id, state: 'pending' })
        .sort({ _id: 1 })
        .limit(50);
      for (const pending of page) {
        try {
          await transaction(async (session) => {
            await catalog.requireAdmin(actor, session);
            const item = await Item.findOne({
              _id: pending._id,
              state: 'pending',
            }).session(session);
            if (!item) return;
            const result = await operations.eligibility(
              String(item.placeId),
              item.expectedRevision,
              job.action === 'publish' ? 'published' : 'archived',
              session,
            );
            if (!result.eligible) {
              item.state = 'blocked';
              item.eligible = false;
              item.reason = result.reason;
              await item.save({ session });
              return;
            }
            const saved = await catalog.publishInSession(
              actor,
              String(item.placeId),
              item.expectedRevision,
              session,
              job.action === 'publish' ? 'published' : 'archived',
            );
            await audit.append(
              {
                action: 'catalog.publication_changed',
                actorUserId: String(actor),
                entityId: String(saved._id),
                entityRevision: saved.revision,
                previousRevision: item.expectedRevision,
                batchId: String(job._id),
                requestId: requestId(),
                operationId: item.operationKey,
              },
              session,
            );
            await Review.updateMany(
              { placeId: item.placeId, kind: 'draft' },
              {
                $set: { state: 'resolved', revisitAt: null },
                $inc: { revision: 1 },
              },
              { session },
            );
            item.state = 'succeeded';
            item.reason =
              job.action === 'publish' ? 'Đã xuất bản.' : 'Đã lưu trữ.';
            await item.save({ session });
          });
        } catch (error) {
          // No item side effect escaped the transaction. A crash leaves pending;
          // an observed error is durable and may be explicitly retried.
          await Item.updateOne(
            { _id: pending._id, state: 'pending' },
            {
              $set: {
                state:
                  error instanceof HttpError && error.status === 409
                    ? 'blocked'
                    : 'failed',
                reason:
                  error instanceof HttpError
                    ? error.message
                    : 'Chưa thực hiện được. Có thể tiếp tục phần lỗi.',
              },
            },
          );
          if (error instanceof HttpError && error.status === 403) throw error;
        }
      }
      const pending = await Item.countDocuments({
        jobId: job._id,
        state: 'pending',
      });
      const errors = await Item.countDocuments({
        jobId: job._id,
        state: { $in: ['failed', 'blocked'] },
      });
      if (!pending && !errors && job.action === 'archive_destination') {
        await transaction(async (session) => {
          await catalog.requireAdmin(actor, session);
          const current = await Bulk.findById(job._id).session(session);
          if (current?.state === 'completed') return;
          await archiveDependencies(String(job.destinationId), session);
          if (
            await Place.exists({
              destinationId: job.destinationId!,
              deletedAt: null,
              publicationStatus: { $ne: 'archived' },
            }).session(session)
          )
            throw changed();
          const saved = await Destination.findOneAndUpdate(
            {
              _id: job.destinationId!,
              revision: job.destinationRevision!,
              deletedAt: null,
            },
            {
              $set: {
                publicationStatus: 'archived',
                updatedBy: actor,
                updatedByType: 'user',
              },
              $inc: { revision: 1 },
            },
            { session, returnDocument: 'after' },
          );
          if (!saved) throw changed();
          await audit.append(
            {
              action: 'catalog.destination_updated',
              actorUserId: String(actor),
              entityId: String(saved._id),
              entityRevision: saved.revision,
              previousRevision: job.destinationRevision!,
              batchId: String(job._id),
              requestId: requestId(),
              operationId: randomUUID(),
            },
            session,
          );
          await Bulk.updateOne(
            { _id: job._id },
            { $set: { state: 'completed' } },
            { session },
          );
        });
      } else
        await Bulk.updateOne(
          { _id: job._id },
          {
            $set: {
              state: pending ? 'running' : errors ? 'partial' : 'completed',
            },
          },
        );
      return bulkDetail(actor, id);
    } catch (error) {
      if (
        job.action === 'archive_destination' &&
        !(error instanceof HttpError && error.status === 403)
      )
        await Bulk.updateOne(
          { _id: job._id, state: 'running' },
          { $set: { state: 'partial' } },
        );
      throw error;
    }
  }
  return {
    models,
    campaignDetail,
    createCampaign,
    startProvinceImport,
    controlCampaign,
    previewBulk,
    executeBulk,
    bulkDetail,
    async campaigns(actor: Types.ObjectId, offset = 0) {
      await catalog.requireAdmin(actor);
      const docs = await Campaign.find()
        .sort({ createdAt: -1, _id: -1 })
        .skip(offset)
        .limit(21);
      const items = [];
      for (const p of docs.slice(0, 20))
        items.push((await campaignDetail(actor, String(p._id))).campaign);
      return {
        items,
        total: await Campaign.countDocuments(),
        hasMore: docs.length > 20,
      };
    },
    async policies(actor: Types.ObjectId) {
      await catalog.requireAdmin(actor);
      return {
        items: (await Policy.find().sort({ version: -1 }).limit(100)).map(
          policyDto,
        ),
      };
    },
    createPolicy,
    async dryRun(
      actor: Types.ObjectId,
      policyId: string,
      destinationId: string,
      offset = 0,
    ) {
      await catalog.requireAdmin(actor);
      const policy = await Policy.findById(policyId);
      if (!policy) throw notFound();
      const filter = { kind: 'source', state: { $ne: 'resolved' } };
      const pipeline = [
        { $match: filter },
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
            'place.destinationId': new Types.ObjectId(destinationId),
            'place.deletedAt': null,
          },
        },
      ];
      const [data] = await Review.aggregate<{
        rows: { _id: Types.ObjectId }[];
        count: { total: number }[];
      }>([
        ...pipeline,
        { $sort: { _id: 1 } },
        {
          $facet: {
            rows: [{ $skip: offset }, { $limit: 50 }, { $project: { _id: 1 } }],
            count: [{ $count: 'total' }],
          },
        },
      ]);
      const rows = await Review.find({
        _id: { $in: data?.rows.map((p) => p._id) ?? [] },
      });
      const items = [];
      for (const review of rows) {
        const place = await Place.findById(review.placeId);
        if (!place || !review.incoming) continue;
        const effective = await catalog.proposal(place);
        const duplicate = await Review.exists({
          placeId: place._id,
          kind: { $in: ['source', 'duplicate'] },
          state: { $ne: 'resolved' },
        });
        const result = evaluateDraftHours({
          enabled: policy.autoApplyDraftHours,
          publicationStatus: place.publicationStatus,
          locks: place.fieldLocks,
          currentHours: effective.openingHoursNote,
          previous: review.previous
            ? sourceSnapshotSchema.parse(review.toObject().previous)
            : null,
          incoming: sourceSnapshotSchema.parse(review.toObject().incoming),
          hasConflict: Boolean(duplicate),
        });
        items.push({
          placeId: String(place._id),
          name: place.name,
          expectedRevision: place.revision,
          ...result,
        });
      }
      return {
        policy: policyDto(policy),
        dryRun: true,
        items,
        total: data?.count[0]?.total ?? 0,
        hasMore: (data?.count[0]?.total ?? 0) > offset + 50,
      };
    },
    async map(actor: Types.ObjectId, query: AdminMapQuery) {
      await catalog.requireAdmin(actor);
      const filter = catalogQuery(
        adminPlaceQuerySchema.parse(
          Object.fromEntries(
            Object.entries(query).filter(
              ([k]) => !['west', 'east', 'south', 'north', 'zoom'].includes(k),
            ),
          ),
        ),
      );
      const cell = Math.max(
        360 / 2 ** (query.zoom + 5),
        (query.east - query.west) / 32,
        (query.north - query.south) / 32,
      );
      const bounds = {
        'mapLocation.latitude': { $gte: query.south, $lte: query.north },
        'mapLocation.longitude': { $gte: query.west, $lte: query.east },
      };
      const [total, missingCoordinates, clusters] = await Promise.all([
        Place.countDocuments(filter),
        Place.countDocuments({
          $and: [
            filter,
            {
              $or: [
                { mapLocation: null },
                { 'mapLocation.latitude': null },
                { 'mapLocation.longitude': null },
              ],
            },
          ],
        }),
        Place.aggregate<{
          _id: { x: number; y: number };
          count: number;
          latitude: number;
          longitude: number;
          placeId: Types.ObjectId;
          name: string;
        }>([
          { $match: { $and: [filter, bounds] } },
          {
            $group: {
              _id: {
                x: { $floor: { $divide: ['$mapLocation.longitude', cell] } },
                y: { $floor: { $divide: ['$mapLocation.latitude', cell] } },
              },
              count: { $sum: 1 },
              latitude: { $avg: '$mapLocation.latitude' },
              longitude: { $avg: '$mapLocation.longitude' },
              placeId: { $first: '$_id' },
              name: { $first: '$name' },
            },
          },
          { $sort: { '_id.x': 1, '_id.y': 1 } },
        ]),
      ]);
      return {
        total,
        missingCoordinates,
        inViewport: clusters.reduce((n, p) => n + p.count, 0),
        clusters: clusters.map((p) => ({
          id: `${p._id.x}:${p._id.y}`,
          count: p.count,
          latitude: p.latitude,
          longitude: p.longitude,
          ...(p.count === 1
            ? { placeId: String(p.placeId), name: p.name }
            : {}),
        })),
      };
    },
    async sources(actor: Types.ObjectId) {
      await catalog.requireAdmin(actor);
      const latest = await Usage.findOne().sort({ createdAt: -1 });
      const fetched = await Usage.findOne({ state: 'fetched' }).sort({
        updatedAt: -1,
      });
      const [usage] = await Usage.aggregate<{
        requests: number;
        fetched: number;
        failed: number;
        received: number;
      }>([
        { $match: { createdAt: { $gte: new Date(Date.now() - 86400000) } } },
        {
          $group: {
            _id: null,
            requests: { $sum: '$internalRequests' },
            fetched: {
              $sum: { $cond: [{ $eq: ['$state', 'fetched'] }, 1, 0] },
            },
            failed: { $sum: { $cond: [{ $eq: ['$state', 'failed'] }, 1, 0] } },
            received: { $sum: '$received' },
          },
        },
      ]);
      return {
        provider: 'geoapify',
        configured: connected,
        checkedAt: latest?.updatedAt.toISOString() ?? null,
        lastFetchAt: fetched?.updatedAt.toISOString() ?? null,
        connectionState: !connected
          ? 'not_configured'
          : !latest
            ? 'not_checked'
            : latest.state === 'fetched'
              ? 'fetched'
              : latest.errorCode === 'GEOAPIFY_AUTH'
                ? 'permission_denied'
                : latest.state === 'requested'
                  ? 'checking'
                  : 'failed',
        lastErrorCode: latest?.errorCode ?? null,
        usage24h: usage ?? { requests: 0, fetched: 0, failed: 0, received: 0 },
        providerCredits: null,
        providerBalance: null,
        maxResultsPerRun: 50,
        quota: {
          requestsPerHour: 20,
          requestsPerActorHour: 10,
          concurrentSearches: 2,
          meaning: 'internal_search_reservations',
        },
        rights: {
          facts: 'OpenStreetMap / ODbL-1.0, attribution required',
          photos: 'not_provided_or_licensed_by_this_connector',
          rawPayloadStored: false,
        },
      };
    },
  };
}
