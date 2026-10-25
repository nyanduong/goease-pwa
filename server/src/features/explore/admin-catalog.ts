import {
  needsPlaceDescription,
  importedDescriptionPlaceholder,
} from '@goease/contracts';
import { descriptionContext, descriptionQuery } from './place-descriptions.js';
import { catalogPhotoCover } from '@goease/contracts';
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
  mapLocationSchema,
  catalogImageSchema,
  sourceSnapshotSchema,
  catalogCapabilities,
  fieldProvenanceSchema,
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
import { catalogQuery } from './catalog-query.js';
import { publicationReadiness } from './catalog-publication-readiness.js';
import { adminOperationsModels } from './admin-operations.models.js';
import {
  catalogProvenance,
  preserveCatalogLocks,
} from './catalog-provenance.js';

export function adminCatalog(
  connection: Connection,
  explore: ReturnType<typeof exploreService>,
  trips: ReturnType<typeof tripService>,
  audit: ReturnType<typeof businessAudit>,
  User: ReturnType<typeof authModels>['User'],
) {
  const { Place } = explore.models;
  const { Destination, Key } = trips.models;
  const { Version } = adminOperationsModels(connection);
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
    photoSearch: {
      state: doc.imageSearch?.state ?? 'pending',
      count: doc.imageSearch?.candidates.length ?? 0,
    },
    imageUrl: catalogPhotoCover(doc.toObject().images)?.url ?? '',
    imageCredit:
      catalogPhotoCover(doc.toObject().images)?.credit ??
      'Chưa có ảnh thật được duyệt',
    internalNote: doc.internalNote ?? '',
    images: doc.images.map((i) => catalogImageSchema.parse(i.toObject())),
    mapLocation:
      mapLocationSchema.safeParse(doc.toObject().mapLocation).data ?? null,
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
    proposalRevision: doc.proposalRevision ?? null,
    publicRevision:
      doc.publicRevision ??
      (doc.publicationStatus === 'published' ? doc.revision : null),
    fieldLocks: (doc.fieldLocks ?? []) as AdminPlaceInput['fieldLocks'],
    fieldProvenance: (doc.toObject().fieldProvenance ?? []).map((p) =>
      fieldProvenanceSchema.parse(p),
    ),
    capabilities: catalogCapabilities({
      images: doc.images.map((i) => catalogImageSchema.parse(i.toObject())),
      name: doc.name,
      description: doc.description,
      locationQuery: doc.planning?.locationQuery ?? '',
      sourceUrl: doc.sourceUrl,
      durationMinutes: doc.planning?.durationMinutes ?? 0,
      openingHoursNote: doc.openingHoursNote ?? '',
      referencePrice: doc.referencePrice
        ? referencePriceSchema.parse(doc.toObject().referencePrice)
        : null,
      venueType: (doc.venueType as AdminPlaceInput['venueType']) ?? 'place',
    }),
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
  function input(doc: Doc): AdminPlaceInput {
    const value = dto(doc);
    return Object.fromEntries(
      Object.keys(adminPlaceInputSchema.shape).map((key) => [
        key,
        value[key as keyof AdminPlaceInput],
      ]),
    ) as AdminPlaceInput;
  }
  function withSourceDefaults(doc: Doc): Doc {
    if (doc.publicationStatus !== 'draft') return doc;
    const value = doc.toObject();
    let defaultImages;
    if (
      !doc.images.length &&
      !doc.fieldLocks?.includes('images') &&
      value.imageSearch?.defaultCover
    )
      defaultImages = [value.imageSearch.defaultCover];
    if (
      value.images.length &&
      !doc.fieldLocks?.includes('images') &&
      value.imageSearch?.storageVersion === 2 &&
      value.imageSearch.state === 'ready'
    ) {
      defaultImages = value.images.map((image) => {
        const original = value.imageSearch!.candidates.find(
          (candidate) => candidate.image?.sourceUrl === image.sourceUrl,
        )?.image;
        return original ? { ...image, url: original.url } : image;
      });
    }
    if (needsPlaceDescription(doc.description)) {
      if (
        doc.description.trim() === importedDescriptionPlaceholder &&
        !value.internalNote
      )
        value.internalNote =
          'Nhập từ Geoapify / OpenStreetMap; cần kiểm tra trước khi xuất bản.';
      const source = value.descriptionSearch;
      value.description =
        !doc.fieldLocks?.includes('description') &&
        source?.context === descriptionContext(descriptionQuery(doc))
          ? (source.result?.text ?? '')
          : '';
      value.subtitle = value.description.slice(0, 150);
      if (value.description && source?.result)
        value.descriptionSource = source.result;
    }
    return Place.hydrate({
      ...value,
      ...(defaultImages ? { images: defaultImages } : {}),
    });
  }
  async function proposal(
    doc: Doc,
    session?: ClientSession,
    applyDefaults = true,
  ): Promise<Doc> {
    if (doc.proposalRevision == null)
      return applyDefaults ? withSourceDefaults(doc) : doc;
    const version = await Version.findOne({
      placeId: doc._id,
      revision: doc.proposalRevision,
      state: 'proposal',
    }).session(session ?? null);
    if (!version)
      throw new HttpError(
        409,
        'CATALOG_PROPOSAL_MISSING',
        'Bản đề xuất không còn hợp lệ. Tải lại để đối chiếu.',
      );
    const projected = Place.hydrate({
      ...version.snapshot,
      _id: doc._id,
      revision: doc.revision,
      publicRevision: doc.publicRevision,
      proposalRevision: doc.proposalRevision,
      updatedAt: doc.updatedAt,
      fieldLocks: doc.fieldLocks,
      source: doc.toObject().source,
      sourceSnapshot: doc.toObject().sourceSnapshot,
      sourceCheckedAt: doc.sourceCheckedAt,
      imageSearch: doc.toObject().imageSearch,
      descriptionSearch: doc.toObject().descriptionSearch,
      deletedAt: doc.deletedAt,
    });
    return applyDefaults ? withSourceDefaults(projected) : projected;
  }
  async function stageInSession(
    current: Doc,
    fields: Record<string, unknown>,
    session: ClientSession,
    options: {
      origin?: 'manual' | 'geoapify';
      actorId?: string | null;
      reason?: 'save' | 'restore' | 'source';
      restoredFromRevision?: number;
      ruleRevision?: number;
      runId?: Types.ObjectId;
      receivedAt?: string | null;
    } = {},
  ) {
    const effective = await proposal(current, session);
    const before = effective.toObject() as Record<string, unknown>;
    const merged = { ...before, ...fields };
    const snapshot =
      options.reason === 'restore' || options.origin === 'geoapify'
        ? preserveCatalogLocks(before, merged)
        : merged;
    snapshot.fieldLocks =
      options.reason === 'restore' || options.origin === 'geoapify'
        ? (before.fieldLocks ?? [])
        : (fields.fieldLocks ?? before.fieldLocks ?? []);
    snapshot.subtitle = String(snapshot.description ?? '').slice(0, 150);
    snapshot.searchText = normalizeSearch(
      `${snapshot.name ?? ''} ${snapshot.description ?? ''} ${(snapshot.planning as { locationQuery?: string } | undefined)?.locationQuery ?? ''}`,
    ).slice(0, 2500);
    snapshot.fieldProvenance = catalogProvenance(
      before,
      snapshot,
      options.origin ?? 'manual',
      options.actorId ?? null,
      options.receivedAt ?? null,
    );
    const revision = current.revision + 1;
    snapshot.revision = revision;
    delete snapshot.imageSearch;
    delete snapshot.descriptionSearch;
    await Version.create(
      [
        {
          placeId: current._id,
          revision,
          snapshot,
          state: 'proposal',
          basePublicRevision:
            current.publicRevision ??
            (current.publicationStatus === 'published'
              ? current.revision
              : null),
          actorId: options.actorId ?? null,
          reason: options.reason ?? 'save',
          restoredFromRevision: options.restoredFromRevision ?? null,
          ruleRevision: options.ruleRevision ?? null,
          runId: options.runId ?? null,
        },
      ],
      { session },
    );
    const saved = await Place.findOneAndUpdate(
      { _id: current._id, revision: current.revision },
      {
        $set: {
          proposalRevision: revision,
          fieldLocks: snapshot.fieldLocks,
          publicRevision:
            current.publicRevision ??
            (current.publicationStatus === 'published'
              ? current.revision
              : null),
          ...(options.actorId
            ? { updatedBy: options.actorId, updatedByType: 'user' }
            : {}),
        },
        $inc: { revision: 1 },
      },
      { session, returnDocument: 'after', runValidators: true },
    );
    if (!saved)
      throw new HttpError(
        409,
        'CATALOG_CONFLICT',
        'Có thay đổi đồng thời. Hãy tải lại để đối chiếu.',
      );
    return saved;
  }
  async function publishInSession(
    actor: Types.ObjectId,
    id: string,
    expectedRevision: number,
    session: ClientSession,
    status: 'published' | 'archived' = 'published',
  ) {
    await requireAdmin(actor, session);
    checkId(id);
    const current = await Place.findOne({ _id: id, deletedAt: null }).session(
      session,
    );
    if (!current)
      throw new HttpError(404, 'PLACE_NOT_FOUND', 'Không tìm thấy địa điểm.');
    if (current.revision !== expectedRevision)
      throw new HttpError(
        409,
        'CATALOG_CONFLICT',
        'Bản xem trước đã cũ. Tải lại trước khi áp dụng.',
      );
    const effective = await proposal(current, session);
    if (current.proposalRevision != null) {
      const version = await Version.findOne({
        placeId: current._id,
        revision: current.proposalRevision,
      }).session(session);
      const publicRevision =
        current.publicRevision ??
        (current.publicationStatus === 'published' ? current.revision : null);
      if (version?.basePublicRevision !== publicRevision)
        throw new HttpError(
          409,
          'CATALOG_CONFLICT',
          'Bản công khai đã đổi sau khi chuẩn bị đề xuất. Tải lại để đối chiếu.',
        );
    }
    const checked = adminPlaceInputSchema.safeParse({
      ...input(effective),
      publicationStatus: status,
    });
    if (!checked.success)
      throw new HttpError(
        400,
        'INVALID_INPUT',
        checked.error.issues[0]?.message ?? 'Chưa đủ thông tin khám phá.',
      );
    if (status === 'published') {
      if (
        !(await Destination.exists({
          _id: current.destinationId,
          catalogKind: { $ne: 'legacy' },
          publicationStatus: 'published',
          deletedAt: null,
        }).session(session))
      )
        throw new HttpError(
          409,
          'INVALID_DESTINATION',
          'Điểm đến chưa được xuất bản.',
        );
      if (
        await connection.collection('catalog_bulk_jobs').findOne(
          {
            destinationId: current.destinationId,
            action: 'archive_destination',
            state: 'running',
          },
          { session },
        )
      )
        throw new HttpError(
          409,
          'REGION_ARCHIVING',
          'Điểm đến đang được lưu trữ theo kế hoạch. Hoàn tất lô trước khi xuất bản.',
        );
      // Serialize public publication with scope archive finalization. A read-only
      // destination gate would allow both transactions to commit on disjoint docs.
      const destinationFence = await Destination.updateOne(
        {
          _id: current.destinationId,
          catalogKind: { $ne: 'legacy' },
          publicationStatus: 'published',
          deletedAt: null,
        },
        { $inc: { catalogWriteFence: 1 } },
        { session },
      );
      if (destinationFence.modifiedCount !== 1)
        throw new HttpError(
          409,
          'CATALOG_CONFLICT',
          'Phạm vi đã thay đổi. Tải lại trước khi xuất bản.',
        );
      if (
        await connection.collection('catalog_reviews').findOne(
          {
            placeId: current._id,
            kind: { $in: ['source', 'duplicate'] },
            state: { $ne: 'resolved' },
          },
          { session },
        )
      )
        throw new HttpError(
          409,
          'CATALOG_REVIEW_REQUIRED',
          'Cần xử lý thông tin nguồn hoặc nghi trùng trước khi đăng.',
        );
      if (
        current.sourceSnapshot?.closed &&
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
          'Cần đối chiếu dấu hiệu đóng cửa trước khi đăng.',
        );
    }
    await audit.capturePlace(id, session);
    const snapshot = effective.toObject() as Record<string, unknown>;
    const fields = Object.fromEntries(
      Object.entries(snapshot).filter(
        ([key]) =>
          ![
            '_id',
            'revision',
            'createdAt',
            'updatedAt',
            'createdBy',
            'createdByType',
            'publicRevision',
            'proposalRevision',
            // Observations and source identity can advance while content awaits approval.
            // Publishing a content version must never rewind that operational evidence.
            'source',
            'sourceSnapshot',
            'sourceCheckedAt',
            'imageSearch',
            'descriptionSearch',
            'destinationId',
            'destinationName',
            'deletedAt',
          ].includes(key),
      ),
    );
    const saved = await Place.findOneAndUpdate(
      { _id: id, revision: expectedRevision },
      {
        $set: {
          ...fields,
          publicationStatus: status,
          proposalRevision: null,
          publicRevision: expectedRevision + 1,
          updatedBy: actor,
          updatedByType: 'user',
        },
        $inc: { revision: 1 },
      },
      { session, returnDocument: 'after', runValidators: true },
    );
    if (!saved)
      throw new HttpError(
        409,
        'CATALOG_CONFLICT',
        'Có thay đổi đồng thời. Hãy tải lại.',
      );
    await Version.create(
      [
        {
          placeId: saved._id,
          revision: saved.revision,
          snapshot: saved.toObject(),
          state: 'published',
          reason: 'publish',
          basePublicRevision: current.publicRevision ?? null,
          actorId: actor,
        },
      ],
      { session },
    );
    return saved;
  }
  return {
    dto,
    input,
    proposal,
    withSourceDefaults,
    stageInSession,
    publishInSession,
    requireAdmin,
    async list(
      actor: Types.ObjectId,
      query: z.infer<typeof adminPlaceQuerySchema>,
    ) {
      await requireAdmin(actor);
      const filter = catalogQuery(query);
      const docs = await Place.find(filter)
        .sort(
          query.sort === 'name'
            ? { name: 1, _id: 1 }
            : query.sort === 'oldest'
              ? { updatedAt: 1, _id: 1 }
              : { updatedAt: -1, _id: -1 },
        )
        .skip(query.offset)
        .limit(21);
      const page = docs.slice(0, 20);
      const ids = page.map((p) => p._id);
      const destinationIds = page.map((p) => p.destinationId);
      const [destinations, reviews, archiving, versions] = await Promise.all([
        Destination.find({
          _id: { $in: destinationIds },
          deletedAt: null,
          publicationStatus: 'published',
          catalogKind: { $ne: 'legacy' },
        }).select('_id'),
        connection
          .collection('catalog_reviews')
          .find({
            placeId: { $in: ids },
            kind: { $in: ['source', 'duplicate'] },
            $or: [
              { state: { $ne: 'resolved' } },
              { state: 'resolved', decision: 'keep' },
            ],
          })
          .project({ placeId: 1, kind: 1, state: 1, decision: 1 })
          .toArray(),
        connection
          .collection('catalog_bulk_jobs')
          .find({
            destinationId: { $in: destinationIds },
            action: 'archive_destination',
            state: 'running',
          })
          .project({ destinationId: 1 })
          .toArray(),
        Version.find({ placeId: { $in: ids }, state: 'proposal' }).select(
          'placeId revision basePublicRevision',
        ),
      ]);
      return {
        items: await Promise.all(
          page.map(async (p) => {
            const effective = await proposal(p);
            const related = reviews.filter(
              (r) => String(r.placeId) === String(p._id),
            );
            const blocked = related.find((r) => r.state !== 'resolved');
            const version = versions.find(
              (v) =>
                String(v.placeId) === String(p._id) &&
                v.revision === p.proposalRevision,
            );
            return {
              ...dto(effective),
              publicationReadiness: publicationReadiness(input(effective), {
                destinationVisible: destinations.some(
                  (d) => String(d._id) === String(p.destinationId),
                ),
                archiving: archiving.some(
                  (d) => String(d.destinationId) === String(p.destinationId),
                ),
                blockingKind: blocked
                  ? (blocked.kind as 'source' | 'duplicate')
                  : null,
                closedUnconfirmed:
                  !!p.sourceSnapshot?.closed &&
                  !related.some(
                    (r) =>
                      r.kind === 'source' &&
                      r.state === 'resolved' &&
                      r.decision === 'keep',
                  ),
                staleProposal:
                  p.proposalRevision != null &&
                  (!version ||
                    version.basePublicRevision !==
                      (p.publicRevision ??
                        (p.publicationStatus === 'published'
                          ? p.revision
                          : null))),
                alreadyPublished:
                  p.publicationStatus === 'published' &&
                  p.proposalRevision == null,
              }),
            };
          }),
        ),
        hasMore: docs.length > 20,
        total: await Place.countDocuments(filter),
      };
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
      return {
        place: dto(await proposal(doc)),
        publicPlace: doc.publicationStatus === 'published' ? dto(doc) : null,
        history,
        sourceEvidence: doc.sourceSnapshot
          ? {
              snapshot: sourceSnapshotSchema.parse(
                doc.toObject().sourceSnapshot,
              ),
              fetchedAt:
                doc.sourceCheckedAt?.toISOString() ??
                doc.source?.fetchedAt.toISOString() ??
                null,
            }
          : null,
      };
    },
    async write(
      actor: Types.ObjectId,
      input: AdminPlaceInput,
      key: string,
      id?: string,
      expectedRevision?: number,
      restoredFromRevision?: number,
      intent: 'save' | 'publish' = 'save',
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
      input = parsed.data;
      if (
        input.referencePrice &&
        input.referencePrice.checkedAt > catalogToday()
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
      const operation =
        restoredFromRevision !== undefined
          ? 'catalog.restore'
          : intent === 'publish'
            ? 'catalog.publish'
            : id
              ? 'catalog.update'
              : 'catalog.create';
      const requestHash = tokenHash(
        JSON.stringify({
          id,
          input,
          expectedRevision,
          restoredFromRevision,
          intent,
        }),
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
              const saved = await Place.findOne({
                _id: receipt.resourceId,
                deletedAt: null,
              }).session(session);
              if (!saved)
                throw new HttpError(
                  404,
                  'PLACE_NOT_FOUND',
                  'Không tìm thấy địa điểm.',
                );
              return {
                place:
                  receipt.catalogPlaceResponse ??
                  dto(await proposal(saved, session)),
              };
            }
            const destination = await Destination.findOne({
              _id: input.destinationId,
              catalogKind: { $ne: 'legacy' },
              deletedAt: null,
            }).session(session);
            if (!destination)
              throw new HttpError(
                400,
                'INVALID_DESTINATION',
                'Chọn điểm đến trong phạm vi quản trị.',
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
              String(current.destinationId) !== input.destinationId
            )
              throw new HttpError(
                400,
                'PLACE_DESTINATION_FIXED',
                'Địa điểm đã tạo giữ nguyên điểm đến để bảo vệ các lịch đang dùng. Hãy tạo mục mới cho điểm đến khác.',
              );
            const editable = current ? await proposal(current, session) : null;
            const fields = {
              ...(input.images !== undefined
                ? {
                    images: input.images,
                    ...(input.images[0]
                      ? {
                          imageUrl: input.images[0].url,
                          imageCredit: input.images[0].credit,
                        }
                      : editable?.images.length
                        ? {
                            imageUrl: '',
                            imageCredit: 'Chưa có ảnh thật được duyệt',
                          }
                        : {}),
                  }
                : {}),
              ...(input.internalNote !== undefined
                ? { internalNote: input.internalNote }
                : {}),
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
              ...(editable &&
              editable.planning?.locationQuery !== input.locationQuery
                ? { mapLocation: null }
                : {}),
              ...(input.mapLocation !== undefined
                ? {
                    mapLocation:
                      editable &&
                      editable.planning?.locationQuery !==
                        input.locationQuery &&
                      editable.mapLocation?.latitude ===
                        input.mapLocation?.latitude &&
                      editable.mapLocation?.longitude ===
                        input.mapLocation?.longitude
                        ? null
                        : input.mapLocation,
                  }
                : {}),
              referencePrice: input.referencePrice,
              publicationStatus: input.publicationStatus,
              fieldLocks: input.fieldLocks ?? editable?.fieldLocks ?? [],
              durationLabel: `${input.durationMinutes} phút`,
              tip: 'Thời lượng là ước tính GoEase. Kiểm tra giờ mở cửa và giá với cơ sở trước khi đi.',
              planning: {
                durationMinutes: input.durationMinutes,
                locationQuery: input.locationQuery,
                costNote: input.referencePrice
                  ? input.referencePrice.conditions
                  : 'Chưa có giá tham khảo để tự tính.',
                priceOptions: editable?.toObject().planning?.priceOptions ?? [],
              },
              updatedBy: actor,
              updatedByType: 'user',
            };
            if (current) await audit.capturePlace(String(current._id), session);
            let saved = current
              ? await stageInSession(current, fields, session, {
                  actorId: String(actor),
                  reason:
                    restoredFromRevision === undefined ? 'save' : 'restore',
                  ...(restoredFromRevision !== undefined
                    ? { restoredFromRevision }
                    : {}),
                })
              : await new Place({
                  ...fields,
                  publicationStatus: 'draft',
                  proposalRevision: 1,
                  fieldProvenance: catalogProvenance(
                    null,
                    fields,
                    'manual',
                    String(actor),
                  ),
                  revision: 1,
                  createdBy: actor,
                  createdByType: 'user',
                  imageUrl: input.images?.[0]?.url ?? '',
                  imageCredit:
                    input.images?.[0]?.credit ?? 'Chưa có ảnh thật được duyệt',
                  travelLabel: 'Kiểm tra đường đi',
                  bestTimeLabel: 'Kiểm tra giờ mở cửa',
                  tip: 'Thông tin tham khảo; liên hệ cơ sở để xác nhận.',
                  highlights: [],
                }).save({ session });
            if (!current)
              await Version.create(
                [
                  {
                    placeId: saved._id,
                    revision: 1,
                    state: 'proposal',
                    reason: 'save',
                    actorId: actor,
                    snapshot: {
                      ...saved.toObject(),
                      publicationStatus: input.publicationStatus,
                    },
                  },
                ],
                { session },
              );
            if (intent === 'publish')
              saved = await publishInSession(
                actor,
                String(saved._id),
                saved.revision,
                session,
                input.publicationStatus === 'archived'
                  ? 'archived'
                  : 'published',
              );
            if (!saved)
              throw new HttpError(
                409,
                'CATALOG_CONFLICT',
                'Có thay đổi đồng thời. Hãy tải lại để đối chiếu.',
              );
            await audit.append(
              {
                action:
                  intent === 'publish'
                    ? 'catalog.published'
                    : restoredFromRevision !== undefined
                      ? 'catalog.restore_prepared'
                      : 'catalog.proposal_saved',
                actorUserId: String(actor),
                entityId: String(saved._id),
                entityRevision: saved.revision,
                ...(current
                  ? {
                      previousRevision:
                        intent === 'publish'
                          ? (current.publicRevision ?? current.revision)
                          : current.revision,
                    }
                  : {}),
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
              catalogPlaceResponse: dto(await proposal(saved, session)),
              responseStatus: id ? 200 : 201,
              expiresAt: new Date(Date.now() + 86400000),
            }).save({ session });
            return { place: dto(await proposal(saved, session)) };
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
