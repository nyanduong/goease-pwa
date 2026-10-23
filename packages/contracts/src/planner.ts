import { z } from 'zod';
import { tripInputSchema, type TripInput } from './product.js';
import type { BudgetSummary } from './budget.js';

export const plannerRequestSchema = z
  .strictObject({
    trip: tripInputSchema,
    tripId: z
      .string()
      .regex(/^[a-f0-9]{24}$/)
      .optional(),
    expectedRevision: z.number().int().nonnegative().optional(),
    consent: z.literal(true),
  })
  .refine((v) => Boolean(v.tripId) === (v.expectedRevision !== undefined));
export type PlannerRequest = z.infer<typeof plannerRequestSchema>;
export const rescheduleRequestSchema = z
  .strictObject({
    trip: tripInputSchema,
    startDate: tripInputSchema.shape.startDate,
    endDate: tripInputSchema.shape.endDate,
    tripId: z
      .string()
      .regex(/^[a-f0-9]{24}$/)
      .optional(),
    expectedRevision: z.number().int().nonnegative().optional(),
  })
  .refine((v) => Boolean(v.tripId) === (v.expectedRevision !== undefined));
export type RescheduleRequest = z.infer<typeof rescheduleRequestSchema>;
export type RescheduleResult = { trip: TripInput; changes: string[] };
export const goeRequestSchema = z.strictObject({
  dayId: z.uuid(),
  message: z.string().trim().min(1).max(500),
  expectedRevision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  consent: z.literal(true),
});
export const goeApplySchema = z.strictObject({
  runId: z.uuid(),
  expectedRevision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
});
export type GoeRequest = z.infer<typeof goeRequestSchema>;
export type GoeProposal = PlannerProposal & {
  baseRevision: number;
  dayId: string;
  before: TripInput['days'][number];
};
export type PlannerProposal = {
  runId: string;
  trip: TripInput;
  budget: BudgetSummary;
  warnings: string[];
};

// Keep the UI and stale-run recovery outside the provider request deadline.
export const plannerTiming = {
  providerTimeoutMs: 120000,
  clientTimeoutMs: 135000,
  staleRunAfterMs: 180000,
} as const;
