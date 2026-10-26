import { randomUUID } from 'node:crypto';
import { rescheduleDates } from './reschedule.js';
import type { RescheduleRequest, RescheduleResult } from '@goease/contracts';
import { catalogCost, plannerTiming } from '@goease/contracts';
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
import {
  arrangeCompleteDays,
  eligibleForPlanner,
  itineraryPolicy,
  outsideKnownHours,
  plannerCatalog,
  mealSuitable,
  cafeSuitable,
  selectPlannerCandidates,
} from './itinerary-policy.js';
import type { tripService } from '../trips/trip.service.js';
import type { exploreService } from '../explore/explore.service.js';
import {
  plannerProvider,
  generatedPlanSchema,
  type Generate,
} from './gemini.js';

export function validatePlan(
  raw: unknown,
  input: PlannerRequest,
  places: PlaceDto[],
  runId: string,
  adjustment = false,
): PlannerProposal {
  const plan = generatedPlanSchema.parse(raw);
  const { maxStops } = itineraryPolicy(input, adjustment);
  const visited = new Set<string>();
  const fullCatalog =
    places.filter((p) => p.category !== 'food').length >= 2 &&
    places.filter(mealSuitable).length >= 2;
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
    if (!adjustment && fullCatalog) {
      const meals = day.stops.filter((s) => {
        const place = places.find((p) => p.id === s.placeId);
        return place && mealSuitable(place);
      });
      const lunch = meals.some(
        (s) => minutes(s.start) >= 660 && minutes(s.start) <= 840,
      );
      const dinner = meals.some(
        (s) => minutes(s.start) >= 1020 && minutes(s.start) <= 1200,
      );
      if (
        day.stops.length < 4 ||
        !lunch ||
        !dinner ||
        day.stops.filter(
          (s) => places.find((p) => p.id === s.placeId)?.category !== 'food',
        ).length < 2
      )
        throw new HttpError(
          502,
          'AI_INVALID_OUTPUT',
          'Goe chưa xếp đủ điểm tham quan và bữa ăn cho chuyến này. Hãy thử lại; lựa chọn của bạn vẫn được giữ.',
        );
    }
    if (day.stops.length > maxStops)
      throw new HttpError(
        502,
        'AI_PACE_LIMIT',
        `Goe chưa xếp được yêu cầu trong nhịp độ đã chọn (tối đa ${maxStops} điểm mỗi ngày). Hãy yêu cầu đổi một điểm thay vì thêm, hoặc đổi nhịp độ trong thông tin chuyến đi. Lịch cũ vẫn được giữ.`,
      );
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
          !eligibleForPlanner(place, input.trip.travelers.totalCount) ||
          seen.has(stop.placeId)
        )
          throw new HttpError(
            502,
            'AI_INVALID_OUTPUT',
            'Goe chưa chọn được các địa điểm phù hợp. Hãy thử đổi một điểm trong ngày hoặc chọn từ gợi ý. Lịch cũ vẫn được giữ.',
          );
        if (outsideKnownHours(place, day.date, start, finish))
          throw new HttpError(
            502,
            'AI_SCHEDULE_CONFLICT',
            'Lịch gợi ý chưa khớp giờ hoạt động đã có. Chưa thay đổi chuyến đi; hãy thử lại.',
          );
        if (!adjustment && place.category !== 'food' && visited.has(place.id))
          throw new HttpError(
            502,
            'AI_INVALID_OUTPUT',
            'Goe đang lặp điểm tham quan giữa các ngày. Chưa thay đổi chuyến đi; hãy thử lại.',
          );
        visited.add(place.id);
        if (
          start < end + 30 ||
          finish > 1320 ||
          finish - start < place.planning.durationMinutes
        )
          throw new HttpError(
            502,
            'AI_SCHEDULE_CONFLICT',
            'Goe chưa xếp được giờ phù hợp: cần đủ thời gian tham quan và ít nhất 30 phút giữa các điểm. Thử bớt hoặc đổi một điểm; lịch cũ vẫn được giữ.',
          );
        seen.add(stop.placeId);
        end = finish;
        return {
          activityId: randomUUID(),
          placeId: place.id,
          kind: cafeSuitable(place)
            ? ('free_time' as const)
            : place.category === 'food'
              ? ('meal' as const)
              : ('visit' as const),
          title: place.name,
          startLocalTime: stop.start,
          endLocalTime: stop.end,
          timezone: 'Asia/Ho_Chi_Minh' as const,
          order,
          notes: [place.planning.locationQuery, place.openingHoursNote]
            .filter(Boolean)
            .join('\n')
            .slice(0, 500),
          source: 'ai' as const,
          estimatedCost: catalogCost(place),
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
      'Lịch dành cho ngày trọn vẹn, có khoảng nghỉ giữa các điểm. Giờ di chuyển là ước tính; hãy điều chỉnh ngày đầu/cuối theo giờ đến và giờ về.',
      'Dự toán tự dùng giá tham khảo đã biên tập khi có. Các khoản thiếu giá, chỗ ở và di chuyển chưa thêm chưa nằm trong tổng; đây không phải báo giá đặt dịch vụ.',
      'Giờ hoạt động dùng thông tin hiện có; chưa có kiểm tra thời tiết hoặc tình trạng nhận khách trực tiếp.',
    ],
  };
}

export function plannerService(
  connection: Connection,
  config: Config,
  trips: ReturnType<typeof tripService>,
  explore: ReturnType<typeof exploreService>,
  generate: Generate = plannerProvider(config),
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
      provider: {
        type: String,
        enum: ['gemini', 'fulldichvu', 'catalog'],
        default: 'gemini',
      },
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
  // Scan published data only, balancing visits and meals before the 30-ID provider cap.
  async function candidates(input: Pick<PlannerRequest, 'trip'>) {
    const visits: PlaceDto[] = [],
      meals: PlaceDto[] = [],
      cafes: PlaceDto[] = [],
      other: PlaceDto[] = [];
    for (let offset = 0; offset < 1000; offset += 30) {
      const page = await explore.list({
        destinationId: input.trip.destinations[0]!.destinationId,
        limit: 30,
        offset,
      });
      for (const p of page.items) {
        if (!eligibleForPlanner(p, input.trip.travelers.totalCount)) continue;
        const pool =
          p.category !== 'food'
            ? visits
            : mealSuitable(p)
              ? meals
              : cafeSuitable(p)
                ? cafes
                : other;
        if (pool.length < 30) pool.push(p);
      }
      if (
        !page.hasMore ||
        (visits.length >= 20 && meals.length >= 10 && cafes.length >= 2)
      )
        break;
    }
    return selectPlannerCandidates({ visits, meals, cafes, other });
  }
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
      run.status === 'pending' ? 'AI_RUN_PENDING' : 'AI_RUN_FAILED',
      run.status === 'pending'
        ? 'Goe đang xử lý lượt này. Chờ một chút rồi thử lại để lấy kết quả.'
        : 'Lượt AI này không hoàn tất. Bạn có thể tạo lượt mới hoặc tự xếp lịch.',
    );
  }
  return {
    models: { Run, Bucket },
    async reschedule(
      owner: Types.ObjectId,
      input: RescheduleRequest,
    ): Promise<RescheduleResult> {
      if (input.tripId) {
        const current = await trips.read(input.tripId, owner);
        if (current.trip.revision !== input.expectedRevision)
          throw new HttpError(
            409,
            'REVISION_CONFLICT',
            'Chuyến đi đã thay đổi. Hãy tải bản mới trước khi đổi ngày.',
          );
      }
      if (input.trip.generationMode === 'ai') {
        const source = await Run.findOne({
          runId: input.trip.aiRunId ?? '',
          userId: owner,
          status: 'succeeded',
        });
        if (!source || (source.tripId && source.tripId !== input.tripId))
          throw new HttpError(
            409,
            'AI_PROPOSAL_STALE',
            'Không tìm thấy lịch gốc của bạn. Hãy tải lại chuyến đi.',
          );
        const links = new Set(
          tripInputSchema
            .parse(source.proposal.trip)
            .days.flatMap((d) =>
              d.activities.map((a) => `${a.activityId}:${a.placeId}`),
            ),
        );
        if (
          input.trip.days.some((d) =>
            d.activities.some(
              (a) =>
                a.source === 'ai' && !links.has(`${a.activityId}:${a.placeId}`),
            ),
          )
        )
          throw new HttpError(
            400,
            'INVALID_AI_SOURCE',
            'Nguồn hoạt động AI không hợp lệ.',
          );
      }
      const items = await candidates(input);
      let result: RescheduleResult;
      try {
        result = rescheduleDates(
          input.trip,
          input.startDate,
          input.endDate,
          items,
        );
      } catch (e) {
        if (e instanceof HttpError) throw e;
        throw new HttpError(
          400,
          'INVALID_DATE_CHANGE',
          e instanceof Error ? e.message : 'Không thể đổi ngày.',
        );
      }
      if (input.trip.generationMode === 'ai') {
        const runId = randomUUID();
        result.trip.aiRunId = runId;
        await Run.create({
          runId,
          userId: owner,
          key: randomUUID(),
          provider: 'catalog',
          ...(input.tripId
            ? {
                tripId: input.tripId,
                expectedRevision: input.expectedRevision!,
              }
            : {}),
          promptVersion: 'date-reschedule-v2',
          plannerVersion: '5',
          status: 'succeeded',
          quotaState: 'released',
          sources: items.map((p) => p.id),
          proposal: {
            runId,
            trip: result.trip,
            budget: calculateBudget(result.trip),
            warnings: [
              'Đã kiểm tra giờ hoạt động theo dữ liệu hiện có; nơi chưa có giờ xác minh vẫn chưa thể xác nhận.',
            ],
          },
          finishedAt: new Date(),
        });
      }
      return result;
    },
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
        promptVersion: {
          $in: ['goe-v1', 'goe-v2', 'goe-v3', 'goe-v4', 'goe-v5'],
        },
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
        {
          status: 'pending',
          createdAt: {
            $lt: new Date(Date.now() - plannerTiming.staleRunAfterMs),
          },
        },
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
      if (
        !(config.AI_PROVIDER === 'fulldichvu'
          ? config.FULLDICHVU_API_KEY
          : config.GEMINI_API_KEY)
      )
        throw new HttpError(
          503,
          'AI_NOT_CONFIGURED',
          'Goe AI chưa được cấu hình. Bạn vẫn có thể tự xếp lịch.',
        );
      if (
        !input.trip.destinations[0]?.destinationId ||
        input.trip.days.length > 7
      )
        throw new HttpError(
          400,
          'AI_SCOPE',
          'Goe hỗ trợ một điểm đến tại Việt Nam từ 1–7 ngày khi có đủ dữ liệu. Chuyến dài hơn vẫn có thể tự xếp lịch.',
        );
      const destination = await trips.models.Destination.findOne({
        _id: input.trip.destinations[0]!.destinationId,
        publicationStatus: 'published',
        catalogKind: { $ne: 'legacy' },
        deletedAt: null,
        $or: [{ countryCode: 'VN' }, { countryCode: { $exists: false } }],
      });
      if (!destination)
        throw new HttpError(
          400,
          'INVALID_DESTINATION',
          'Điểm đến không còn khả dụng tại Việt Nam. Hãy chọn lại điểm đến.',
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
      const places = await candidates(input);
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
      if (
        !input.adjustment &&
        (places.filter((p) => p.category !== 'food').length <
          input.trip.days.length * 2 ||
          places.filter(mealSuitable).length < 2)
      )
        throw new HttpError(
          409,
          'AI_CATALOG_COVERAGE',
          `${destination.name} chưa đủ địa điểm và bữa ăn có giá, điều kiện và giờ hoạt động rõ ràng cho chuyến này. Goe chưa tạo lịch hoặc sử dụng lượt AI.`,
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
            provider: config.AI_PROVIDER,
            model:
              config.AI_PROVIDER === 'fulldichvu'
                ? config.FULLDICHVU_MODEL
                : config.GEMINI_MODEL,
            promptVersion: input.adjustment
              ? 'goe-v5'
              : config.AI_PROVIDER === 'fulldichvu'
                ? 'vietnam-rank-v3'
                : 'vietnam-v2',
            plannerVersion: '5',
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
          selectionOnly: config.AI_PROVIDER === 'fulldichvu' && !selected,
          destination: destination.name,
          countryCode: 'VN',
          maxStopsPerDay: itineraryPolicy(
            selected
              ? { ...input, trip: { ...input.trip, days: [selected] } }
              : input,
            Boolean(selected),
          ).maxStops,
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
                    'Modify ONLY this day. Keep stops the user explicitly asks to keep. When adding a stop would exceed maxStopsPerDay, REPLACE a different eligible stop rather than exceeding the limit. Preserve the other stops when possible. Locked stops are retained by the server; do not overlap them and do not include them in output. If the request cannot fit, keep current eligible stops. For slower pace reduce stops or spread them out. Never claim real weather, prices or savings. Output only supplied catalog IDs. Check every duration and the 30-minute gaps before responding.',
                },
              }
            : {}),
          travelers: input.trip.travelers.totalCount,
          budget: input.trip.budget,
          preferences: input.trip.preferences,
          catalog: plannerCatalog(places),
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
          const generated = validatePlan(result, single, places, runId, true);
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
              'Goe kiểm tra giờ hoạt động đã có trong danh mục; chưa xác nhận thay đổi đột xuất hoặc thời tiết. Giá chưa xác minh vẫn để chưa rõ và chưa tính vào tổng đã biết.',
            ],
          } as GoeProposal;
        } else
          proposal = validatePlan(
            arrangeCompleteDays(result, input, places),
            input,
            places,
            runId,
          );
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
