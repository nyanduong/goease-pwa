import { visitInfoModel, visitSearchModel } from './visit-info.model.js';
import { visitInfoSchema } from '@goease/contracts';
import {
  descriptionSearchModel,
  descriptionResultModel,
} from './place-descriptions.model.js';
import { photoSchema, imageSearchSchema } from './place-images.model.js';

import mongoose, {
  Schema,
  Types,
  type Connection,
  type InferSchemaType,
  type Model,
} from 'mongoose';
import {
  mapLocationSchema,
  type PlaceDto,
  type PlaceStateDto,
  placeQuerySchema,
  placeStateInputSchema,
} from '@goease/contracts';
import { HttpError } from '../../http-error.js';
import {
  referencePriceSchema,
  catalogImageSchema,
  catalogPhotoCover,
  approvedPhoto,
} from '@goease/contracts';
import { referencePriceModelSchema } from './reference-price.js';
import { mutableFields } from '../auth/auth.models.js';
import { sourceSnapshotModel } from './catalog-operations.models.js';
import { tourismRegions } from '@goease/contracts';
import { catalogPublicationFields } from './catalog-provenance.js';
const parseMapLocation = (v: unknown) =>
  mapLocationSchema.safeParse(
    v instanceof mongoose.Document ? v.toObject() : v,
  );
export const normalizeSearch = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
export function exploreService(connection: Connection) {
  const placeSchema = new Schema(
    {
      ...mutableFields,
      ...catalogPublicationFields,
      sourceSnapshot: { type: sourceSnapshotModel, default: null },
      internalNote: { type: String, maxlength: 1000, default: '' },
      images: {
        type: [photoSchema],
        default: [],
        validate: (v: unknown[]) => v.length <= 8,
      },
      visitInfo: { type: visitInfoModel, default: null },
      visitSearch: { type: visitSearchModel, required: false },
      descriptionSearch: { type: descriptionSearchModel, required: false },
      descriptionSource: { type: descriptionResultModel, default: null },
      imageSearch: { type: imageSearchSchema, default: () => ({}) },
      sourceCheckedAt: { type: Date, default: null },
      venueType: { type: String, enum: ['place', 'restaurant', 'food_idea'] },
      openingHoursNote: { type: String, maxlength: 400, default: '' },
      referencePrice: { type: referencePriceModelSchema, default: null },
      source: {
        type: new Schema(
          {
            provider: { type: String, enum: ['geoapify'], required: true },
            externalId: { type: String, required: true, maxlength: 512 },
            fetchedAt: { type: Date, required: true },
            attribution: {
              type: String,
              required: true,
              enum: ['Powered by Geoapify · © OpenStreetMap contributors'],
            },
            license: { type: String, required: true, enum: ['ODbL-1.0'] },
          },
          { _id: false, strict: 'throw', versionKey: false },
        ),
        required: false,
      },
      destinationId: { type: Schema.Types.ObjectId, required: true },
      destinationName: { type: String, required: true, maxlength: 100 },
      name: { type: String, required: true, maxlength: 120 },
      slug: { type: String, maxlength: 120 },
      category: {
        type: String,
        enum: ['food', 'culture', 'nature'],
        required: true,
      },
      subtitle: { type: String, default: '', maxlength: 150 },
      description: { type: String, default: '', maxlength: 2000 },
      searchText: { type: String, required: true, maxlength: 2500 },
      imageUrl: { type: String, default: '', maxlength: 2048 },
      durationLabel: { type: String, required: true, maxlength: 60 },
      travelLabel: { type: String, required: true, maxlength: 60 },
      bestTimeLabel: { type: String, required: true, maxlength: 60 },
      tip: { type: String, required: true, maxlength: 400 },
      highlights: {
        type: [
          {
            _id: false,
            name: { type: String, required: true, maxlength: 100 },
            query: { type: String, required: true, maxlength: 150 },
          },
        ],
        validate: (v: unknown[]) => v.length <= 8,
      },
      sourceUrl: { type: String, required: true, maxlength: 2048 },
      mapLocation: {
        type: new Schema(
          {
            latitude: { type: Number, required: true, min: -90, max: 90 },
            longitude: { type: Number, required: true, min: -180, max: 180 },
            label: { type: String, required: true, maxlength: 150 },
            precision: { type: String, required: true, enum: ['area'] },
            sourceUrl: { type: String, required: true, maxlength: 2048 },
            checkedAt: { type: String, required: true },
          },
          { _id: false, strict: 'throw', versionKey: false },
        ),
        validate: (v: unknown) => v == null || parseMapLocation(v).success,
        required: false,
      },
      planning: {
        type: new Schema(
          {
            durationMinutes: {
              type: Number,
              min: 1,
              max: 1440,
              required: true,
            },
            locationQuery: { type: String, maxlength: 200, required: true },
            costNote: { type: String, maxlength: 500, required: true },
            priceOptions: {
              type: [
                new Schema(
                  {
                    label: { type: String, maxlength: 120, required: true },
                    amountMinor: {
                      type: Number,
                      min: 0,
                      max: 1e12,
                      required: true,
                    },
                    basis: {
                      type: String,
                      enum: ['per_person', 'group_total'],
                      required: true,
                    },
                    sourceUrl: {
                      type: String,
                      maxlength: 2048,
                      required: true,
                    },
                    checkedAt: { type: String, required: true },
                  },
                  { _id: false, strict: 'throw', versionKey: false },
                ),
              ],
              validate: (v: unknown[]) => v.length <= 5,
              default: [],
            },
          },
          { _id: false, strict: 'throw', versionKey: false },
        ),
        required: false,
      },
      imageCredit: { type: String, required: true, maxlength: 1000 },
      publicationStatus: {
        type: String,
        enum: ['draft', 'published', 'archived'],
        default: 'draft',
      },
      deletedAt: { type: Date, default: null },
    },
    {
      collection: 'places',
      timestamps: true,
      versionKey: false,
      strict: 'throw',
      autoIndex: false,
      autoCreate: false,
    },
  );
  placeSchema.index({ destinationId: 1, publicationStatus: 1, deletedAt: 1 });
  placeSchema.index({
    'imageSearch.state': 1,
    'imageSearch.nextAttemptAt': 1,
    'imageSearch.leaseUntil': 1,
  });
  placeSchema.index(
    { 'source.provider': 1, 'source.externalId': 1 },
    {
      unique: true,
      partialFilterExpression: {
        'source.provider': 'geoapify',
        'source.externalId': { $type: 'string' },
      },
    },
  );
  const favoriteSchema = new Schema(
    {
      userId: { type: Schema.Types.ObjectId, required: true },
      targetType: { type: String, enum: ['place'], required: true },
      targetId: { type: Schema.Types.ObjectId, required: true },
      removedAt: { type: Date, default: null },
      note: { type: String, maxlength: 2000, default: '' },
      revision: { type: Number, default: 1 },
    },
    {
      collection: 'favorites',
      timestamps: true,
      strict: 'throw',
      autoIndex: false,
      autoCreate: false,
    },
  );
  favoriteSchema.index(
    { userId: 1, targetType: 1, targetId: 1 },
    { unique: true },
  );
  favoriteSchema.index({ userId: 1, removedAt: 1, createdAt: -1 });
  type PlaceRecord = InferSchemaType<typeof placeSchema>;
  const Place: Model<PlaceRecord> =
    (connection.models.ExplorePlace as Model<PlaceRecord> | undefined) ??
    connection.model<PlaceRecord>('ExplorePlace', placeSchema);
  type FavoriteRecord = InferSchemaType<typeof favoriteSchema>;
  const Favorite: Model<FavoriteRecord> =
    (connection.models.ExploreFavorite as Model<FavoriteRecord> | undefined) ??
    connection.model<FavoriteRecord>('ExploreFavorite', favoriteSchema);
  const published = {
    publicationStatus: 'published' as const,
    deletedAt: null,
  };
  const publishedDestination = {
    catalogKind: { $ne: 'legacy' },
    publicationStatus: 'published',
    deletedAt: null,
    $or: [{ countryCode: 'VN' }, { countryCode: { $exists: false } }],
  };
  const dto = (doc: PlaceRecord & { _id: Types.ObjectId }): PlaceDto => ({
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
    revision: doc.publicRevision ?? doc.revision,
    venueType:
      (doc.venueType as PlaceDto['venueType']) ??
      (doc.category === 'food' ? 'food_idea' : 'place'),
    openingHoursNote: doc.openingHoursNote,
    visitInfo: doc.visitInfo
      ? visitInfoSchema.parse({
          ...(doc.visitInfo.pricingVersion === 1 ? { pricingVersion: 1 } : {}),
          hours: doc.visitInfo.hours?.reviewed
            ? JSON.parse(JSON.stringify(doc.visitInfo.hours))
            : null,
          price: doc.visitInfo.price?.reviewed
            ? JSON.parse(JSON.stringify(doc.visitInfo.price))
            : null,
        })
      : null,
    referencePrice: doc.referencePrice
      ? referencePriceSchema.parse(
          doc.referencePrice instanceof mongoose.Document
            ? doc.referencePrice.toObject()
            : doc.referencePrice,
        )
      : null,
    id: String(doc._id),
    destinationId: String(doc.destinationId),
    destinationName: doc.destinationName,
    name: doc.name,
    slug: doc.slug ?? '',
    category: doc.category as PlaceDto['category'],
    subtitle: doc.subtitle,
    description: doc.description,
    descriptionSource: doc.descriptionSource
      ? {
          title: doc.descriptionSource.title,
          sourceUrl: doc.descriptionSource.sourceUrl,
          license: doc.descriptionSource.license,
          translated: doc.descriptionSource.translated,
        }
      : null,
    imageUrl:
      catalogPhotoCover(
        doc.images.map((i) =>
          i instanceof mongoose.Document ? i.toObject() : i,
        ),
      )?.url ?? '',
    durationLabel: doc.durationLabel,
    travelLabel: doc.travelLabel,
    bestTimeLabel: doc.bestTimeLabel,
    tip: doc.tip,
    highlights: doc.highlights.map((h: { name: string; query: string }) => ({
      name: h.name,
      query: h.query,
    })),
    sourceUrl: doc.sourceUrl,
    imageCredit:
      catalogPhotoCover(
        doc.images.map((i) =>
          i instanceof mongoose.Document ? i.toObject() : i,
        ),
      )?.credit ?? 'Chưa có ảnh thật được duyệt',
    images: doc.images
      .map((i) =>
        catalogImageSchema.parse(
          i instanceof mongoose.Document ? i.toObject() : i,
        ),
      )
      .filter(approvedPhoto),
    ...(parseMapLocation(doc.mapLocation).success
      ? { mapLocation: parseMapLocation(doc.mapLocation).data! }
      : {}),
    ...(doc.planning
      ? {
          planning: {
            durationMinutes: doc.planning.durationMinutes,
            locationQuery: doc.planning.locationQuery,
            costNote: doc.planning.costNote,
            priceOptions: (doc.visitInfo?.pricingVersion === 1
              ? []
              : doc.planning.priceOptions
            ).map((p) => ({
              label: p.label,
              amountMinor: p.amountMinor,
              basis: p.basis as 'per_person' | 'group_total',
              sourceUrl: p.sourceUrl,
              checkedAt: p.checkedAt,
            })),
          },
        }
      : {}),
  });
  const state = (
    doc: Pick<FavoriteRecord, 'removedAt' | 'note' | 'revision'> | null,
    placeId: string,
  ): PlaceStateDto => ({
    placeId,
    saved: doc ? !doc.removedAt : false,
    note: doc?.note ?? '',
    revision: doc?.revision ?? 0,
  });
  async function place(id: string) {
    if (!/^[a-f0-9]{24}$/.test(id))
      throw new HttpError(404, 'PLACE_NOT_FOUND', 'Không tìm thấy địa điểm.');
    const p = await Place.findOne({ _id: id, ...published });
    if (
      !p ||
      !(await connection
        .collection('destinations')
        .findOne(
          { ...publishedDestination, _id: p.destinationId },
          { projection: { _id: 1 } },
        ))
    )
      throw new HttpError(
        404,
        'PLACE_NOT_FOUND',
        'Địa điểm không còn được hiển thị.',
      );
    return p;
  }
  const conflict = () =>
    new HttpError(
      409,
      'PLACE_STATE_CONFLICT',
      'Ghi chú đã thay đổi ở nơi khác. Tải lại dữ liệu trước khi lưu; nội dung bạn nhập vẫn được giữ.',
    );
  return {
    models: { Place, Favorite },
    async list(query: unknown) {
      const parsed = placeQuerySchema.safeParse(query);
      if (!parsed.success)
        throw new HttpError(400, 'INVALID_INPUT', 'Bộ lọc chưa hợp lệ.');
      const {
        q,
        category,
        offset,
        limit,
        destinationId,
        region,
        tourismRegion,
      } = parsed.data;
      const regional = await connection
        .collection('destinations')
        .find(
          {
            ...publishedDestination,
            ...(region || tourismRegion
              ? {
                  tourismRegion: {
                    $in: tourismRegion
                      ? [tourismRegion]
                      : tourismRegions
                          .filter((r) => r.region === region)
                          .map((r) => r.code),
                  },
                }
              : {}),
            ...(destinationId
              ? { _id: new Types.ObjectId(destinationId) }
              : {}),
          },
          { projection: { _id: 1 } },
        )
        .limit(2001)
        .toArray();
      if (regional.length > 2000)
        throw new HttpError(
          400,
          'SCOPE_TOO_BROAD',
          'Chọn vùng hoặc điểm đến cụ thể hơn để xem địa điểm.',
        );
      const escaped = normalizeSearch(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const docs = await Place.find({
        ...published,
        ...(category ? { category } : {}),
        destinationId: { $in: regional.map((d) => d._id) },
        ...(q ? { searchText: { $regex: escaped } } : {}),
      })
        .sort({ _id: 1 })
        .skip(offset)
        .limit(limit + 1);
      return {
        items: docs.slice(0, limit).map(dto),
        hasMore: docs.length > limit,
      };
    },
    async read(id: string) {
      return { place: dto(await place(id)) };
    },
    async readState(owner: Types.ObjectId, id: string) {
      await place(id);
      return {
        state: state(
          await Favorite.findOne({
            userId: owner,
            targetType: 'place',
            targetId: id,
          }),
          id,
        ),
      };
    },
    async saved(owner: Types.ObjectId) {
      const favorites = await Favorite.find({
        userId: owner,
        targetType: 'place',
        removedAt: null,
      })
        .sort({ createdAt: -1 })
        .limit(100);
      const stored = await Place.find({
        ...published,
        _id: { $in: favorites.map((f) => f.targetId) },
      });
      const allowed = new Set(
        (
          await connection
            .collection('destinations')
            .find(
              {
                ...publishedDestination,
                _id: { $in: stored.map((p) => p.destinationId) },
              },
              { projection: { _id: 1 } },
            )
            .toArray()
        ).map((d) => String(d._id)),
      );
      const docs = stored.filter((p) => allowed.has(String(p.destinationId)));
      return {
        items: favorites.flatMap((f) => {
          const p = docs.find((p) => String(p._id) === String(f.targetId));
          return p ? [{ place: dto(p), state: state(f, String(p._id)) }] : [];
        }),
        unavailable: favorites
          .filter(
            (f) => !docs.some((p) => String(p._id) === String(f.targetId)),
          )
          .map((f) => ({
            placeId: String(f.targetId),
            state: state(f, String(f.targetId)),
          })),
      };
    },
    async updateState(owner: Types.ObjectId, id: string, input: unknown) {
      const parsed = placeStateInputSchema.safeParse(input);
      if (!parsed.success)
        throw new HttpError(
          400,
          'INVALID_INPUT',
          'Ghi chú tối đa 2.000 ký tự; yêu cầu phải có phiên bản hiện tại.',
        );
      const { expectedRevision, saved, note } = parsed.data;
      if (saved === false && note === undefined && /^[a-f0-9]{24}$/.test(id)) {
        // Removing an owned bookmark must work even after its public place disappears.
        const owned = await Favorite.exists({
          userId: owner,
          targetType: 'place',
          targetId: id,
        });
        if (!owned) await place(id);
      } else await place(id);
      const filter = {
        userId: owner,
        targetType: 'place' as const,
        targetId: new Types.ObjectId(id),
      };
      const updates = {
        ...(saved === undefined
          ? {}
          : { removedAt: saved ? null : new Date() }),
        ...(note === undefined ? {} : { note }),
      };
      let doc = await Favorite.findOneAndUpdate(
        { ...filter, revision: expectedRevision },
        { $set: updates, $inc: { revision: 1 } },
        { returnDocument: 'after', runValidators: true },
      );
      if (!doc && expectedRevision === 0) {
        try {
          doc = await new Favorite({
            ...filter,
            removedAt: saved ? null : new Date(),
            note: note ?? '',
            revision: 1,
          }).save();
        } catch (error) {
          if (
            error instanceof mongoose.mongo.MongoServerError &&
            error.code === 11000
          )
            throw conflict();
          throw error;
        }
      }
      if (!doc) throw conflict();
      return { state: state(doc, id) };
    },
  };
}
