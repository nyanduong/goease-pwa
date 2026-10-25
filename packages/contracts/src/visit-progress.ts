import { z } from 'zod';
export const visitProgressStates = [
  'pending',
  'searching',
  'ready',
  'empty',
  'failed',
  'inactive',
  'not_queued',
] as const;
export type VisitProgressState = (typeof visitProgressStates)[number];
export const visitProgressQuerySchema = z.strictObject({
  destinationId: z
    .string()
    .regex(/^[a-f0-9]{24}$/)
    .optional(),
  q: z.string().trim().max(100).default(''),
  state: z.enum(['all', ...visitProgressStates]).default('all'),
  coverage: z
    .enum([
      'all',
      'hours',
      'price',
      'both',
      'missing_hours',
      'missing_price',
      'neither',
    ])
    .default('all'),
  offset: z.coerce.number().int().min(0).max(1000000).default(0),
});
export type VisitProgressQuery = z.infer<typeof visitProgressQuerySchema>;
export type VisitProgressDto = {
  generatedAt: string;
  summary: {
    total: number;
    states: Record<VisitProgressState, number>;
    hours: number;
    price: number;
    both: number;
    neither: number;
    reviewedHours: number;
    reviewedPrice: number;
    expiredLeases: number;
  };
  total: number;
  hasMore: boolean;
  items: {
    id: string;
    name: string;
    destinationName: string;
    destinationId: string;
    state: VisitProgressState;
    publicationStatus: string;
    attempts: number;
    hours: boolean;
    price: boolean;
    reviewedHours: boolean;
    reviewedPrice: boolean;
    previousResult: boolean;
    expiredLease: boolean;
    checkedAt: string | null;
    nextAttemptAt: string | null;
    message: string;
  }[];
};
