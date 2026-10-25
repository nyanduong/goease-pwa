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
import { matchesPlaceImage, imageSourceContext } from './wikimedia.js';
import {
  PhotoSourceCooldown,
  photoSourceCooldownMessage,
} from './place-photo-storage.js';
import { HttpError } from '../../http-error.js';

export function placeImages(
  explore: ReturnType<typeof exploreService>,
  catalog: ReturnType<typeof adminCatalog>,
  find: FindImages,
  options: {
    concurrency?: number;
    priorityDestination?: () => Promise<Types.ObjectId | null>;
  } = {},
) {
  const concurrency = options.concurrency ?? 3;
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 4)
    throw new Error('Photo concurrency must be between 1 and 4');
  const { Place } = explore.models;
  let providerPausedUntil = 0;
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
          'imageSearch.priority': 100,
          'imageSearch.nextAttemptAt': now,
          'imageSearch.message': '',
        },
      },
      { timestamps: false },
    );
    return read(actor, id);
  }
  async function tick() {
    if (Date.now() < providerPausedUntil) return;
    const token = randomUUID(),
      now = new Date();
    const priorityId = await options.priorityDestination?.();
    const claim = (priorityOnly: boolean) =>
      Place.findOneAndUpdate(
        {
          ...(priorityOnly && priorityId ? { destinationId: priorityId } : {}),
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
            'imageSearch.leaseUntil': new Date(Date.now() + 300000),
          },
          $inc: { 'imageSearch.attempts': 1 },
        },
        {
          returnDocument: 'after',
          timestamps: false,
          sort: {
            'imageSearch.priority': -1,
            'imageSearch.nextAttemptAt': 1,
            _id: 1,
          },
        },
      );
    const place =
      (priorityId ? await claim(true) : null) ?? (await claim(false));
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
      const effective = await catalog.proposal(place, undefined, false);
      const candidates = (
        await find({
          name: effective.name,
          destinationName: effective.destinationName,
          ...(place.imageSearch?.preferredCandidatesUntil &&
          place.imageSearch.preferredCandidatesUntil.getTime() > Date.now() &&
          place.imageSearch.preferredCandidatesContext ===
            imageSourceContext(effective)
            ? {
                preferredCandidates: place.imageSearch.candidates
                  .map((candidate) =>
                    imageCandidateSchema.parse(candidate.toObject()),
                  )
                  .filter((candidate) =>
                    matchesPlaceImage(effective.name, candidate),
                  ),
              }
            : {}),
          ...(effective.mapLocation
            ? {
                latitude: effective.mapLocation.latitude,
                longitude: effective.mapLocation.longitude,
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
      const cooldown =
        error instanceof PhotoSourceCooldown ? error.retryAfterMs : 0;
      if (cooldown)
        providerPausedUntil = Math.max(
          providerPausedUntil,
          Date.now() + cooldown,
        );
      const retry = !!cooldown || (place.imageSearch?.attempts ?? 3) < 3;
      await Place.updateOne(
        fence(),
        {
          $set: {
            'imageSearch.state': retry ? 'pending' : 'failed',
            'imageSearch.nextAttemptAt': new Date(
              Date.now() + Math.max(60000, cooldown),
            ),
            'imageSearch.checkedAt': new Date(),
            'imageSearch.leaseToken': null,
            'imageSearch.leaseUntil': null,
            'imageSearch.message':
              error instanceof HttpError &&
              error.code.startsWith('PLACE_PHOTO_STORAGE')
                ? error.message
                : 'Chưa lấy được ảnh Wikimedia. Địa điểm được giữ nguyên; có thể thử lại.',
          },
          ...(cooldown ? { $inc: { 'imageSearch.attempts': -1 } } : {}),
        },
        { timestamps: false },
      );
    }
  }
  let timer: ReturnType<typeof setInterval> | undefined;
  const running = new Set<Promise<void>>();
  function start() {
    if (timer) return;
    const poll = () => {
      while (running.size < concurrency) {
        const task = tick()
          .catch(() => {})
          .finally(() => {
            running.delete(task);
          });
        running.add(task);
      }
    };
    timer = setInterval(poll, 1000);
    timer.unref();
    poll();
  }
  async function stop() {
    clearInterval(timer);
    timer = undefined;
    await Promise.allSettled([...running]);
  }
  async function prepareStorage() {
    const deferred = await Place.findOne({
      deletedAt: null,
      'imageSearch.state': 'pending',
      'imageSearch.message': photoSourceCooldownMessage,
      'imageSearch.nextAttemptAt': { $gt: new Date() },
    })
      .sort({ 'imageSearch.nextAttemptAt': -1 })
      .select('imageSearch.nextAttemptAt');
    providerPausedUntil = Math.max(
      providerPausedUntil,
      deferred?.imageSearch?.nextAttemptAt?.getTime() ?? 0,
    );
    // Adopt old cached candidates first, so every new automatic default is checked below.
    await Place.updateMany(
      {
        deletedAt: null,
        publicationStatus: 'draft',
        'images.0': { $exists: false },
        fieldLocks: { $ne: 'images' },
        'imageSearch.state': { $in: ['ready', 'failed', 'empty'] },
        'imageSearch.storageVersion': { $in: [1, 2, 3] },
        'imageSearch.defaultCover': null,
        'imageSearch.candidates.0': { $exists: true },
        'imageSearch.candidates.0.image.storage': { $ne: 'source' },
        $or: [
          { 'imageSearch.leaseUntil': null },
          { 'imageSearch.leaseUntil': { $lte: new Date() } },
        ],
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
    // Withdraw automatic observations in every idle state, never selected/public/locked images.
    const automatic = Place.find({
      deletedAt: null,
      publicationStatus: 'draft',
      'images.0': { $exists: false },
      fieldLocks: { $ne: 'images' },
      $and: [
        {
          $or: [
            { 'imageSearch.leaseUntil': null },
            { 'imageSearch.leaseUntil': { $lte: new Date() } },
          ],
        },
      ],
      'imageSearch.defaultCover.selection': 'automatic',
    });
    for await (const doc of automatic) {
      const candidates = doc.imageSearch!.candidates.map((candidate) =>
        imageCandidateSchema.parse(candidate.toObject()),
      );
      const safe = candidates.filter((candidate) =>
        matchesPlaceImage(doc.name, candidate),
      );
      const defaultImage = catalogImageSchema.safeParse(
        doc.toObject().imageSearch!.defaultCover,
      );
      let storedTitle = '';
      try {
        storedTitle = decodeURIComponent(
          new URL(doc.imageSearch!.defaultCover!.sourceUrl).pathname
            .split('/')
            .at(-1) ?? '',
        );
      } catch {
        /* Invalid provenance cannot confirm a default. */
      }
      const keepsCover =
        (defaultImage.success &&
          matchesPlaceImage(doc.name, {
            id: 'cached-cover',
            title: storedTitle,
            match: 'name',
            image: defaultImage.data,
          })) ||
        safe.some(
          (candidate) =>
            candidate.image.sourceUrl ===
            doc.imageSearch!.defaultCover!.sourceUrl,
        );
      if (safe.length === candidates.length && keepsCover) continue;
      await Place.updateOne(
        {
          _id: doc._id,
          revision: doc.revision,
          publicationStatus: 'draft',
          'images.0': { $exists: false },
          fieldLocks: { $ne: 'images' },
          'imageSearch.state': doc.imageSearch!.state,
          'imageSearch.checkedAt': doc.imageSearch!.checkedAt ?? null,
          $or: [
            { 'imageSearch.leaseUntil': null },
            { 'imageSearch.leaseUntil': { $lte: new Date() } },
          ],
        },
        {
          $set: {
            'imageSearch.candidates': safe,
            ...(!keepsCover
              ? {
                  'imageSearch.defaultCover': null,
                  'imageSearch.state': safe.length ? 'pending' : 'empty',
                  'imageSearch.nextAttemptAt': new Date(),
                  'imageSearch.attempts': 0,
                  'imageSearch.message':
                    'Đã bỏ gợi ý ảnh không khớp tên địa điểm; chưa xác minh được ảnh phù hợp.',
                }
              : {}),
          },
        },
        { timestamps: false },
      );
    }
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
