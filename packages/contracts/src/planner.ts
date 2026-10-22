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
export type PlannerProposal = {
  runId: string;
  trip: TripInput;
  budget: BudgetSummary;
  warnings: string[];
};
