import type {
  BudgetCategory,
  BudgetSummary,
  TripInput,
} from '@goease/contracts';
import { HttpError } from '../../http-error.js';
import { priceFitsGroup } from '@goease/contracts';
import { isDeepStrictEqual } from 'node:util';

// All monetary arithmetic is performed here. null means unknown, zero means entered as zero.
export function calculateBudget(trip: TripInput): BudgetSummary {
  const categories = (
    ['transport', 'lodging', 'meal', 'visit', 'other'] as BudgetCategory[]
  ).map((key) => ({ key, amountMinor: 0, missingCostCount: 0 }));
  const activities = trip.days.flatMap((day) => day.activities);
  let knownEstimatedMinor = 0;
  let missingCostCount = 0;
  const includedActivityIds: string[] = [];
  const bundles = new Map<
    string,
    { definition: unknown; expires: number; entries: number }
  >();
  const dates = new Map(
    trip.days.flatMap((d) =>
      d.activities.map((a) => [a.activityId, d.date] as const),
    ),
  );
  for (const activity of activities) {
    const row =
      categories.find((row) => row.key === activity.kind) ?? categories[4]!;
    const cost = activity.estimatedCost;
    if (
      cost.amountMinor === null ||
      !priceFitsGroup(cost, trip.travelers.totalCount)
    ) {
      row.missingCostCount++;
      missingCostCount++;
      continue;
    }
    if (cost.confidence === 'catalog_reference' && cost.reference?.bundle) {
      const { placeRevision: _revision, ...definition } = cost.reference;
      void _revision;
      const bundle = cost.reference.bundle;
      const date = Date.parse(`${dates.get(activity.activityId)}T00:00:00Z`);
      const previous = bundles.get(bundle.code);
      if (previous && !isDeepStrictEqual(previous.definition, definition))
        throw new HttpError(
          409,
          'BUNDLE_PRICE_CONFLICT',
          'Các điểm dùng cùng mã vé gói nhưng khác giá hoặc điều kiện. Cần đồng bộ dữ liệu vé gói trước khi tính.',
        );
      if (
        previous &&
        date <= previous.expires &&
        previous.entries < bundle.maxEntries
      ) {
        previous.entries++;
        includedActivityIds.push(activity.activityId);
        continue;
      }
      bundles.set(bundle.code, {
        definition,
        expires: date + (bundle.validDays - 1) * 86400000,
        entries: 1,
      });
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
    includedActivityIds,
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
