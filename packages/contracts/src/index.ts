import { z } from 'zod';

export const apiErrorSchema = z.object({
  ok: z.literal(false),
  error: z.object({ code: z.string(), message: z.string() }),
});
export const healthSchema = z.object({
  ok: z.literal(true),
  data: z.object({ status: z.literal('up'), service: z.literal('goease-api') }),
});
export const databaseHealthSchema = z.object({
  ok: z.literal(true),
  data: z.object({ status: z.literal('up'), database: z.literal('connected') }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;
export type HealthResponse = z.infer<typeof healthSchema>;
export type DatabaseHealthResponse = z.infer<typeof databaseHealthSchema>;

export * from './product.js';

export * from './explore.js';
export type { BudgetSummary, BudgetCategory } from './budget.js';
export * from './planner.js';

export * from './expenses.js';
export * from './catalog.js';
export * from './place-import.js';
export * from './catalog-operations.js';
export * from './admin-operations.js';
export * from './geography.js';
export * from './admin-v3.js';
