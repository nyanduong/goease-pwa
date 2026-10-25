import { randomUUID } from 'node:crypto';
import type { Types } from 'mongoose';
import {
  needsPlaceDescription,
  placeDescriptionSchema,
  type PlaceDescriptionSearchDto,
} from '@goease/contracts';
import type { exploreService } from './explore.service.js';
import type { adminCatalog } from './admin-catalog.js';
import type {
  DescriptionQuery,
  FindDescription,
} from './wikipedia-descriptions.js';
import { HttpError } from '../../http-error.js';
export const descriptionContext = (query: DescriptionQuery) =>
  JSON.stringify([
    query.name,
    query.destinationName,
    query.latitude ?? null,
    query.longitude ?? null,
    query.sourceUrl,
    query.wikipedia ?? '',
    query.wikidata ?? '',
  ]);
export const descriptionQuery = (doc: {
  name: string;
  destinationName: string;
  sourceUrl: string;
  mapLocation?: { latitude: number; longitude: number } | null;
  sourceSnapshot?: {
    wikipedia?: string | null;
    wikidata?: string | null;
  } | null;
}): DescriptionQuery => ({
  name: doc.name,
  destinationName: doc.destinationName,
  sourceUrl: doc.sourceUrl,
  ...(doc.mapLocation
    ? {
        latitude: doc.mapLocation.latitude,
        longitude: doc.mapLocation.longitude,
      }
    : {}),
  ...(doc.sourceSnapshot?.wikipedia
    ? { wikipedia: doc.sourceSnapshot.wikipedia }
    : {}),
  ...(doc.sourceSnapshot?.wikidata
    ? { wikidata: doc.sourceSnapshot.wikidata }
    : {}),
});
export function placeDescriptions(
  explore: ReturnType<typeof exploreService>,
  catalog: ReturnType<typeof adminCatalog>,
  find: FindDescription,
) {
  const { Place } = explore.models;
  async function read(
    actor: Types.ObjectId,
    id: string,
  ): Promise<PlaceDescriptionSearchDto> {
    await catalog.requireAdmin(actor);
    const current = await Place.findOne({ _id: id, deletedAt: null });
    if (!current)
      throw new HttpError(404, 'PLACE_NOT_FOUND', 'Không tìm thấy địa điểm.');
    const effective = await catalog.proposal(current),
      search = current.toObject().descriptionSearch;
    const matches =
      search?.context === descriptionContext(descriptionQuery(effective));
    return {
      state: (search?.state as PlaceDescriptionSearchDto['state']) ?? 'empty',
      result: effective.descriptionSource
        ? placeDescriptionSchema.parse(effective.toObject().descriptionSource)
        : matches && search?.result
          ? placeDescriptionSchema.parse(search.result)
          : null,
      message:
        !matches && search?.result
          ? 'Địa điểm đã đổi. Bấm tìm lại giới thiệu.'
          : (search?.message ?? 'Chưa tìm giới thiệu.'),
      checkedAt: search?.checkedAt?.toISOString() ?? null,
    };
  }
  async function enqueue(actor: Types.ObjectId, id: string) {
    await catalog.requireAdmin(actor);
    await Place.updateOne(
      {
        _id: id,
        deletedAt: null,
        publicationStatus: 'draft' as const,
        $and: [
          {
            $or: [
              { 'descriptionSearch.leaseUntil': null },
              { 'descriptionSearch.leaseUntil': { $lte: new Date() } },
            ],
          },
          {
            $or: [
              { 'descriptionSearch.checkedAt': null },
              {
                'descriptionSearch.checkedAt': {
                  $lt: new Date(Date.now() - 60000),
                },
              },
            ],
          },
        ],
      },
      {
        $set: {
          'descriptionSearch.state': 'pending',
          'descriptionSearch.attempts': 0,
          'descriptionSearch.nextAttemptAt': new Date(),
          'descriptionSearch.message': '',
        },
      },
      { timestamps: false },
    );
    return read(actor, id);
  }
  async function tick() {
    const token = randomUUID();
    const doc = await Place.findOneAndUpdate(
      {
        deletedAt: null,
        publicationStatus: 'draft' as const,
        $or: [
          {
            'descriptionSearch.state': 'pending',
            'descriptionSearch.nextAttemptAt': { $lte: new Date() },
          },
          {
            'descriptionSearch.state': 'searching',
            'descriptionSearch.leaseUntil': { $lte: new Date() },
          },
        ],
      },
      {
        $set: {
          'descriptionSearch.state': 'searching',
          'descriptionSearch.leaseToken': token,
          'descriptionSearch.leaseUntil': new Date(Date.now() + 120000),
        },
        $inc: { 'descriptionSearch.attempts': 1 },
      },
      { returnDocument: 'after', timestamps: false },
    );
    if (!doc) return;
    const fence = () => ({
      _id: doc._id,
      deletedAt: null,
      publicationStatus: 'draft' as const,
      'descriptionSearch.leaseToken': token,
      'descriptionSearch.leaseUntil': { $gt: new Date() },
    });
    try {
      const effective = await catalog.proposal(doc, undefined, false),
        query = descriptionQuery(effective);
      const editable =
        needsPlaceDescription(effective.description) &&
        !effective.fieldLocks?.includes('description');
      const result = editable ? await find(query) : null;
      const state = !editable
        ? 'empty'
        : result?.text
          ? 'ready'
          : result
            ? 'needs_translation'
            : 'empty';
      const saved = await Place.updateOne(
        { ...fence(), revision: doc.revision },
        {
          $set: {
            'descriptionSearch.state': state,
            ...(editable
              ? {
                  'descriptionSearch.context': descriptionContext(query),
                  'descriptionSearch.result': result,
                }
              : {}),
            'descriptionSearch.checkedAt': new Date(),
            'descriptionSearch.leaseToken': null,
            'descriptionSearch.leaseUntil': null,
            'descriptionSearch.message': !editable
              ? 'Giữ nguyên phần giới thiệu đã biên tập hoặc đã khóa.'
              : state === 'ready'
                ? 'Đã lấy giới thiệu có nguồn. Hãy đọc lại trước khi xuất bản.'
                : state === 'needs_translation'
                  ? 'Đã tìm được bài tiếng Anh, chưa dịch được sang tiếng Việt.'
                  : 'Chưa tìm được giới thiệu phù hợp. Bạn có thể nhập nội dung hoặc tìm lại.',
          },
        },
        { timestamps: false, runValidators: true },
      );
      if (!saved.modifiedCount)
        await Place.updateOne(
          fence(),
          {
            $set: {
              'descriptionSearch.state': 'pending',
              'descriptionSearch.nextAttemptAt': new Date(Date.now() + 60000),
              'descriptionSearch.leaseToken': null,
              'descriptionSearch.leaseUntil': null,
            },
          },
          { timestamps: false },
        );
    } catch {
      const retry = (doc.descriptionSearch?.attempts ?? 3) < 3;
      await Place.updateOne(
        fence(),
        {
          $set: {
            'descriptionSearch.state': retry ? 'pending' : 'failed',
            'descriptionSearch.nextAttemptAt': new Date(Date.now() + 60000),
            'descriptionSearch.checkedAt': new Date(),
            'descriptionSearch.leaseToken': null,
            'descriptionSearch.leaseUntil': null,
            'descriptionSearch.message':
              'Chưa lấy được giới thiệu từ nguồn. Nội dung đã nhập được giữ nguyên.',
          },
        },
        { timestamps: false },
      );
    }
  }
  async function prepare() {
    await Place.updateMany(
      {
        deletedAt: null,
        publicationStatus: 'draft' as const,
        'source.provider': 'geoapify',
        descriptionSearch: { $exists: false },
      },
      {
        $set: {
          descriptionSearch: {
            state: 'pending',
            attempts: 0,
            nextAttemptAt: new Date(),
          },
        },
      },
      { timestamps: false },
    );
  }
  let timer: ReturnType<typeof setInterval> | undefined,
    running: Promise<void> | undefined;
  function start() {
    if (timer) return;
    const poll = () => {
      if (!running)
        running = tick()
          .catch(() => {})
          .finally(() => {
            running = undefined;
          });
    };
    timer = setInterval(poll, 5000);
    timer.unref();
    poll();
  }
  async function stop() {
    clearInterval(timer);
    timer = undefined;
    await running;
  }
  return { read, enqueue, tick, prepare, start, stop };
}
