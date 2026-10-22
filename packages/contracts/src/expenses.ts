import { z } from 'zod';
import type { BudgetSummary, BudgetCategory } from './budget.js';
export const expenseInputSchema = z.strictObject({
  description: z.string().trim().min(1).max(160),
  category: z.enum(['transport', 'lodging', 'meal', 'visit', 'other']),
  amountMinor: z.number().int().min(1).max(1e12),
  currency: z.literal('VND'),
  spentOn: z.iso.date(),
  timezone: z.literal('Asia/Ho_Chi_Minh'),
});
export const expenseRevisionSchema = z.strictObject({
  expectedRevision: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
});
export const expenseUpdateSchema = expenseRevisionSchema.extend({
  expense: expenseInputSchema,
});
export const expenseCreateSchema = z.strictObject({
  expense: expenseInputSchema,
});
export const expenseQuerySchema = z.strictObject({
  offset: z.coerce.number().int().min(0).max(1000000).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type ExpenseInput = z.infer<typeof expenseInputSchema>;
export type ExpenseDto = ExpenseInput & {
  id: string;
  revision: number;
  updatedAt: string;
};
export type ExpenseListDto = {
  items: ExpenseDto[];
  totalCount: number;
  hasMore: boolean;
  offset: number;
  tripRevision: number;
  budget: BudgetSummary;
  actual: {
    amountMinor: number;
    perPersonMinor: number;
    remainingMinor: number | null;
    differenceFromEstimateMinor: number;
    categories: { key: BudgetCategory; amountMinor: number }[];
  };
};
