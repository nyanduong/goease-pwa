import { z } from 'zod';

export const enrichmentControlSchema = z.strictObject({
  action: z.enum(['pause', 'resume']),
  expectedRevision: z.number().int().positive(),
});
export const enrichmentQuerySchema = z.strictObject({
  offset: z.coerce.number().int().min(0).max(1000000).default(0),
  state: z
    .enum([
      'all',
      'queued',
      'waiting',
      'review',
      'ready',
      'unresolved',
      'skipped',
    ])
    .default('all'),
});
export type EnrichmentItemState = Exclude<
  z.infer<typeof enrichmentQuerySchema>['state'],
  'all'
>;
export type EnrichmentDto = {
  job: null | {
    id: string;
    state: 'building' | 'running' | 'paused' | 'completed';
    revision: number;
    total: number;
    registered: number;
    createdAt: string;
    counts: Partial<Record<EnrichmentItemState, number>>;
  };
  items: {
    id: string;
    placeId: string;
    name: string;
    destinationName: string;
    state: EnrichmentItemState;
    missing: string[];
    message: string;
  }[];
  hasMore: boolean;
};
