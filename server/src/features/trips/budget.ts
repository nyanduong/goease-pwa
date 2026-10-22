import type {
  BudgetCategory,
  BudgetSummary,
  TripInput,
} from '@goease/contracts';
import { HttpError } from '../../http-error.js';

// All monetary arithmetic is performed here. null means unknown, zero means entered as zero.
export function calculateBudget(trip: TripInput): BudgetSummary {
  const categories = (
    ['transport', 'lodging', 'meal', 'visit', 'other'] as BudgetCategory[]
  ).map((key) => ({ key, amountMinor: 0, missingCostCount: 0 }));
  const activities = trip.days.flatMap((day) => day.activities);
  let knownEstimatedMinor = 0;
  let missingCostCount = 0;
  for (const activity of activities) {
    const row =
      categories.find((row) => row.key === activity.kind) ?? categories[4]!;
    const cost = activity.estimatedCost;
    if (cost.amountMinor === null) {
      row.missingCostCount++;
      missingCostCount++;
      continue;
    }
    const amount =
      cost.amountMinor *
      (cost.basis === 'per_person' ? trip.travelers.totalCount : 1);
    if (
      !Number.isSafeInteger(amount) ||
      !Number.isSafeInteger(knownEstimatedMinor + amount)
    ) {
      throw new HttpError(
        400,
        'COST_OVERFLOW',
        'Tổng chi phí quá lớn để tính chính xác. Hãy kiểm tra các khoản đã nhập.',
      );
    }
    row.amountMinor += amount;
    knownEstimatedMinor += amount;
  }
  const budgetMinor = trip.budget.amountMinor;
  return {
    currency: 'VND',
    knownEstimatedMinor,
    missingCostCount,
    activityCount: activities.length,
    perPersonMinor: Math.round(knownEstimatedMinor / trip.travelers.totalCount),
    budgetMinor,
    remainingMinor:
      budgetMinor === null ? null : budgetMinor - knownEstimatedMinor,
    usedPercent:
      budgetMinor !== null && budgetMinor > 0
        ? Math.round((knownEstimatedMinor / budgetMinor) * 100)
        : null,
    categories,
  };
}
