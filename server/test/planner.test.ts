import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { PlannerRequest, PlaceDto } from '@goease/contracts';
import { validatePlan } from '../src/features/ai/planner.js';
import { geminiProvider } from '../src/features/ai/gemini.js';
import { parseConfig } from '../src/config.js';
import { HttpError } from '../src/http-error.js';
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
