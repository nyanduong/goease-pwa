import { randomUUID } from 'node:crypto';
import type { Types } from 'mongoose';
import {
  imageCandidateSchema,
  catalogImageSchema,
  type PlaceImageSearchDto,
} from '@goease/contracts';
import type { exploreService } from './explore.service.js';
import type { adminCatalog } from './admin-catalog.js';
import type { FindImages } from './wikimedia.js';
import { HttpError } from '../../http-error.js';

export function placeImages(
  explore: ReturnType<typeof exploreService>,
  catalog: ReturnType<typeof adminCatalog>,
  find: FindImages,
) {
  const { Place } = explore.models;
  async function read(
    actor: Types.ObjectId,
    id: string,
  ): Promise<PlaceImageSearchDto> {
    await catalog.requireAdmin(actor);
    const place = await Place.findOne({ _id: id, deletedAt: null });
    if (!place)
      throw new HttpError(404, 'PLACE_NOT_FOUND', 'Không tìm thấy địa điểm.');
    const search = place.imageSearch;
    return {
      defaultCover: search?.defaultCover
        ? catalogImageSchema.parse(place.toObject().imageSearch!.defaultCover)
        : null,
      state: search?.state ?? 'pending',
      candidates: (search?.candidates ?? []).map((c) =>
        imageCandidateSchema.parse(c.toObject()),
      ),
      message: search?.message ?? '',
      checkedAt: search?.checkedAt?.toISOString() ?? null,
    };
  }
  async function enqueue(actor: Types.ObjectId, id: string) {
    await catalog.requireAdmin(actor);
    const now = new Date();
    // An active lease or a recent lookup is returned as-is, rather than spawning another request.
    await Place.updateOne(
      {
        _id: id,
        deletedAt: null,
        $and: [
          {
            $or: [
              { 'imageSearch.leaseUntil': { $lte: now } },
              { 'imageSearch.leaseUntil': null },
            ],
          },
          {
            $or: [
              {
                'imageSearch.checkedAt': { $lt: new Date(Date.now() - 60000) },
              },
              { 'imageSearch.checkedAt': null },
            ],
          },
        ],
      },
      {
        $set: {
          'imageSearch.state': 'pending',
          'imageSearch.attempts': 0,
          'imageSearch.nextAttemptAt': now,
          'imageSearch.message': '',
        },
      },
      { timestamps: false },
    );
    return read(actor, id);
  }
  async function tick() {
    const token = randomUUID(),
      now = new Date();
    const place = await Place.findOneAndUpdate(
      {
        deletedAt: null,
        publicationStatus: { $ne: 'archived' },
        $or: [
          {
            'imageSearch.state': 'pending',
            'imageSearch.nextAttemptAt': { $lte: now },
          },
          {
            'imageSearch.state': 'searching',
            'imageSearch.leaseUntil': { $lte: now },
          },
          { imageSearch: { $exists: false }, 'images.0': { $exists: false } },
        ],
      },
      {
        $set: {
          'imageSearch.state': 'searching',
          'imageSearch.storageVersion': 3,
          'imageSearch.leaseToken': token,
          'imageSearch.leaseUntil': new Date(Date.now() + 120000),
        },
        $inc: { 'imageSearch.attempts': 1 },
      },
      { returnDocument: 'after', timestamps: false },
    );
    if (!place) return;
    const fence = () => ({
      _id: place._id,
      deletedAt: null,
      'imageSearch.leaseToken': token,
      'imageSearch.leaseUntil': { $gt: new Date() },
    });
    try {
      if ((place.imageSearch?.attempts ?? 0) > 3)
        throw new Error('Retries exceeded');
      const candidates = (
        await find({
          name: place.name,
          destinationName: place.destinationName,
          ...(place.mapLocation
            ? {
                latitude: place.mapLocation.latitude,
                longitude: place.mapLocation.longitude,
              }
            : {}),
        })
      )
        .slice(0, 5)
        .map((c) => imageCandidateSchema.parse(c));
      // Do not apply observations to a renamed/moved place while the network call was in flight.
      const saved = await Place.updateOne(
        {
          ...fence(),
          name: place.name,
          destinationId: place.destinationId,
          revision: place.revision,
        },
        {
          $set: {
            ...(!place.imageSearch?.defaultCover && candidates[0]
              ? {
                  'imageSearch.defaultCover': {
                    ...candidates[0].image,
                    selection: 'automatic',
                    reviewed: false,
                  },
                }
              : {}),
            ...(place.imageSearch?.defaultCover &&
            candidates.find(
              (c) =>
                c.image.storage !== 'source' &&
                c.image.sourceUrl ===
                  place.imageSearch!.defaultCover!.sourceUrl,
            )
              ? {
                  'imageSearch.defaultCover': {
                    ...place.toObject().imageSearch!.defaultCover,
                    url: candidates.find(
                      (c) =>
                        c.image.storage !== 'source' &&
                        c.image.sourceUrl ===
                          place.imageSearch!.defaultCover!.sourceUrl,
                    )!.image.url,
                  },
                }
              : {}),
            'imageSearch.state': candidates.length ? 'ready' : 'empty',
            'imageSearch.candidates': candidates,
            'imageSearch.checkedAt': new Date(),
            'imageSearch.leaseToken': null,
            'imageSearch.leaseUntil': null,
            'imageSearch.message': candidates.length
              ? `Có ${candidates.length}/5 ảnh. Bìa đã lưu; các ảnh bổ sung dùng link nguồn. Đổi bìa sẽ lưu ảnh được chọn.`
              : 'Chưa tìm thấy ảnh phù hợp có giấy phép được hỗ trợ. Bổ sung ảnh thật hoặc thử lại.',
          },
        },
        { timestamps: false, runValidators: true },
      );
      if (!saved.modifiedCount)
        await Place.updateOne(
          fence(),
          {
            $set: {
              'imageSearch.state': 'pending',
              'imageSearch.nextAttemptAt': new Date(Date.now() + 60000),
              'imageSearch.leaseToken': null,
              'imageSearch.leaseUntil': null,
            },
          },
          { timestamps: false },
        );
    } catch (error) {
      const retry = (place.imageSearch?.attempts ?? 3) < 3;
      await Place.updateOne(
        fence(),
        {
          $set: {
            'imageSearch.state': retry ? 'pending' : 'failed',
            'imageSearch.nextAttemptAt': new Date(Date.now() + 60000),
            'imageSearch.checkedAt': new Date(),
            'imageSearch.leaseToken': null,
            'imageSearch.leaseUntil': null,
            'imageSearch.message':
              error instanceof HttpError &&
              error.code.startsWith('PLACE_PHOTO_STORAGE')
                ? error.message
                : 'Chưa lấy được ảnh Wikimedia. Địa điểm được giữ nguyên; có thể thử lại.',
          },
        },
        { timestamps: false },
      );
    }
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
  async function prepareStorage() {
    // Persist a stable default for existing ready observations; retries never replace it.
    await Place.updateMany(
      {
        deletedAt: null,
        'imageSearch.storageVersion': { $in: [1, 2, 3] },
        'imageSearch.defaultCover': null,
        'imageSearch.candidates.0': { $exists: true },
      },
      [
        {
          $set: {
            'imageSearch.defaultCover': {
              $mergeObjects: [
                { $arrayElemAt: ['$imageSearch.candidates.image', 0] },
                { selection: 'automatic', reviewed: false },
              ],
            },
          },
        },
      ],
      { timestamps: false, updatePipeline: true },
    );
    // Requeue legacy observations once; never modify selected images or publication state.
    await Place.updateMany(
      {
        deletedAt: null,
        publicationStatus: { $ne: 'archived' },
        'imageSearch.storageVersion': { $nin: [2, 3] },
        $or: [
          { 'imageSearch.leaseUntil': null },
          { 'imageSearch.leaseUntil': { $lt: new Date() } },
        ],
      },
      {
        $set: {
          'imageSearch.storageVersion': 3,
          'imageSearch.state': 'pending',
          'imageSearch.attempts': 0,
          'imageSearch.nextAttemptAt': new Date(),
          'imageSearch.message':
            'Đang tìm ảnh và lưu một ảnh bìa gốc trên Cloudinary.',
        },
      },
      { timestamps: false },
    );
  }
  return { read, enqueue, tick, start, stop, prepareStorage };
}
