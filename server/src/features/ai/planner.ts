import { randomUUID } from 'node:crypto';
import { Schema, Types, type Connection } from 'mongoose';
import {
  tripInputSchema,
  type PlannerRequest,
  type PlannerProposal,
  type PlaceDto,
  type GoeRequest,
  type GoeProposal,
} from '@goease/contracts';
import type { Config } from '../../config.js';
import { HttpError } from '../../http-error.js';
import { tokenHash } from '../auth/security.js';
import { requestId } from '../auth/auth.service.js';
import { calculateBudget } from '../trips/budget.js';
import type { tripService } from '../trips/trip.service.js';
import type { exploreService } from '../explore/explore.service.js';
import {
  geminiProvider,
  generatedPlanSchema,
  type Generate,
} from './gemini.js';

export function validatePlan(
  raw: unknown,
  input: PlannerRequest,
  places: PlaceDto[],
  runId: string,
): PlannerProposal {
  const plan = generatedPlanSchema.parse(raw);
  const maxStops = { relaxed: 2, balanced: 3, active: 6 }[
    input.trip.preferences.pace
  ];
  if (
    JSON.stringify(plan.days.map((d) => d.date)) !==
    JSON.stringify(input.trip.days.map((d) => d.date))
  )
    throw new Error('Dates');
  const minutes = (s: string) =>
    Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
  const days = plan.days.map((day, i) => {
    let end = 390;
    const seen = new Set<string>();
    if (day.stops.length > maxStops) throw new Error('Pace');
    return {
      ...input.trip.days[i]!,
      activities: day.stops.map((stop, order) => {
        const place = places.find(
          (p) =>
            p.id === stop.placeId &&
            p.destinationId === input.trip.destinations[0]!.destinationId,
        );
        const start = minutes(stop.start),
          finish = minutes(stop.end);
        if (
          !place?.planning ||
          seen.has(stop.placeId) ||
          start < end + 30 ||
          finish > 1320 ||
          finish - start < place.planning.durationMinutes
        )
          throw new Error('Invalid stop');
        seen.add(stop.placeId);
        end = finish;
        return {
          activityId: randomUUID(),
          placeId: place.id,
          kind:
            place.category === 'food' ? ('meal' as const) : ('visit' as const),
          title: place.name,
          startLocalTime: stop.start,
          endLocalTime: stop.end,
          timezone: 'Asia/Ho_Chi_Minh' as const,
          order,
          notes: '',
          source: 'ai' as const,
          estimatedCost: {
            amountMinor: null,
            currency: 'VND' as const,
            basis: 'group_total' as const,
            quantity: 1 as const,
            confidence: 'user_entered' as const,
          },
        };
      }),
    };
  });
  const trip = tripInputSchema.parse({
    ...input.trip,
    generationMode: 'ai',
    aiRunId: runId,
    days,
  });
  return {
    runId,
    trip,
    budget: calculateBudget(trip),
    warnings: [
      'Đây là đề xuất AI. Giờ đi và thời lượng cần kiểm tra lại; chưa xác minh giờ mở cửa, thời tiết hay thời gian di chuyển thực tế.',
      'Chi phí chưa được chọn. Mở từng điểm dừng để chọn giá tham khảo hoặc nhập giá; không xem tổng hiện tại là chi phí đầy đủ.',
      ...(days.length > 2
        ? ['Catalog Hội An còn nhỏ; địa điểm có thể lặp giữa các ngày.']
        : []),
    ],
  };
}

export function plannerService(
  connection: Connection,
  config: Config,
  trips: ReturnType<typeof tripService>,
  explore: ReturnType<typeof exploreService>,
  generate: Generate = geminiProvider(config),
) {
  const opts = {
    strict: 'throw' as const,
    timestamps: true,
    versionKey: false as const,
    autoIndex: false,
    autoCreate: false,
  };
  const runSchema = new Schema(
    {
      schemaVersion: { type: Number, default: 1 },
      provider: { type: String, enum: ['gemini'], default: 'gemini' },
      runId: { type: String, required: true },
      userId: { type: Schema.Types.ObjectId, required: true },
      key: { type: String, required: true },
      requestHash: String,
      requestId: String,
      tripId: String,
      expectedRevision: Number,
      model: String,
      promptVersion: String,
      plannerVersion: String,
      status: {
        type: String,
        enum: ['pending', 'succeeded', 'failed', 'unknown'],
        required: true,
      },
      errorCode: String,
      quotaState: {
        type: String,
        enum: ['reserved', 'consumed', 'released', 'uncertain'],
      },
      inputSummary: {
        destinationId: String,
        days: Number,
        travelers: Number,
        pace: String,
      },
      sources: { type: [String], validate: (v: string[]) => v.length <= 30 },
      proposal: {
        type: Schema.Types.Mixed,
        validate: (v: PlannerProposal | undefined) =>
          !v ||
          (tripInputSchema.safeParse(v.trip).success &&
            v.warnings.length <= 5 &&
            v.warnings.every((w) => w.length <= 500) &&
            JSON.stringify(v).length <= 200000),
      },
      finishedAt: Date,
    },
    { ...opts, collection: 'ai_runs' },
  );
  runSchema.index({ runId: 1 }, { unique: true });
  runSchema.index({ userId: 1, key: 1 }, { unique: true });
  runSchema.index({ status: 1, createdAt: 1 });
  const bucketSchema = new Schema(
    {
      schemaVersion: { type: Number, default: 1 },
      scope: { type: String, required: true },
      date: { type: String, required: true },
      count: { type: Number, default: 0 },
    },
    { ...opts, collection: 'usage_buckets' },
  );
  bucketSchema.index({ scope: 1, date: 1 }, { unique: true });
  const Run = connection.model('AiRun', runSchema),
    Bucket = connection.model('AiUsageBucket', bucketSchema);
  async function cached(owner: Types.ObjectId, key: string, hash: string) {
    const run = await Run.findOne({ userId: owner, key });
    if (!run) return null;
    if (run.requestHash !== hash)
      throw new HttpError(
        409,
        'IDEMPOTENCY_CONFLICT',
        'Yêu cầu AI đã đổi. Hãy tạo lượt mới.',
      );
    if (run.status === 'succeeded') return run.proposal as PlannerProposal;
    throw new HttpError(
      409,
      'AI_RUN_UNAVAILABLE',
      run.status === 'pending'
        ? 'Goe đang xử lý lượt này. Chờ một chút rồi thử lại để lấy kết quả.'
        : 'Lượt AI này không hoàn tất. Bạn có thể tạo lượt mới hoặc tự xếp lịch.',
    );
  }
  return {
    models: { Run, Bucket },
    async chat(
      owner: Types.ObjectId,
      tripId: string,
      value: GoeRequest,
      key: string,
    ): Promise<GoeProposal> {
      const { trip: stored } = await trips.read(tripId, owner);
      const trip = tripInputSchema.parse({
        title: stored.title,
        destinations: stored.destinations,
        startDate: stored.startDate,
        endDate: stored.endDate,
        timezone: stored.timezone,
        travelers: stored.travelers,
        budget: stored.budget,
        preferences: stored.preferences,
        generationMode: stored.generationMode,
        ...(stored.aiRunId ? { aiRunId: stored.aiRunId } : {}),
        days: stored.days,
        notes: stored.notes,
      });
      const proposal = await this.propose(
        owner,
        {
          trip,
          tripId,
          expectedRevision: value.expectedRevision,
          consent: true,
          adjustment: value,
        },
        key,
      );
      return proposal as GoeProposal;
    },
    async apply(
      owner: Types.ObjectId,
      tripId: string,
      runId: string,
      expectedRevision: number,
      key: string,
    ) {
      const run = await Run.findOne({
        runId,
        userId: owner,
        tripId,
        status: 'succeeded',
        promptVersion: 'goe-v1',
      });
      if (!run || run.expectedRevision !== expectedRevision)
        throw new HttpError(
          409,
          'AI_PROPOSAL_STALE',
          'Đề xuất không còn phù hợp. Hãy tải lại chuyến đi và hỏi Goe lần nữa.',
        );
      return trips.save(
        owner,
        tripInputSchema.parse(run.proposal.trip),
        expectedRevision,
        key,
        tripId,
      );
    },
    async reconcile() {
      // A crashed/timed-out call may have been billed. Keep the reservation counted.
      await Run.updateMany(
        { status: 'pending', createdAt: { $lt: new Date(Date.now() - 90000) } },
        {
          $set: {
            status: 'unknown',
            quotaState: 'uncertain',
            errorCode: 'AI_OUTCOME_UNKNOWN',
            finishedAt: new Date(),
          },
        },
      );
    },
    async propose(
      owner: Types.ObjectId,
      input: PlannerRequest & { adjustment?: GoeRequest },
      key: string,
    ): Promise<PlannerProposal> {
      if (!config.GEMINI_API_KEY)
        throw new HttpError(
          503,
          'AI_NOT_CONFIGURED',
          'Goe AI chưa được cấu hình. Bạn vẫn có thể tự xếp lịch.',
        );
      if (
        input.trip.destinations[0]?.destinationId !==
          '000000000000000000000004' ||
        input.trip.days.length > 7
      )
        throw new HttpError(
          400,
          'AI_SCOPE',
          'Goe AI hiện hỗ trợ Hội An từ 1–7 ngày. Chuyến dài hơn vẫn có thể tự xếp lịch.',
        );
      const hash = tokenHash(JSON.stringify(input));
      const prior = await cached(owner, key, hash);
      if (prior) return prior;
      if (input.tripId) {
        const current = await trips.read(input.tripId, owner);
        if (current.trip.revision !== input.expectedRevision)
          throw new HttpError(
            409,
            'REVISION_CONFLICT',
            'Chuyến đi đã thay đổi. Tải bản mới trước khi nhờ Goe.',
          );
      }
      const { items } = await explore.list({
        destinationId: input.trip.destinations[0]!.destinationId,
        limit: 30,
      });
      const places = items.filter((p) => p.planning);
      const selected = input.adjustment
        ? input.trip.days.find((d) => d.dayId === input.adjustment!.dayId)
        : undefined;
      if (input.adjustment && !selected)
        throw new HttpError(
          400,
          'INVALID_DAY',
          'Ngày đang xem không còn trong chuyến đi.',
        );
      if (!places.length)
        throw new HttpError(
          503,
          'AI_CATALOG_EMPTY',
          'Chưa có địa điểm đủ dữ liệu cho Goe.',
        );
      const date = new Date().toISOString().slice(0, 10),
        scopes = ['global', owner.toHexString()];
      for (const scope of scopes) {
        try {
          await Bucket.updateOne(
            { scope, date },
            { $setOnInsert: { count: 0 } },
            { upsert: true },
          );
        } catch (e) {
          if (!(e instanceof Error && 'code' in e && e.code === 11000)) throw e;
        }
      }
      const runId = randomUUID();
      try {
        await connection.transaction(async (session) => {
          for (const scope of scopes) {
            const limit =
              scope === 'global'
                ? config.AI_DAILY_GLOBAL_LIMIT
                : config.AI_DAILY_USER_LIMIT;
            const result = await Bucket.updateOne(
              { scope, date, count: { $lt: limit } },
              { $inc: { count: 1 } },
              { session },
            );
            if (!result.modifiedCount)
              throw new HttpError(
                429,
                'AI_QUOTA',
                'Đã hết lượt Goe AI hôm nay. Bạn vẫn có thể tự xếp lịch.',
              );
          }
          await new Run({
            runId,
            userId: owner,
            key,
            requestHash: hash,
            requestId: requestId(),
            tripId: input.tripId,
            expectedRevision: input.expectedRevision,
            model: config.GEMINI_MODEL,
            promptVersion: input.adjustment ? 'goe-v1' : 'hoian-v1',
            plannerVersion: '1',
            status: 'pending',
            quotaState: 'reserved',
            inputSummary: {
              destinationId: input.trip.destinations[0]!.destinationId,
              days: input.trip.days.length,
              travelers: input.trip.travelers.totalCount,
              pace: input.trip.preferences.pace,
            },
            sources: places.map((p) => p.id),
          }).save({ session });
        });
      } catch (e) {
        if (e instanceof Error && 'code' in e && e.code === 11000) {
          const existing = await cached(owner, key, hash);
          if (existing) return existing;
        }
        throw e;
      }
      let proposal: PlannerProposal;
      try {
        const result = await generate({
          destination: 'Hội An',
          dates: selected
            ? [selected.date]
            : input.trip.days.map((d) => d.date),
          ...(selected
            ? {
                adjustment: {
                  request: input.adjustment!.message,
                  currentStops: selected.activities.map((a) => ({
                    placeId: a.placeId ?? null,
                    start: a.startLocalTime,
                    end: a.endLocalTime,
                    locked: !places.some((p) => p.id === a.placeId),
                  })),
                  instruction:
                    'Modify ONLY this day according to the request. Preserve unchanged stops. Locked stops are retained by the server; do not overlap them and do not include them in output. If request is unsupported (weather facts, guaranteed savings, unavailable places), keep current eligible stops. For slower pace reduce stops or spread them out. Never claim real weather, prices or savings. Output only supplied catalog IDs.',
                },
              }
            : {}),
          travelers: input.trip.travelers.totalCount,
          budget: input.trip.budget,
          preferences: input.trip.preferences,
          catalog: places.map((p) => ({
            id: p.id,
            name: p.name,
            category: p.category,
            durationMinutes: p.planning!.durationMinutes,
            location: p.planning!.locationQuery,
          })),
        });
        if (selected) {
          const single = {
            ...input,
            trip: {
              ...input.trip,
              startDate: selected.date,
              endDate: selected.date,
              days: [selected],
            },
          };
          const generated = validatePlan(result, single, places, runId);
          const kept = selected.activities.filter(
            (a) => !places.some((p) => p.id === a.placeId),
          );
          const activities = [
            ...generated.trip.days[0]!.activities.map((a) => {
              const previous = selected.activities.find(
                (old) => old.placeId === a.placeId,
              );
              return previous
                ? {
                    ...previous,
                    startLocalTime: a.startLocalTime,
                    endLocalTime: a.endLocalTime,
                  }
                : a;
            }),
            ...kept,
          ]
            .sort((a, b) =>
              (a.startLocalTime ?? '99:99').localeCompare(
                b.startLocalTime ?? '99:99',
              ),
            )
            .map((a, order) => ({ ...a, order }));
          let end = '';
          for (const a of activities)
            if (a.startLocalTime && a.endLocalTime) {
              if (a.startLocalTime < end)
                throw new Error('Locked activity overlap');
              end = a.endLocalTime;
            }
          const trip = tripInputSchema.parse({
            ...input.trip,
            generationMode: 'ai',
            aiRunId: runId,
            days: input.trip.days.map((d) =>
              d.dayId === selected.dayId ? { ...d, activities } : d,
            ),
          });
          proposal = {
            ...generated,
            trip,
            budget: calculateBudget(trip),
            baseRevision: input.expectedRevision!,
            dayId: selected.dayId,
            before: selected,
            warnings: [
              'Chỉ điều chỉnh ngày đã chọn; các ngày khác giữ nguyên. Giá và ghi chú của điểm giữ lại được bảo toàn.',
              'Goe chưa có dữ liệu thời tiết, giờ mở cửa hoặc giá trực tiếp. Không bảo đảm tiết kiệm khi còn khoản chưa rõ. Điểm mới chưa có giá cần bạn bổ sung.',
            ],
          } as GoeProposal;
        } else proposal = validatePlan(result, input, places, runId);
      } catch (e) {
        const code = e instanceof HttpError ? e.code : 'AI_INVALID_OUTPUT';
        const rejected = code === 'AI_PROVIDER_REJECTED',
          unknown = code === 'AI_OUTCOME_UNKNOWN';
        await connection.transaction(async (session) => {
          await Run.updateOne(
            { runId, status: 'pending' },
            {
              $set: {
                status: unknown ? 'unknown' : 'failed',
                quotaState: rejected
                  ? 'released'
                  : unknown
                    ? 'uncertain'
                    : 'consumed',
                errorCode: code,
                finishedAt: new Date(),
              },
            },
            { session },
          );
          if (rejected)
            for (const scope of scopes)
              await Bucket.updateOne(
                { scope, date, count: { $gt: 0 } },
                { $inc: { count: -1 } },
                { session },
              );
        });
        if (e instanceof HttpError) throw e;
        throw new HttpError(
          502,
          'AI_INVALID_OUTPUT',
          'Đề xuất chưa đạt kiểm tra lịch trình. Chưa thay đổi dữ liệu; hãy thử lượt mới hoặc tự xếp lịch.',
        );
      }
      const finished = await Run.updateOne(
        { runId, status: 'pending' },
        {
          $set: {
            status: 'succeeded',
            quotaState: 'consumed',
            proposal,
            finishedAt: new Date(),
          },
        },
        { runValidators: true },
      );
      if (!finished.modifiedCount)
        throw new HttpError(
          409,
          'AI_RUN_UNAVAILABLE',
          'Lượt AI này đã hết thời gian xử lý. Lịch trình cũ vẫn được giữ.',
        );
      return proposal;
    },
  };
}
