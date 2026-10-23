import { z } from 'zod';
import type { AdminPlaceDto } from './catalog.js';

export const catalogScheduleSchema = z.strictObject({
  enabled: z.boolean(),
  frequency: z.enum(['daily', 'weekly']),
  hour: z.number().int().min(0).max(23),
  minute: z.number().int().min(0).max(59),
  weekday: z.number().int().min(0).max(6),
  group: z.enum(['mixed', 'sights', 'restaurant', 'cafe']),
  expectedRevision: z.number().int().nonnegative(),
});
export type CatalogScheduleInput = z.infer<typeof catalogScheduleSchema>;
export const sourceSnapshotSchema = z.strictObject({
  name: z.string().min(1).max(120),
  address: z.string().max(200),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  category: z.enum(['food', 'culture', 'nature']),
  venueType: z.enum(['restaurant', 'place']),
  categories: z.array(z.string().max(160)).max(100),
  openingHoursNote: z.string().max(400),
  closed: z.boolean().nullable(),
  sourceUrl: z.url().max(2048),
});
export type SourceSnapshot = z.infer<typeof sourceSnapshotSchema>;
export const reviewDecisionSchema = z.strictObject({
  expectedRevision: z.number().int().nonnegative(),
  expectedPlaceRevision: z.number().int().nonnegative(),
  decision: z.enum(['keep', 'apply', 'ignore', 'later', 'distinct']),
  revisitAt: z.iso.datetime().optional(),
});
export type ReviewDecision = z.infer<typeof reviewDecisionSchema>;
export const catalogBatchSchema = z.strictObject({
  items: z
    .array(
      z.strictObject({
        id: z.string().regex(/^[a-f0-9]{24}$/),
        expectedRevision: z.number().int().nonnegative(),
      }),
    )
    .min(1)
    .max(50)
    .refine((v) => new Set(v.map((p) => p.id)).size === v.length),
  status: z.enum(['published', 'archived']),
});
export type CatalogBatchInput = z.infer<typeof catalogBatchSchema>;
export type CatalogBatchItem = {
  id: string;
  name: string;
  eligible: boolean;
  reason: string;
  applied?: boolean;
};
export type CatalogReviewDto = {
  id: string;
  revision: number;
  kind: 'draft' | 'duplicate' | 'source' | 'price';
  place: AdminPlaceDto;
  reason: string;
  updatedAt: string;
  incoming: SourceSnapshot | null;
  previous: SourceSnapshot | null;
  fetchedAt: string | null;
  duplicates: string[];
  duplicatePlaces: Pick<
    AdminPlaceDto,
    'id' | 'name' | 'locationQuery' | 'sourceUrl' | 'publicationStatus'
  >[];
  currentLocation: { latitude: number; longitude: number } | null;
};
export type CatalogRunDto = {
  id: string;
  state: 'queued' | 'running' | 'retry' | 'succeeded' | 'failed';
  actor: 'user' | 'system';
  createdAt: string;
  finishedAt: string | null;
  nextAttemptAt: string;
  attempts: number;
  message: string;
  counts: {
    created: number;
    unchanged: number;
    review: number;
    skipped: number;
    errors: number;
  };
};
export type CatalogOperationsDto = {
  connected: boolean;
  schedule: Omit<CatalogScheduleInput, 'expectedRevision'> & {
    revision: number;
    nextRunAt: string | null;
  };
  runs: CatalogRunDto[];
};
