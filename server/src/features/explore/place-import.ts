import mongoose, { Types, type Connection } from 'mongoose';
import { randomUUID } from 'node:crypto';
import type {
  PlaceImportSearch,
  PlaceImportCommit,
  PlaceImportPreview,
  PlaceImportCandidate,
  PlaceImportResult,
} from '@goease/contracts';
import type { adminCatalog } from './admin-catalog.js';
import type { exploreService } from './explore.service.js';
import { normalizeSearch } from './explore.service.js';
import type { tripService } from '../trips/trip.service.js';
import type { businessAudit } from '../audit/business-audit.js';
import { tokenHash } from '../auth/security.js';
import { requestId } from '../auth/auth.service.js';
import { HttpError } from '../../http-error.js';
import {
  distanceMeters,
  type geoapifyProvider,
  type GeoapifyGroup,
} from './geoapify.js';

const nameKey = (s: string) =>
  normalizeSearch(s)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
const destinationId = '000000000000000000000004';
const ttl = 15 * 60_000;
export function placeImportService(
  connection: Connection,
  catalog: ReturnType<typeof adminCatalog>,
  explore: ReturnType<typeof exploreService>,
  trips: ReturnType<typeof tripService>,
  audit: ReturnType<typeof businessAudit>,
  get: ReturnType<typeof geoapifyProvider>,
) {
  const { Place } = explore.models;
  const { Key, Destination } = trips.models;
  const previews = new Map<
    string,
    { actor: string; value: PlaceImportPreview }
  >();
  let windowStart = Date.now();
  let searches = 0;
  const actorSearches = new Map<string, number>();
  let inFlight = 0;
  const expired = () =>
    new HttpError(
      409,
      'IMPORT_PREVIEW_EXPIRED',
      'Bản xem trước đã hết hạn hoặc server vừa khởi động lại. Tìm lại địa điểm trước khi nhập.',
    );
  async function requireDestination(session?: mongoose.ClientSession) {
    const destination = await Destination.findOne({
      _id: destinationId,
      slug: 'hoi-an',
      publicationStatus: 'published',
      deletedAt: null,
    }).session(session ?? null);
    if (!destination)
      throw new HttpError(
        400,
        'INVALID_DESTINATION',
        'Danh mục Hội An chưa sẵn sàng.',
      );
    return destination;
  }
  async function markDuplicates(
    items: PlaceImportCandidate[],
    session?: mongoose.ClientSession,
  ) {
    const stored = await Place.find({
      $or: [
        { destinationId },
        {
          'source.provider': 'geoapify',
          'source.externalId': { $in: items.map((p) => p.externalId) },
        },
      ],
    })
      .select('_id name source.externalId mapLocation')
      .session(session ?? null)
      .limit(5001);
    if (stored.length > 5000)
      throw new HttpError(
        409,
        'IMPORT_CATALOG_LIMIT',
        'Danh mục đã vượt giới hạn đối chiếu của bản thử. Hãy kiểm tra trước khi nhập tiếp.',
      );
    return items.map((p) => {
      const exact = stored.find((s) => s.source?.externalId === p.externalId);
      const possibleDuplicates = [
        ...p.possibleDuplicates,
        ...stored
          .filter(
            (s) =>
              !exact &&
              (nameKey(s.name) === nameKey(p.name) ||
                (s.mapLocation &&
                  distanceMeters(
                    p.longitude,
                    p.latitude,
                    s.mapLocation.longitude,
                    s.mapLocation.latitude,
                  ) < 15)),
          )
          .map((s) => s.name),
        ...items
          .filter(
            (other) =>
              other.externalId !== p.externalId &&
              nameKey(other.name) === nameKey(p.name) &&
              distanceMeters(
                p.longitude,
                p.latitude,
                other.longitude,
                other.latitude,
              ) < 150,
          )
          .map((s) => s.name),
      ];
      return {
        ...p,
        ...(exact ? { existingPlaceId: String(exact._id) } : {}),
        possibleDuplicates: [...new Set(possibleDuplicates)].slice(0, 20),
      };
    });
  }
  return {
    async preview(
      actor: Types.ObjectId,
      input: PlaceImportSearch,
    ): Promise<PlaceImportPreview> {
      await catalog.requireAdmin(actor);
      await requireDestination();
      const now = Date.now();
      for (const [id, entry] of previews)
        if (Date.parse(entry.value.expiresAt) <= now) previews.delete(id);
      if (now - windowStart >= 3600000) {
        windowStart = now;
        searches = 0;
        actorSearches.clear();
      }
      const actorId = String(actor);
      if (
        searches >= 20 ||
        (actorSearches.get(actorId) ?? 0) >= 10 ||
        inFlight >= 2
      )
        throw new HttpError(
          429,
          'IMPORT_SEARCH_LIMIT',
          'Đã đạt giới hạn tìm địa điểm của bản thử. Chờ lượt đang chạy hoặc thử lại sau.',
        );
      // Reserve before the external call. Failed/uncertain requests remain counted.
      searches++;
      actorSearches.set(actorId, (actorSearches.get(actorId) ?? 0) + 1);
      inFlight++;
      try {
        const queries: { group: GeoapifyGroup; limit: number }[] =
          input.group === 'mixed'
            ? [
                { group: 'sights', limit: input.limit === 50 ? 20 : 10 },
                { group: 'restaurant', limit: input.limit === 50 ? 15 : 10 },
                { group: 'cafe', limit: input.limit === 50 ? 15 : 10 },
              ]
            : [{ group: input.group, limit: input.limit }];
        const batches = [];
        for (const q of queries) batches.push(await get(q.group, q.limit));
        await catalog.requireAdmin(actor);
        const candidates = batches.flatMap((b) => b.items);
        const unique = [
          ...new Map(candidates.map((p) => [p.externalId, p])).values(),
        ];
        const value: PlaceImportPreview = {
          previewId: randomUUID(),
          fetchedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + ttl).toISOString(),
          received: batches.reduce((n, b) => n + b.received, 0),
          rejected: batches.reduce((n, b) => n + b.rejected, 0),
          duplicateExternalIds: candidates.length - unique.length,
          items: await markDuplicates(
            unique.map((p) => ({ ...p, possibleDuplicates: [] })),
          ),
        };
        for (const [id, entry] of previews)
          if (entry.actor === actorId) previews.delete(id);
        while (previews.size >= 10)
          previews.delete(previews.keys().next().value!);
        previews.set(value.previewId, { actor: actorId, value });
        return value;
      } finally {
        inFlight--;
      }
    },
    async commit(
      actor: Types.ObjectId,
      input: PlaceImportCommit,
      key: string,
    ): Promise<PlaceImportResult> {
      await catalog.requireAdmin(actor);
      const ids = [...input.externalIds].sort();
      const requestHash = tokenHash(
        JSON.stringify({ ...input, externalIds: ids }),
      );
      const operation = 'catalog.import';
      const reqId = requestId();
      const batchId = randomUUID();
      const planned = new Map(
        ids.map((id) => [
          id,
          { id: new Types.ObjectId(), operationId: randomUUID() },
        ]),
      );
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
              if (receipt.requestHash !== requestHash)
                throw new HttpError(
                  409,
                  'IDEMPOTENCY_CONFLICT',
                  'Lựa chọn đã thay đổi. Dùng thao tác nhập mới.',
                );
              const placeIds = receipt.resultIds ?? [];
              return {
                placeIds,
                created: placeIds.length,
                existing: ids.length - placeIds.length,
              };
            }
            const preview = previews.get(input.previewId);
            if (
              !preview ||
              preview.actor !== String(actor) ||
              Date.parse(preview.value.expiresAt) <= Date.now()
            )
              throw expired();
            const selected = ids.map((id) =>
              preview.value.items.find((p) => p.externalId === id),
            );
            if (selected.some((p) => !p))
              throw new HttpError(
                400,
                'INVALID_IMPORT_SELECTION',
                'Chỉ nhập các địa điểm có trong bản xem trước của bạn.',
              );
            const items = await markDuplicates(
              selected as PlaceImportCandidate[],
              session,
            );
            if (
              items.some(
                (p) => !p.existingPlaceId && p.possibleDuplicates.length,
              ) &&
              !input.acknowledgeDuplicates
            )
              throw new HttpError(
                409,
                'IMPORT_DUPLICATE_REVIEW',
                'Có địa điểm nghi trùng. Xem lại và xác nhận trước khi nhập.',
              );
            const destination = await requireDestination(session);
            const placeIds: string[] = [];
            for (const p of items) {
              if (p.existingPlaceId) continue;
              const target = planned.get(p.externalId)!;
              await new Place({
                _id: target.id,
                destinationId: destination._id,
                destinationName: destination.name,
                revision: 1,
                createdBy: actor,
                updatedBy: actor,
                createdByType: 'user',
                updatedByType: 'user',
                name: p.name,
                category: p.category,
                venueType: p.venueType,
                description:
                  'Địa điểm nhập từ Geoapify / OpenStreetMap; cần biên tập và kiểm tra thông tin trước khi đi.',
                subtitle: 'Thông tin nguồn mở, chưa xác minh tại cơ sở.',
                searchText: normalizeSearch(`${p.name} ${p.address}`).slice(
                  0,
                  2500,
                ),
                source: {
                  provider: 'geoapify',
                  externalId: p.externalId,
                  fetchedAt: new Date(preview.value.fetchedAt),
                  attribution:
                    'Powered by Geoapify · © OpenStreetMap contributors',
                  license: 'ODbL-1.0',
                },
                sourceUrl: p.sourceUrl,
                openingHoursNote: p.openingHoursNote,
                mapLocation: {
                  latitude: p.latitude,
                  longitude: p.longitude,
                  precision: 'area',
                  label:
                    `${p.name} · vị trí nguồn, chưa xác minh lối vào`.slice(
                      0,
                      150,
                    ),
                  sourceUrl: p.sourceUrl,
                  checkedAt: preview.value.fetchedAt.slice(0, 10),
                },
                referencePrice: null,
                publicationStatus: 'draft',
                imageUrl: '/images/explore-hoian.png',
                imageCredit: 'Ảnh minh họa AI, không phải ảnh cơ sở',
                durationLabel: 'Ước tính 60 phút',
                travelLabel: 'Kiểm tra đường đi',
                bestTimeLabel: 'Kiểm tra giờ mở cửa',
                tip: 'Dữ liệu nguồn mở chưa được kiểm tra tại cơ sở. Giá chưa rõ; thời lượng 60 phút là gợi ý ban đầu.',
                highlights: [],
                planning: {
                  durationMinutes: 60,
                  locationQuery: (p.address || `${p.name}, Hội An`).slice(
                    0,
                    200,
                  ),
                  costNote:
                    'Chưa rõ giá. Thời lượng là ước tính GoEase, chưa kiểm tra tại cơ sở.',
                  priceOptions: [],
                },
              }).save({ session });
              await audit.append(
                {
                  action: 'catalog.imported',
                  actorUserId: String(actor),
                  entityId: String(target.id),
                  entityRevision: 1,
                  requestId: reqId,
                  operationId: target.operationId,
                },
                session,
              );
              placeIds.push(String(target.id));
            }
            await new Key({
              actorId: actor,
              operation,
              key,
              requestHash,
              status: 'completed',
              resourceType: 'place_import',
              resourceId: batchId,
              resultIds: placeIds,
              responseStatus: 200,
              expiresAt: new Date(Date.now() + 86400000),
            }).save({ session });
            return {
              placeIds,
              created: placeIds.length,
              existing: ids.length - placeIds.length,
            };
          });
        } catch (e) {
          if (
            attempt < 2 &&
            e instanceof mongoose.mongo.MongoServerError &&
            e.code === 11000 &&
            [
              JSON.stringify({ actorId: 1, operation: 1, key: 1 }),
              JSON.stringify({ 'source.provider': 1, 'source.externalId': 1 }),
            ].includes(JSON.stringify(e.keyPattern))
          )
            continue;
          throw e;
        }
      }
      throw new HttpError(
        409,
        'IMPORT_CONFLICT',
        'Có thao tác nhập đồng thời. Giữ lựa chọn và thử lại.',
      );
    },
  };
}
