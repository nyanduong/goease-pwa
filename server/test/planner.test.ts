import { images } from '@goease/media';
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  catalogToday,
  type PlannerRequest,
  type PlaceDto,
} from '@goease/contracts';
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
  cafeSuitable,
  selectPlannerCandidates,
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
  openingHoursNote: '07:00–22:00',
  referencePrice: {
    label: 'Vé kiểm thử',
    amountMinor: 20000,
    basis: 'per_person',
    maxTravelers: 10,
    conditions: 'Dữ liệu kiểm thử',
    inclusions: 'Vào cửa',
    exclusions: 'Dịch vụ khác',
    sourceUrl: 'https://example.invalid/price',
    checkedAt: catalogToday(),
    reviewAfter: '2099-12-31',
  },
  category: 'culture',
  subtitle: '',
  description: '',
  imageUrl: images.exploreHoian,
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

test('Goe rejects missing, stale, incomplete and oversized prices and unknown hours before selection', () => {
  assert.equal(eligibleForPlanner(place, 4), true);
  const invalid: PlaceDto[] = [
    { ...place, referencePrice: null },
    {
      ...place,
      referencePrice: { ...place.referencePrice!, reviewAfter: '2000-01-01' },
    },
    {
      ...place,
      referencePrice: { ...place.referencePrice!, inclusions: undefined },
    },
    { ...place, referencePrice: { ...place.referencePrice!, maxTravelers: 2 } },
    { ...place, referencePrice: { ...place.referencePrice!, minTravelers: 5 } },
    { ...place, openingHoursNote: 'Chưa xác minh: 08:00–17:00' },
    { ...place, openingHoursNote: '' },
  ];
  for (const candidate of invalid) {
    assert.equal(eligibleForPlanner(candidate, 4), false);
    assert.throws(() =>
      validatePlan(valid(), input, [candidate], randomUUID()),
    );
  }
  assert.equal(
    eligibleForPlanner(
      {
        ...place,
        referencePrice: { ...place.referencePrice!, amountMinor: 0 },
      },
      4,
    ),
    true,
  );
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
  assert.equal(a.estimatedCost.amountMinor, 20000);
  assert.equal(result.changes.length, 1);
  assert.equal(JSON.stringify(trip), before);
  assert.throws(
    () => rescheduleDates(trip, '2026-11-16', '2026-11-16', [closed]),
    /Lịch cũ vẫn được giữ/,
  );
  assert.equal(JSON.stringify(trip), before);
});
test('date changes preserve meal suitability instead of replacing lunch with a cafe', () => {
  const trip = validatePlan(valid(), input, [place], randomUUID()).trip;
  const activity = trip.days[0]!.activities[0]!;
  activity.kind = 'meal';
  activity.startLocalTime = '12:00';
  activity.endLocalTime = '13:00';
  const closed: PlaceDto = {
    ...place,
    category: 'food',
    venueType: 'restaurant',
    name: 'Restaurant closed',
    openingHoursNote: '09:00–21:00; nghỉ thứ năm',
    planning: { ...place.planning!, durationMinutes: 60 },
  };
  const cafe: PlaceDto = {
    ...closed,
    id: '100000000000000000000002',
    name: 'Coffee & Tea',
    openingHoursNote: '08:00–22:00',
  };
  const restaurant: PlaceDto = {
    ...cafe,
    id: '100000000000000000000003',
    name: 'Nhà hàng đang mở',
  };
  const result = rescheduleDates(trip, '2026-11-12', '2026-11-12', [
    closed,
    cafe,
    restaurant,
  ]);
  assert.equal(result.trip.days[0]!.activities[0]!.placeId, restaurant.id);
  assert.equal(
    result.trip.days[0]!.activities[0]!.estimatedCost.amountMinor,
    20000,
  );
  assert.equal(
    result.trip.days[0]!.activities[0]!.activityId,
    activity.activityId,
  );
  assert.throws(
    () => rescheduleDates(trip, '2026-11-12', '2026-11-12', [closed, cafe]),
    /Lịch cũ vẫn được giữ/,
  );
  activity.placeId = cafe.id;
  const repaired = rescheduleDates(trip, '2026-11-12', '2026-11-12', [
    cafe,
    restaurant,
  ]);
  assert.equal(repaired.trip.days[0]!.activities[0]!.placeId, restaurant.id);
});

test('date changes move time within hours while preserving costs; fixed appointments remain intact', () => {
  const trip = validatePlan(valid(), input, [place], randomUUID()).trip;
  trip.days[0]!.activities[0]!.estimatedCost = {
    amountMinor: 123000,
    basis: 'group_total',
    currency: 'VND',
    quantity: 1,
    confidence: 'user_entered',
  };
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
test('planner uses catalog titles and verified prices, validates dates IDs duration and duplicate stops', () => {
  const runId = randomUUID();
  const proposal = validatePlan(valid(), input, [place], runId);
  assert.equal(proposal.trip.aiRunId, runId);
  assert.equal(proposal.trip.days[0]!.activities[0]!.title, place.name);
  assert.equal(
    proposal.trip.days[0]!.activities[0]!.estimatedCost.amountMinor,
    20000,
  );
  assert.equal(proposal.budget.missingCostCount, 0);
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

test('complete Hoi An days need no budget, include meals, use verified prices and reject repeated visits', () => {
  const request = structuredClone(input);
  request.trip.budget.amountMinor = null;
  const catalog: PlaceDto[] = Array.from({ length: 6 }, (_, i) => ({
    ...place,
    id: `20000000000000000000000${i}`,
    name: i < 4 ? `Catalog ${i}` : `Restaurant ${i}`,
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
  assert.equal(result.budget.missingCostCount, 0);
  assert.equal(
    itineraryPolicy({ ...request, trip: result.trip }, true).maxStops,
    4,
  );
  assert.ok(
    result.trip.days[0]!.activities.every(
      (a) => a.estimatedCost.amountMinor === 20000,
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
  assert.equal(data.referenceCost.amountMinor, 20000);
  assert.equal(data.id, museum.id);
  assert.equal(data.durationMinutes, museum.planning!.durationMinutes);
  assert.equal(data.location, museum.planning!.locationQuery);
  assert.equal('description' in data, false);
  assert.equal('reference' in data.referenceCost, false);
  const meal = plannerCatalog([
    {
      ...museum,
      category: 'food',
      venueType: 'restaurant',
      description: 'Nhà hàng chay',
      name: 'Quán',
    },
  ])[0]!;
  assert.equal(meal.mealSuitable, true);
});

test('server arranges full days from AI choices, avoids monthly closures and uses catalog prices', () => {
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
  assert.equal(result.budget.missingCostCount, 0);
  assert.equal(result.trip.budget.amountMinor, null);
  const wrong = structuredClone(raw);
  wrong.days[0]!.stops[0]!.placeId = 'ffffffffffffffffffffffff';
  assert.throws(() => arrangeCompleteDays(wrong, request, catalog));
  const ranked = { placeIds: catalog.map((p) => p.id) };
  const rankedResult = validatePlan(
    arrangeCompleteDays(ranked, request, catalog),
    request,
    catalog,
    randomUUID(),
  );
  assert.equal(rankedResult.trip.days.length, 2);
  assert.ok(
    !rankedResult.trip.days[0]!.activities.some(
      (a) => a.placeId === catalog[0]!.id,
    ),
  );
  assert.equal(rankedResult.budget.missingCostCount, 0);
  assert.throws(() =>
    arrangeCompleteDays(
      { placeIds: [...ranked.placeIds, 'ffffffffffffffffffffffff'] },
      request,
      catalog,
    ),
  );
  assert.throws(() =>
    arrangeCompleteDays(ranked, request, catalog.slice(0, 4)),
  );
});

const coffeeRequest = () => {
  const request = structuredClone(input);
  request.trip.endDate = '2026-11-13';
  request.trip.days.push({
    ...structuredClone(request.trip.days[0]!),
    dayId: randomUUID(),
    date: '2026-11-13',
  });
  return request;
};

const coffeeCatalog = (): PlaceDto[] =>
  Array.from({ length: 10 }, (_, i) => ({
    ...place,
    id: `40000000000000000000000${i}`,
    name: i < 4 ? `Visit ${i}` : i < 8 ? `Restaurant ${i}` : `Coffee ${i}`,
    category: i < 4 ? 'culture' : 'food',
    venueType: i < 4 ? 'place' : 'restaurant',
    planning: {
      ...place.planning!,
      durationMinutes: i < 4 ? 60 : i < 8 ? 45 : 30,
    },
    referencePrice: {
      ...place.referencePrice!,
      amountMinor: i < 8 ? 20000 : 35000,
    },
  }));

test('balanced and active two-day plans keep visits and meals, add ranked coffee breaks and vary venues', () => {
  const catalog = coffeeCatalog(),
    ranked = { placeIds: catalog.map((p) => p.id) };
  for (const pace of ['balanced', 'active'] as const) {
    const request = coffeeRequest();
    request.trip.preferences.pace = pace;
    const before = JSON.stringify(request);
    const proposal = validatePlan(
      arrangeCompleteDays(ranked, request, catalog),
      request,
      catalog,
      randomUUID(),
    );
    for (const day of proposal.trip.days) {
      assert.equal(day.activities.length, 5);
      assert.equal(day.activities.filter((a) => a.kind === 'visit').length, 2);
      assert.equal(day.activities.filter((a) => a.kind === 'meal').length, 2);
      const breaks = day.activities.filter((a) => a.kind === 'free_time');
      assert.equal(breaks.length, 1);
      assert.equal(breaks[0]!.estimatedCost.amountMinor, 35000);
      assert.ok(breaks[0]!.endLocalTime! <= '17:30');
    }
    for (const kind of ['visit', 'meal', 'free_time'] as const) {
      const stops = proposal.trip.days.flatMap((d) =>
        d.activities.filter((a) => a.kind === kind),
      );
      assert.equal(new Set(stops.map((a) => a.placeId)).size, stops.length);
    }
    assert.equal(proposal.budget.missingCostCount, 0);
    assert.equal(JSON.stringify(request), before);
  }
});

test('coffee cannot satisfy lunch or dinner coverage even when imported as a restaurant', () => {
  const catalog = coffeeCatalog(),
    request = coffeeRequest();
  const invalid = {
    days: request.trip.days.map((d, i) => ({
      date: d.date,
      stops: [
        { placeId: catalog[i * 2]!.id, start: '09:00', end: '10:00' },
        { placeId: catalog[8]!.id, start: '12:00', end: '12:30' },
        { placeId: catalog[i * 2 + 1]!.id, start: '14:00', end: '15:00' },
        { placeId: catalog[9]!.id, start: '18:00', end: '18:30' },
      ],
    })),
  };
  assert.throws(
    () => validatePlan(invalid, request, catalog, randomUUID()),
    (e) => e instanceof HttpError && e.code === 'AI_INVALID_OUTPUT',
  );
  assert.throws(
    () =>
      arrangeCompleteDays(
        {
          placeIds: catalog
            .filter((p) => !p.name.startsWith('Restaurant'))
            .map((p) => p.id),
        },
        request,
        catalog.filter((p) => !p.name.startsWith('Restaurant')),
      ),
    (e) => e instanceof HttpError && e.code === 'AI_CATALOG_COVERAGE',
  );
  for (const name of ['Cà phê Cộng', 'Café', 'Coffee & Tea', 'Espresso']) {
    const cafe = { ...catalog[8]!, name };
    assert.equal(cafeSuitable(cafe), true);
    assert.equal(plannerCatalog([cafe])[0]!.mealSuitable, false);
    assert.equal(plannerCatalog([cafe])[0]!.cafeSuitable, true);
  }
  assert.equal(
    cafeSuitable({ ...catalog[8]!, description: 'Cơm, mì, món chay' }),
    false,
  );
});

test('two meal venues and one cafe may repeat across days when there are no fresh alternatives', () => {
  const request = coffeeRequest(),
    catalog = coffeeCatalog().filter((_, i) => i < 6 || i === 8);
  const proposal = validatePlan(
    arrangeCompleteDays(
      { placeIds: catalog.map((p) => p.id) },
      request,
      catalog,
    ),
    request,
    catalog,
    randomUUID(),
  );
  assert.ok(proposal.trip.days.every((d) => d.activities.length === 5));
  assert.equal(
    new Set(
      proposal.trip.days.flatMap((d) =>
        d.activities.filter((a) => a.kind === 'meal').map((a) => a.placeId),
      ),
    ).size,
    2,
  );
  assert.equal(
    new Set(
      proposal.trip.days.flatMap((d) =>
        d.activities
          .filter((a) => a.kind === 'free_time')
          .map((a) => a.placeId),
      ),
    ).size,
    1,
  );
});

test('closed, unpriced and unranked cafes stay optional; relaxed days retain four stops', () => {
  const catalog = coffeeCatalog(),
    request = coffeeRequest();
  const variants = [
    catalog.map((p, i) =>
      i < 8 ? p : { ...p, openingHoursNote: '08:00–09:00' },
    ),
    catalog.map((p, i) => (i < 8 ? p : { ...p, referencePrice: null })),
  ];
  for (const candidates of variants) {
    const result = validatePlan(
      arrangeCompleteDays(
        { placeIds: candidates.map((p) => p.id) },
        request,
        candidates,
      ),
      request,
      candidates,
      randomUUID(),
    );
    assert.ok(result.trip.days.every((d) => d.activities.length === 4));
    assert.ok(
      result.trip.days.every((d) =>
        d.activities.every((a) => a.kind !== 'free_time'),
      ),
    );
  }
  const unranked = arrangeCompleteDays(
    { placeIds: catalog.slice(0, 8).map((p) => p.id) },
    request,
    catalog,
  );
  assert.ok(unranked.days.every((d) => d.stops.length === 4));
  request.trip.preferences.pace = 'relaxed';
  const relaxed = validatePlan(
    arrangeCompleteDays(
      { placeIds: catalog.map((p) => p.id) },
      request,
      catalog,
    ),
    request,
    catalog,
    randomUUID(),
  );
  assert.ok(relaxed.trip.days.every((d) => d.activities.length === 4));
  assert.ok(
    relaxed.trip.days.every((d) =>
      d.activities.every((a) => a.kind !== 'free_time'),
    ),
  );
});

test('the thirty-candidate cap reserves coffee choices without starving visits or meal restaurants', () => {
  const catalog = coffeeCatalog();
  const group = (count: number, source: PlaceDto, prefix: string) =>
    Array.from({ length: count }, (_, i) => ({
      ...source,
      id: prefix + String(i).padStart(22, '0'),
    }));
  const pools = {
    visits: group(25, catalog[0]!, '51'),
    meals: group(14, catalog[4]!, '52'),
    cafes: group(3, catalog[8]!, '53'),
    other: group(6, { ...catalog[8]!, name: 'Other food' }, '54'),
  };
  const selected = selectPlannerCandidates(pools);
  assert.equal(selected.length, 30);
  assert.equal(selected.filter((p) => p.category !== 'food').length, 20);
  assert.equal(
    selected.filter((p) => p.name.startsWith('Restaurant')).length,
    8,
  );
  assert.equal(selected.filter(cafeSuitable).length, 2);
  const withoutCafe = selectPlannerCandidates({ ...pools, cafes: [] });
  assert.equal(withoutCafe.length, 30);
  assert.equal(
    withoutCafe.filter((p) => p.name.startsWith('Restaurant')).length,
    10,
  );
});

test('date changes retain coffee breaks and replace a closed cafe with a cafe, preserving private edits', () => {
  const request = coffeeRequest(),
    catalog = coffeeCatalog();
  const trip = validatePlan(
    arrangeCompleteDays(
      { placeIds: catalog.map((p) => p.id) },
      request,
      catalog,
    ),
    request,
    catalog,
    randomUUID(),
  ).trip;
  const coffee = trip.days[0]!.activities.find((a) => a.kind === 'free_time')!;
  coffee.notes = 'Ghi chú riêng lúc uống cà phê';
  const before = JSON.stringify(trip);
  const unchanged = rescheduleDates(trip, '2026-11-13', '2026-11-14', catalog);
  assert.equal(
    unchanged.trip.days[0]!.activities.find((a) => a.kind === 'free_time')!
      .placeId,
    coffee.placeId,
  );
  const closed = catalog.map((p) =>
    p.id === coffee.placeId
      ? { ...p, openingHoursNote: '07:00–22:00; nghỉ thứ sáu' }
      : p,
  );
  const alternate = {
    ...catalog[8]!,
    id: '400000000000000000000010',
    name: 'Café thay thế',
  };
  const replacement = rescheduleDates(trip, '2026-11-13', '2026-11-14', [
    ...closed,
    alternate,
  ]);
  const saved = replacement.trip.days[0]!.activities.find(
    (a) => a.kind === 'free_time',
  )!;
  assert.equal(saved.placeId, alternate.id);
  assert.equal(saved.activityId, coffee.activityId);
  assert.equal(saved.notes, coffee.notes);
  assert.equal(saved.estimatedCost.amountMinor, 35000);
  const repeated = rescheduleDates(trip, '2026-11-13', '2026-11-14', closed);
  assert.equal(
    repeated.trip.days[0]!.activities.find((a) => a.kind === 'free_time')!
      .placeId,
    catalog[9]!.id,
  );
  assert.throws(
    () =>
      rescheduleDates(
        trip,
        '2026-11-13',
        '2026-11-14',
        closed.filter((p) => !cafeSuitable(p)),
      ),
    (e) => e instanceof HttpError && e.code === 'DATE_SCHEDULE_UNAVAILABLE',
  );
  assert.equal(JSON.stringify(trip), before);
});

const mappedCoffeeCatalog = (): PlaceDto[] =>
  coffeeCatalog().map((p, i) => ({
    ...p,
    mapLocation: {
      latitude: 16.055 + i * 0.001,
      longitude: 108.22 + i * 0.001,
      label: 'Khu vực kiểm thử',
      precision: 'area',
      sourceUrl: 'https://example.invalid/coordinates',
      checkedAt: catalogToday(),
    },
  }));

test('full days choose a complete compact area despite the AI ranking a distant same-province visit first', () => {
  const request = coffeeRequest(),
    local = mappedCoffeeCatalog();
  const outlier: PlaceDto = {
    ...local[0]!,
    id: '400000000000000000000011',
    name: 'Distant visit in the same province',
    mapLocation: {
      ...local[0]!.mapLocation!,
      latitude: 15.8771754,
      longitude: 108.3342411,
    },
  };
  const catalog = [...local, outlier],
    before = JSON.stringify(catalog);
  const ranked = { placeIds: [outlier.id, ...local.map((p) => p.id)] };
  const proposal = validatePlan(
    arrangeCompleteDays(ranked, request, catalog),
    request,
    catalog,
    randomUUID(),
  );
  const stops = proposal.trip.days.flatMap((d) => d.activities);
  assert.equal(stops.length, 10);
  assert.ok(stops.every((a) => a.placeId !== outlier.id));
  assert.equal(stops.filter((a) => a.kind === 'visit').length, 4);
  assert.equal(stops.filter((a) => a.kind === 'meal').length, 4);
  assert.equal(stops.filter((a) => a.kind === 'free_time').length, 2);
  assert.equal(new Set(stops.map((a) => a.placeId)).size, 10);
  assert.equal(JSON.stringify(catalog), before);
  assert.throws(
    () =>
      arrangeCompleteDays(
        { placeIds: [...ranked.placeIds, 'ffffffffffffffffffffffff'] },
        request,
        catalog,
      ),
    (e) => e instanceof HttpError && e.code === 'AI_UNKNOWN_SELECTION',
  );
});

test('compact area selection keeps the previous behavior when coordinates are missing or no area covers the trip', () => {
  const request = coffeeRequest(),
    catalog = mappedCoffeeCatalog();
  catalog[0]!.mapLocation = {
    ...catalog[0]!.mapLocation!,
    latitude: 15.8771754,
    longitude: 108.3342411,
  };
  const ranked = { placeIds: catalog.map((p) => p.id) };
  const noCompleteArea = validatePlan(
    arrangeCompleteDays(ranked, request, catalog),
    request,
    catalog,
    randomUUID(),
  );
  assert.ok(
    noCompleteArea.trip.days
      .flatMap((d) => d.activities)
      .some((a) => a.placeId === catalog[0]!.id),
  );
  const withUnknownCoordinates = [...mappedCoffeeCatalog(), catalog[0]!].map(
    (p) => ({ ...p }),
  );
  withUnknownCoordinates[10]!.id = '400000000000000000000011';
  delete withUnknownCoordinates[9]!.mapLocation;
  const missingRanked = {
    placeIds: [
      withUnknownCoordinates[10]!.id,
      ...withUnknownCoordinates.slice(0, 10).map((p) => p.id),
    ],
  };
  const unknown = validatePlan(
    arrangeCompleteDays(missingRanked, request, withUnknownCoordinates),
    request,
    withUnknownCoordinates,
    randomUUID(),
  );
  assert.ok(
    unknown.trip.days
      .flatMap((d) => d.activities)
      .some((a) => a.placeId === withUnknownCoordinates[10]!.id),
  );
});
