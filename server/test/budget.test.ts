import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { ActivityInput, TripInput } from '@goease/contracts';
import { calculateBudget } from '../src/features/trips/budget.js';
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
