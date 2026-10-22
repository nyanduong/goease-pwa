import mongoose, {
  Schema,
  Types,
  type Connection,
  type InferSchemaType,
  type Model,
} from 'mongoose';
import {
  type PlaceDto,
  type PlaceStateDto,
  placeQuerySchema,
  placeStateInputSchema,
} from '@goease/contracts';
import { HttpError } from '../../http-error.js';
import { mutableFields } from '../auth/auth.models.js';
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
      destinationId: { type: Schema.Types.ObjectId, required: true },
      destinationName: { type: String, required: true, maxlength: 100 },
      name: { type: String, required: true, maxlength: 120 },
      slug: { type: String, maxlength: 120 },
      category: {
        type: String,
        enum: ['food', 'culture', 'nature'],
        required: true,
      },
      subtitle: { type: String, required: true, maxlength: 150 },
      description: { type: String, required: true, maxlength: 2000 },
      searchText: { type: String, required: true, maxlength: 2500 },
      imageUrl: { type: String, required: true, maxlength: 2048 },
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
      imageCredit: { type: String, required: true, maxlength: 100 },
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
      strict: 'throw',
      autoIndex: false,
      autoCreate: false,
    },
  );
  placeSchema.index({ destinationId: 1, publicationStatus: 1, deletedAt: 1 });
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
  const dto = (doc: PlaceRecord & { _id: Types.ObjectId }): PlaceDto => ({
    id: String(doc._id),
    destinationId: String(doc.destinationId),
    destinationName: doc.destinationName,
    name: doc.name,
    slug: doc.slug ?? '',
    category: doc.category as PlaceDto['category'],
    subtitle: doc.subtitle,
    description: doc.description,
    imageUrl: doc.imageUrl,
    durationLabel: doc.durationLabel,
    travelLabel: doc.travelLabel,
    bestTimeLabel: doc.bestTimeLabel,
    tip: doc.tip,
    highlights: doc.highlights.map((h: { name: string; query: string }) => ({
      name: h.name,
      query: h.query,
    })),
    sourceUrl: doc.sourceUrl,
    imageCredit: doc.imageCredit,
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
    if (!p)
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
      const { q, category, offset, limit } = parsed.data;
      const escaped = normalizeSearch(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const docs = await Place.find({
        ...published,
        ...(category ? { category } : {}),
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
      const docs = await Place.find({
        ...published,
        _id: { $in: favorites.map((f) => f.targetId) },
      });
      return {
        items: favorites.flatMap((f) => {
          const p = docs.find((p) => String(p._id) === String(f.targetId));
          return p ? [{ place: dto(p), state: state(f, String(p._id)) }] : [];
        }),
      };
    },
    async updateState(owner: Types.ObjectId, id: string, input: unknown) {
      await place(id);
      const parsed = placeStateInputSchema.safeParse(input);
      if (!parsed.success)
        throw new HttpError(
          400,
          'INVALID_INPUT',
          'Ghi chú tối đa 2.000 ký tự; yêu cầu phải có phiên bản hiện tại.',
        );
      const { expectedRevision, saved, note } = parsed.data;
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
