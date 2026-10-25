import { randomUUID } from 'node:crypto';
import type { Types } from 'mongoose';
import { visitInfoSchema, type VisitInfoSearchDto } from '@goease/contracts';
import type { exploreService } from './explore.service.js';
import type { adminCatalog } from './admin-catalog.js';
import { visitContext, type FindVisitInfo } from './visit-info-provider.js';
import { HttpError } from '../../http-error.js';
export function placeVisitInfo(
  explore: ReturnType<typeof exploreService>,
  catalog: ReturnType<typeof adminCatalog>,
  find: FindVisitInfo,
) {
  const { Place } = explore.models;
  async function read(
    actor: Types.ObjectId,
    id: string,
  ): Promise<VisitInfoSearchDto> {
    await catalog.requireAdmin(actor);
    const current = await Place.findOne({ _id: id, deletedAt: null });
    if (!current)
      throw new HttpError(404, 'PLACE_NOT_FOUND', 'Không tìm thấy địa điểm.');
    const effective = await catalog.proposal(current),
      search = current.toObject().visitSearch;
    const matches = search?.context === visitContext(effective);
    return {
      state: (search?.state as VisitInfoSearchDto['state']) ?? 'empty',
      result:
        matches && search?.result ? visitInfoSchema.parse(search.result) : null,
      message:
        !matches && search?.result
          ? 'Địa điểm đã đổi. Bấm tìm lại giờ mở cửa và giá.'
          : (search?.message ?? 'Chưa tìm giờ mở cửa và giá.'),
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
              { 'visitSearch.leaseUntil': null },
              { 'visitSearch.leaseUntil': { $lte: new Date() } },
            ],
          },
          {
            $or: [
              { 'visitSearch.checkedAt': null },
              {
                'visitSearch.checkedAt': {
                  $lt: new Date(Date.now() - 60000),
                },
              },
            ],
          },
        ],
      },
      {
        $set: {
          'visitSearch.state': 'pending',
          'visitSearch.attempts': 0,
          'visitSearch.nextAttemptAt': new Date(),
          'visitSearch.message': '',
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
            'visitSearch.state': 'pending',
            'visitSearch.nextAttemptAt': { $lte: new Date() },
          },
          {
            'visitSearch.state': 'searching',
            'visitSearch.leaseUntil': { $lte: new Date() },
          },
        ],
      },
      {
        $set: {
          'visitSearch.state': 'searching',
          'visitSearch.leaseToken': token,
          'visitSearch.leaseUntil': new Date(Date.now() + 120000),
        },
        $inc: { 'visitSearch.attempts': 1 },
      },
      { returnDocument: 'after', timestamps: false },
    );
    if (!doc) return;
    const fence = () => ({
      _id: doc._id,
      deletedAt: null,
      publicationStatus: 'draft' as const,
      'visitSearch.leaseToken': token,
      'visitSearch.leaseUntil': { $gt: new Date() },
    });
    try {
      const effective = await catalog.proposal(doc, undefined, false),
        query = effective;
      const editable = !effective.fieldLocks?.includes('visitInfo');
      const result = editable ? await find(query) : null;
      const state = result ? 'ready' : 'empty';
      const saved = await Place.updateOne(
        { ...fence(), revision: doc.revision },
        {
          $set: {
            'visitSearch.state': state,
            ...(editable
              ? {
                  'visitSearch.context': visitContext(query),
                  'visitSearch.result': result,
                }
              : {}),
            'visitSearch.checkedAt': new Date(),
            'visitSearch.leaseToken': null,
            'visitSearch.leaseUntil': null,
            'visitSearch.message': !editable
              ? 'Thông tin đã khóa; giữ nguyên dữ liệu.'
              : result
                ? 'Đã tìm thông tin. Kiểm tra từng mục rồi lưu đề xuất.'
                : 'Nguồn chưa có giờ/giá phù hợp. Có thể nhập tay hoặc tìm lại.',
          },
        },
        { timestamps: false, runValidators: true },
      );
      if (!saved.modifiedCount)
        await Place.updateOne(
          fence(),
          {
            $set: {
              'visitSearch.state': 'pending',
              'visitSearch.nextAttemptAt': new Date(Date.now() + 60000),
              'visitSearch.leaseToken': null,
              'visitSearch.leaseUntil': null,
            },
          },
          { timestamps: false },
        );
    } catch {
      const retry = (doc.visitSearch?.attempts ?? 3) < 3;
      await Place.updateOne(
        fence(),
        {
          $set: {
            'visitSearch.state': retry ? 'pending' : 'failed',
            'visitSearch.nextAttemptAt': new Date(Date.now() + 60000),
            'visitSearch.checkedAt': new Date(),
            'visitSearch.leaseToken': null,
            'visitSearch.leaseUntil': null,
            'visitSearch.message':
              'Chưa lấy được giờ mở cửa và giá từ nguồn. Nội dung đã nhập được giữ nguyên.',
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
        $or: [
          { visitSearch: { $exists: false } },
          { 'visitSearch.providerVersion': { $exists: false } },
          { 'visitSearch.providerVersion': { $lt: 3 } },
        ],
      },
      {
        $set: {
          'visitSearch.providerVersion': 3,
          'visitSearch.state': 'pending',
          'visitSearch.attempts': 0,
          'visitSearch.nextAttemptAt': new Date(),
          'visitSearch.leaseToken': null,
          'visitSearch.leaseUntil': null,
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
