export type BudgetCategory =
  'transport' | 'lodging' | 'meal' | 'visit' | 'other';
export type BudgetSummary = {
  currency: 'VND';
  knownEstimatedMinor: number;
  missingCostCount: number;
  activityCount: number;
  perPersonMinor: number;
  budgetMinor: number | null;
  remainingMinor: number | null;
  usedPercent: number | null;
  categories: {
    key: BudgetCategory;
    amountMinor: number;
    missingCostCount: number;
  }[];
};
