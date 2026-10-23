import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { PlannerRequest, PlaceDto } from '@goease/contracts';
import { validatePlan } from '../src/features/ai/planner.js';
import { geminiProvider } from '../src/features/ai/gemini.js';
import { parseConfig } from '../src/config.js';
import { HttpError } from '../src/http-error.js';
import { rescheduleDates } from '../src/features/ai/reschedule.js';
import {
  arrangeCompleteDays,
  eligibleForPlanner,
  itineraryPolicy,
  outsideKnownHours,
  plannerCatalog,
} from '../src/features/ai/itinerary-policy.js';
const destinationId = '000000000000000000000004',
  placeId = '100000000000000000000001';
const input: PlannerRequest = {
  consent: true,
  trip: {
    title: 'Private title',
    destinations: [{ destinationId, order: 0 }],
    startDate: '2026-11-12',
    endDate: '2026-11-12',
    timezone: 'Asia/Ho_Chi_Minh',
    travelers: { totalCount: 4 },
    budget: {
      amountMinor: 1000000,
      currency: 'VND',
      scope: 'group_total',
      includedCategories: [],
    },
    preferences: {
      interestCodes: ['culture'],
      pace: 'balanced',
      transportModes: [],
    },
    generationMode: 'manual',
    notes: 'Private notes',
    days: [
      {
        dayId: randomUUID(),
        date: '2026-11-12',
        destinationId,
        activities: [],
      },
    ],
  },
};
const place: PlaceDto = {
  id: placeId,
  destinationId,
  destinationName: 'Hội An',
  name: 'Phố cổ Hội An',
  slug: 'pho-co',
  category: 'culture',
  subtitle: '',
  description: '',
  imageUrl: '/images/explore-hoian.png',
  durationLabel: '',
  travelLabel: '',
  bestTimeLabel: '',
  tip: '',
  highlights: [],
  sourceUrl: 'https://example.invalid',
  imageCredit: 'fixture',
  planning: {
    durationMinutes: 120,
    locationQuery: 'Hội An',
    costNote: 'fixture',
    priceOptions: [],
  },
};
const valid = () => ({
  days: [
    { date: '2026-11-12', stops: [{ placeId, start: '09:00', end: '11:00' }] },
  ],
});
test('date changes replace closed places, keep identities and private edits, and never fabricate prices', () => {
  const trip = validatePlan(valid(), input, [place], randomUUID()).trip;
  trip.days[0]!.activities[0]!.notes = 'Ghi chú riêng';
  const closed = {
    ...place,
    openingHoursNote: '07:30–21:30; đóng cửa ngày 03 và 16 hằng tháng',
  };
  const alternate = {
    ...place,
    id: '100000000000000000000002',
    name: 'Điểm thay thế',
    openingHoursNote: '08:00–18:00',
  };
  const before = JSON.stringify(trip);
  const result = rescheduleDates(trip, '2026-11-16', '2026-11-16', [
    closed,
    alternate,
  ]);
  const a = result.trip.days[0]!.activities[0]!;
  assert.equal(a.placeId, alternate.id);
  assert.equal(a.activityId, trip.days[0]!.activities[0]!.activityId);
  assert.match(a.notes, /Ghi chú riêng/);
  assert.equal(a.estimatedCost.amountMinor, null);
  assert.equal(result.changes.length, 1);
  assert.equal(JSON.stringify(trip), before);
  assert.throws(
    () => rescheduleDates(trip, '2026-11-16', '2026-11-16', [closed]),
    /Lịch cũ vẫn được giữ/,
  );
  assert.equal(JSON.stringify(trip), before);
});
test('date changes move time within hours while preserving costs; fixed appointments remain intact', () => {
  const trip = validatePlan(valid(), input, [place], randomUUID()).trip;
  trip.days[0]!.activities[0]!.estimatedCost.amountMinor = 123000;
  const later = { ...place, openingHoursNote: '10:00–17:00' };
  const result = rescheduleDates(trip, '2026-11-13', '2026-11-13', [later]);
  assert.equal(result.trip.days[0]!.activities[0]!.startLocalTime, '10:00');
  assert.equal(
    result.trip.days[0]!.activities[0]!.estimatedCost.amountMinor,
    123000,
  );
  trip.days[0]!.activities.push({
    ...trip.days[0]!.activities[0]!,
    activityId: randomUUID(),
    placeId: undefined,
    source: 'manual',
    title: 'Hẹn riêng',
    startLocalTime: '12:00',
    endLocalTime: '13:00',
    order: 1,
  });
  assert.throws(
    () => rescheduleDates(trip, '2026-11-13', '2026-11-13', [later]),
    /Lịch cũ vẫn được giữ/,
  );
});
test('hours handle weekly closures, split shifts, overnight and unknown notes', () => {
  assert.equal(
    outsideKnownHours(
      {
        ...place,
        openingHoursNote: 'Nghỉ thứ Năm/thứ Sáu; giờ chưa thống nhất',
      },
      '2026-11-13',
      600,
      660,
    ),
    true,
  );
  assert.equal(
    outsideKnownHours(
      { ...place, openingHoursNote: '08:00–11:00; 14:00–20:00' },
      '2026-11-13',
      720,
      780,
    ),
    true,
  );
  assert.equal(
    outsideKnownHours(
      { ...place, openingHoursNote: '18:00–02:00' },
      '2026-11-13',
      1140,
      1200,
    ),
    false,
  );
  assert.equal(
    outsideKnownHours(
      { ...place, openingHoursNote: 'Chưa xác minh' },
      '2026-11-13',
      600,
      660,
    ),
    false,
  );
});
test('planner uses catalog titles and unknown prices, validates dates IDs duration and duplicate stops', () => {
  const runId = randomUUID();
  const proposal = validatePlan(valid(), input, [place], runId);
  assert.equal(proposal.trip.aiRunId, runId);
  assert.equal(proposal.trip.days[0]!.activities[0]!.title, place.name);
  assert.equal(
    proposal.trip.days[0]!.activities[0]!.estimatedCost.amountMinor,
    null,
  );
  assert.equal(proposal.budget.missingCostCount, 1);
  assert.equal(input.trip.days[0]!.activities.length, 0);
  for (const mutation of [
    (p: ReturnType<typeof valid>) => {
      p.days[0]!.date = '2026-11-13';
    },
    (p: ReturnType<typeof valid>) => {
      p.days[0]!.stops[0]!.placeId = '100000000000000000000099';
    },
    (p: ReturnType<typeof valid>) => {
      p.days[0]!.stops[0]!.end = '10:00';
    },
    (p: ReturnType<typeof valid>) => {
      p.days[0]!.stops.push({
        ...p.days[0]!.stops[0]!,
        start: '12:00',
        end: '14:00',
      });
    },
    (p: ReturnType<typeof valid>) => {
      p.days[0]!.stops[0]!.start = '06:00';
    },
  ]) {
    const bad = valid();
    mutation(bad);
    assert.throws(() => validatePlan(bad, input, [place], randomUUID()));
  }
  assert.throws(() =>
    validatePlan(
      valid(),
      input,
      [{ ...place, destinationId: '000000000000000000000001' }],
      randomUUID(),
    ),
  );
});
test('Gemini failures remain sanitized; malformed/blocked output never becomes success', async () => {
  const config = parseConfig({
    NODE_ENV: 'test',
    CLIENT_ORIGIN: 'http://localhost:5180',
    MONGODB_URI: 'mongodb://localhost/test',
    GEMINI_API_KEY: 'test-only-key',
  });
  for (const [status, code] of [
    [429, 'AI_PROVIDER_REJECTED'],
    [503, 'AI_OUTCOME_UNKNOWN'],
  ] as const) {
    const stub = mock.method(
      globalThis,
      'fetch',
      async () => new Response('sensitive provider detail', { status }),
    );
    try {
      await assert.rejects(
        geminiProvider(config)({}),
        (e) =>
          e instanceof HttpError &&
          e.code === code &&
          !e.message.includes('sensitive'),
      );
    } finally {
      stub.mock.restore();
    }
  }
  for (const body of [
    { candidates: [] },
    { candidates: [{ finishReason: 'SAFETY' }] },
    {
      candidates: [
        {
          finishReason: 'STOP',
          content: { parts: [{ text: 'invalid json' }] },
        },
      ],
    },
  ]) {
    const stub = mock.method(globalThis, 'fetch', async () =>
      Response.json(body),
    );
    try {
      await assert.rejects(
        geminiProvider(config)({}),
        (e) => e instanceof HttpError && e.code === 'AI_INVALID_OUTPUT',
      );
    } finally {
      stub.mock.restore();
    }
  }
});

test('planner explains pace and timing constraints without accepting invalid proposals', () => {
  const relaxed = structuredClone(input);
  relaxed.trip.preferences.pace = 'relaxed';
  const places = [
    place,
    { ...place, id: '100000000000000000000002' },
    { ...place, id: '100000000000000000000003' },
  ];
  const crowded = {
    days: [
      {
        date: relaxed.trip.startDate,
        stops: places.map((p, i) => ({
          placeId: p.id,
          start: `${9 + i * 3}`.padStart(2, '0') + ':00',
          end: `${11 + i * 3}:00`,
        })),
      },
    ],
  };
  assert.throws(
    () => validatePlan(crowded, relaxed, places, randomUUID(), true),
    (e) =>
      e instanceof HttpError &&
      e.code === 'AI_PACE_LIMIT' &&
      e.message.includes('2 điểm'),
  );
  const tooShort = valid();
  tooShort.days[0]!.stops[0]!.end = '10:00';
  assert.throws(
    () => validatePlan(tooShort, input, [place], randomUUID()),
    (e) => e instanceof HttpError && e.code === 'AI_SCHEDULE_CONFLICT',
  );
  assert.equal(input.trip.days[0]!.activities.length, 0);
});

test('complete Hoi An days need no budget, include meals, keep unknown prices and reject repeated visits', () => {
  const request = structuredClone(input);
  request.trip.budget.amountMinor = null;
  const catalog: PlaceDto[] = Array.from({ length: 6 }, (_, i) => ({
    ...place,
    id: `20000000000000000000000${i}`,
    name: `Catalog ${i}`,
    category: i < 4 ? 'culture' : 'food',
    venueType: i < 4 ? 'place' : 'restaurant',
    planning: { ...place.planning!, durationMinutes: 60 },
  }));
  const plan = {
    days: [
      {
        date: request.trip.startDate,
        stops: [
          { placeId: catalog[0]!.id, start: '09:00', end: '10:00' },
          { placeId: catalog[4]!.id, start: '12:00', end: '13:00' },
          { placeId: catalog[1]!.id, start: '15:00', end: '16:00' },
          { placeId: catalog[5]!.id, start: '18:00', end: '19:00' },
        ],
      },
    ],
  };
  const result = validatePlan(plan, request, catalog, randomUUID());
  assert.equal(result.trip.budget.amountMinor, null);
  assert.equal(result.budget.missingCostCount, 4);
  assert.equal(
    itineraryPolicy({ ...request, trip: result.trip }, true).maxStops,
    4,
  );
  assert.ok(
    result.trip.days[0]!.activities.every(
      (a) => a.estimatedCost.amountMinor === null,
    ),
  );
  assert.equal(itineraryPolicy(request).maxStops, 5);
  const noDinner = structuredClone(plan);
  noDinner.days[0]!.stops.pop();
  assert.throws(() => validatePlan(noDinner, request, catalog, randomUUID()));
  request.trip.endDate = '2026-11-13';
  request.trip.days.push({
    ...request.trip.days[0]!,
    date: '2026-11-13',
    dayId: randomUUID(),
  });
  plan.days.push({ ...structuredClone(plan.days[0]!), date: '2026-11-13' });
  assert.throws(
    () => validatePlan(plan, request, catalog, randomUUID()),
    /lặp điểm/,
  );
});

test('planner uses editorial hours and excludes food ideas and test data without guessing unknown hours', () => {
  const museum = {
    ...place,
    openingHoursNote: '07:30–21:30; đóng cửa ngày 11 và 26 hằng tháng.',
  };
  assert.equal(outsideKnownHours(museum, '2026-11-11', 540, 600), true);
  assert.equal(outsideKnownHours(museum, '2026-11-12', 540, 600), false);
  assert.equal(outsideKnownHours(museum, '2026-11-12', 1260, 1320), true);
  assert.equal(
    outsideKnownHours(
      {
        ...place,
        openingHoursNote: 'Chưa xác minh giờ hiện hành: 07:00–17:00',
      },
      '2026-11-12',
      1080,
      1140,
    ),
    false,
  );
  assert.equal(
    eligibleForPlanner({ ...place, name: '[TEST] Quán thử' }),
    false,
  );
  assert.equal(eligibleForPlanner({ ...place, venueType: 'food_idea' }), false);
  assert.equal(
    eligibleForPlanner({ ...place, openingHoursNote: 'Tạm đóng cửa' }),
    false,
  );
  const data = plannerCatalog([museum])[0]!;
  assert.equal(data.openingHoursNote, museum.openingHoursNote);
  assert.equal(data.referenceCost.amountMinor, null);
});

test('server arranges full days from AI choices, avoids monthly closures and preserves unknown money', () => {
  const request = structuredClone(input);
  request.trip.budget.amountMinor = null;
  const catalog: PlaceDto[] = Array.from({ length: 8 }, (_, i) => ({
    ...place,
    id: `30000000000000000000000${i}`,
    name: i < 6 ? `Visit ${i}` : `Restaurant ${i}`,
    category: i < 6 ? 'culture' : 'food',
    venueType: i < 6 ? 'place' : 'restaurant',
    planning: { ...place.planning!, durationMinutes: 60 },
    openingHoursNote:
      i === 0
        ? '09:00–17:00; đóng cửa ngày 12 và 26 hằng tháng.'
        : '09:00–21:00',
  }));
  request.trip.endDate = '2026-11-13';
  request.trip.days.push({
    ...request.trip.days[0]!,
    dayId: randomUUID(),
    date: '2026-11-13',
  });
  const raw = {
    days: request.trip.days.map((d) => ({
      date: d.date,
      stops: [{ placeId: catalog[0]!.id, start: '01:00', end: '01:01' }],
    })),
  };
  const arranged = arrangeCompleteDays(raw, request, catalog);
  assert.ok(!arranged.days[0]!.stops.some((s) => s.placeId === catalog[0]!.id));
  const result = validatePlan(arranged, request, catalog, randomUUID());
  assert.equal(result.trip.days.length, 2);
  assert.ok(result.trip.days.every((d) => d.activities.length >= 4));
  assert.equal(result.budget.missingCostCount, result.budget.activityCount);
  assert.equal(result.trip.budget.amountMinor, null);
  const wrong = structuredClone(raw);
  wrong.days[0]!.stops[0]!.placeId = 'ffffffffffffffffffffffff';
  assert.throws(() => arrangeCompleteDays(wrong, request, catalog));
});
