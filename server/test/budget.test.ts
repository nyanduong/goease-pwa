import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { ActivityInput, TripInput } from '@goease/contracts';
import { calculateBudget } from '../src/features/trips/budget.js';
import {
  catalogCost,
  catalogToday,
  priceReady,
  referencePriceSchema,
} from '@goease/contracts';
function draft(
  costs: [
    ActivityInput['kind'],
    number | null,
    ActivityInput['estimatedCost']['basis'],
  ][],
  travelers = 4,
  budget: number | null = 1000000,
): TripInput {
  return {
    title: 'Hội An',
    destinations: [{ destinationId: '000000000000000000000004', order: 0 }],
    startDate: '2026-11-12',
    endDate: '2026-11-12',
    timezone: 'Asia/Ho_Chi_Minh',
    travelers: { totalCount: travelers },
    budget: {
      amountMinor: budget,
      currency: 'VND',
      scope: 'group_total',
      includedCategories: [],
    },
    preferences: { interestCodes: [], pace: 'relaxed', transportModes: [] },
    generationMode: 'manual',
    notes: '',
    days: [
      {
        dayId: randomUUID(),
        date: '2026-11-12',
        destinationId: '000000000000000000000004',
        activities: costs.map(([kind, amountMinor, basis], order) => ({
          activityId: randomUUID(),
          kind,
          title: 'Điểm dừng',
          timezone: 'Asia/Ho_Chi_Minh',
          order,
          notes: '',
          source: 'manual',
          estimatedCost: {
            amountMinor,
            basis,
            currency: 'VND',
            quantity: 1,
            confidence: 'user_entered',
          },
        })),
      },
    ],
  };
}
test('minimum group size excludes an inapplicable set price from totals', () => {
  const price = {
    label: 'Fixture set for two or more',
    amountMinor: 250000,
    basis: 'per_person' as const,
    minTravelers: 2,
    maxTravelers: 10,
    conditions: 'Minimum two guests',
    inclusions: 'Set meal',
    exclusions: 'Drinks',
    sourceUrl: 'https://example.invalid/menu',
    checkedAt: catalogToday(),
    reviewAfter: '2099-12-31',
  };
  assert.equal(priceReady(price, 1), false);
  assert.equal(priceReady(price, 2), true);
  assert.equal(
    referencePriceSchema.safeParse({ ...price, minTravelers: 11 }).success,
    false,
  );
  const trip = draft([['meal', null, 'per_person']], 1, null);
  trip.days[0]!.activities[0]!.estimatedCost = catalogCost({
    referencePrice: price,
    revision: 1,
  });
  assert.equal(calculateBudget(trip).knownEstimatedMinor, 0);
  assert.equal(calculateBudget(trip).missingCostCount, 1);
  trip.travelers.totalCount = 3;
  assert.equal(calculateBudget(trip).knownEstimatedMinor, 750000);
  assert.equal(calculateBudget(trip).perPersonMinor, 250000);
});
test('budget server: mixed bases, explicit zero, unknown costs and category sums', () => {
  const input = draft([
    ['visit', 80000, 'per_person'],
    ['lodging', 300000, 'group_total'],
    ['meal', null, 'per_person'],
    ['transport', 0, 'group_total'],
  ]);
  const result = calculateBudget(input);
  assert.equal(result.knownEstimatedMinor, 620000);
  assert.equal(result.perPersonMinor, 155000);
  assert.equal(result.missingCostCount, 1);
  assert.equal(result.usedPercent, 62);
  assert.equal(result.remainingMinor, 380000);
  assert.equal(
    result.categories.find((c) => c.key === 'meal')?.missingCostCount,
    1,
  );
  assert.equal(
    result.categories.reduce((n, c) => n + c.amountMinor, 0),
    result.knownEstimatedMinor,
  );
  input.travelers.totalCount = 5;
  assert.equal(calculateBudget(input).knownEstimatedMinor, 700000);
});
test('budget distinguishes no budget, zero budget, exceeded budget and empty trip', () => {
  assert.equal(calculateBudget(draft([], 4, null)).remainingMinor, null);
  assert.equal(calculateBudget(draft([], 4, 0)).knownEstimatedMinor, 0);
  const result = calculateBudget(draft([['custom', 100, 'group_total']], 3, 0));
  assert.equal(result.remainingMinor, -100);
  assert.equal(result.usedPercent, null);
  assert.equal(result.perPersonMinor, 33);
});
test('budget rejects totals exceeding safe integer arithmetic', () => {
  assert.throws(
    () =>
      calculateBudget(
        draft(
          Array.from({ length: 10 }, () => ['visit', 1e12, 'per_person']),
          1000,
        ),
      ),
    /quá lớn/,
  );
});

test('bundle charges once within validity/capacity; meals stay separate; conflicts fail closed', () => {
  const trip = draft(
    [
      ['visit', null, 'per_person'],
      ['visit', null, 'per_person'],
      ['meal', 50000, 'per_person'],
      ['meal', 50000, 'per_person'],
    ],
    3,
    null,
  );
  const price = {
    label: 'Vé gói kiểm thử',
    amountMinor: 120000,
    basis: 'per_person' as const,
    maxTravelers: 10,
    conditions: 'Mỗi lượt vào cửa dùng một lượt',
    inclusions: 'Các điểm đã gán cùng mã',
    exclusions: 'Ăn uống',
    sourceUrl: 'https://example.invalid/ticket',
    checkedAt: catalogToday(),
    reviewAfter: '2099-12-31',
    bundle: { code: 'fixture-pass', validDays: 2, maxEntries: 2 },
  };
  for (const a of trip.days[0]!.activities.slice(0, 2))
    a.estimatedCost = catalogCost({ referencePrice: price, revision: 1 });
  let result = calculateBudget(trip);
  assert.equal(result.knownEstimatedMinor, 660000);
  assert.equal(result.perPersonMinor, 220000);
  assert.deepEqual(result.includedActivityIds, [
    trip.days[0]!.activities[1]!.activityId,
  ]);
  const groupTicket = structuredClone(trip);
  for (const a of groupTicket.days[0]!.activities.slice(0, 2)) {
    a.estimatedCost.basis = 'group_total';
    a.estimatedCost.reference!.basis = 'group_total';
  }
  assert.equal(calculateBudget(groupTicket).knownEstimatedMinor, 420000);
  assert.equal(calculateBudget(groupTicket).perPersonMinor, 140000);
  const next = structuredClone(trip.days[0]!);
  next.dayId = randomUUID();
  next.date = '2026-11-13';
  next.activities = [
    { ...next.activities[0]!, activityId: randomUUID(), order: 0 },
  ];
  trip.days.push(next);
  assert.equal(
    calculateBudget(trip).knownEstimatedMinor,
    1020000,
    'capacity exceeded buys another pass',
  );
  trip.days[0]!.activities.splice(1, 1);
  assert.equal(
    calculateBudget(trip).knownEstimatedMinor,
    660000,
    'second calendar day still included',
  );
  next.date = '2026-11-14';
  assert.equal(
    calculateBudget(trip).knownEstimatedMinor,
    1020000,
    'third day needs new pass',
  );
  next.activities[0]!.estimatedCost.reference!.bundle!.maxEntries = 3;
  assert.throws(() => calculateBudget(trip), /cùng mã vé gói/);
  next.activities[0]!.estimatedCost.reference!.bundle!.maxEntries = 2;
  trip.travelers.totalCount = 11;
  result = calculateBudget(trip);
  assert.equal(result.missingCostCount, 2);
  assert.equal(
    result.knownEstimatedMinor,
    1100000,
    'out of scope passes never become free',
  );
});
