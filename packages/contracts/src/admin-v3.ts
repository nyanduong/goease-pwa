import { z } from 'zod';
import { adminPlaceQuerySchema } from './catalog.js';
import type { CatalogRunDto } from './catalog-operations.js';

const id = z.string().regex(/^[a-f0-9]{24}$/);
export const provinceImportSchema = z.strictObject({
  destinationId: id,
  areaName: z.string().trim().min(1).max(100).optional(),
});
export type ProvinceImportInput = z.infer<typeof provinceImportSchema>;
export const campaignInputSchema = z.strictObject({
  destinationIds: z
    .array(id)
    .min(1)
    .max(20)
    .refine((v) => new Set(v).size === v.length),
  group: z.enum(['mixed', 'sights', 'restaurant', 'cafe']),
  policyId: id.optional(),
});
export type CampaignInput = z.infer<typeof campaignInputSchema>;
export const campaignControlSchema = z.strictObject({
  action: z.enum(['pause', 'resume', 'retry_failed']),
});
export const catalogPolicyInputSchema = z.strictObject({
  name: z.string().trim().min(1).max(100),
  autoApplyDraftHours: z.boolean(),
});
export type CatalogPolicyInput = z.infer<typeof catalogPolicyInputSchema>;
export const bulkPreviewSchema = z
  .strictObject({
    action: z.enum(['publish', 'archive', 'archive_destination']),
    destinationId: id.optional(),
    selection: z.discriminatedUnion('mode', [
      z.strictObject({
        mode: z.literal('page'),
        items: z
          .array(
            z.strictObject({
              id,
              expectedRevision: z.number().int().nonnegative(),
            }),
          )
          .min(1)
          .max(50)
          .refine((v) => new Set(v.map((p) => p.id)).size === v.length),
      }),
      z.strictObject({
        mode: z.literal('filter'),
        filter: adminPlaceQuerySchema,
      }),
    ]),
  })
  .refine(
    (v) => v.action !== 'archive_destination' || Boolean(v.destinationId),
    { message: 'Chọn điểm đến cần lưu trữ.' },
  );
export type BulkPreviewInput = z.infer<typeof bulkPreviewSchema>;
export const adminMapQuerySchema = adminPlaceQuerySchema
  .safeExtend({
    west: z.coerce.number().min(-180).max(180),
    east: z.coerce.number().min(-180).max(180),
    south: z.coerce.number().min(-90).max(90),
    north: z.coerce.number().min(-90).max(90),
    zoom: z.coerce.number().int().min(0).max(22).default(10),
  })
  .refine((v) => v.west < v.east && v.south < v.north, {
    message: 'Vùng bản đồ không hợp lệ.',
  });
export type AdminMapQuery = z.infer<typeof adminMapQuerySchema>;
export type CampaignSummary = {
  id: string;
  state: string;
  createdAt: string;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  pausedTasks: number;
};
export type BulkItemDto = {
  id: string;
  placeId: string;
  name: string;
  expectedRevision: number;
  state: string;
  eligible: boolean;
  reason: string;
};
export type BulkJobDto = {
  id: string;
  action: string;
  state: string;
  total: number;
  eligible: number;
  succeeded: number;
  blocked: number;
  failed: number;
  pending: number;
  items: BulkItemDto[];
  hasMore: boolean;
  createdAt: string;
  selection: BulkPreviewInput['selection'];
  destinationId: string | null;
  destinationName: string | null;
  snapshotAt: string;
};
export type CatalogPolicyDto = {
  id: string;
  name: string;
  version: number;
  autoApplyDraftHours: boolean;
  autoPublish: false;
  createdAt: string;
};
export type CampaignDetail = {
  campaign: CampaignSummary & {
    source: string;
    policy: {
      policyId: string | null;
      version: number;
      autoApplyDraftHours: boolean;
      autoPublish: false;
    };
  };
  tasks: (CatalogRunDto & {
    destinationId: string;
    destinationName: string;
    scope?: {
      latitude: number;
      longitude: number;
      radiusMeters: number;
      areaLabel?: string | null;
      areaSource?: string | null;
    } | null;
  })[];
  totalTasks: number;
};
export type PolicySimulation = {
  policy: CatalogPolicyDto;
  dryRun: true;
  items: {
    placeId: string;
    name: string;
    expectedRevision: number;
    eligible: boolean;
    reason: string;
  }[];
  total: number;
  hasMore: boolean;
};
export type AdminMapResult = {
  total: number;
  missingCoordinates: number;
  inViewport: number;
  clusters: {
    id: string;
    count: number;
    latitude: number;
    longitude: number;
    placeId?: string;
    name?: string;
  }[];
};
export type AdminSourceStatus = {
  provider: 'geoapify';
  configured: boolean;
  checkedAt: string | null;
  lastFetchAt: string | null;
  connectionState:
    | 'not_configured'
    | 'not_checked'
    | 'fetched'
    | 'permission_denied'
    | 'checking'
    | 'failed';
  lastErrorCode: string | null;
  usage24h: {
    requests: number;
    fetched: number;
    failed: number;
    received: number;
  };
  providerCredits: null;
  providerBalance: null;
  maxResultsPerRun: number;
  quota: {
    requestsPerHour: number;
    requestsPerActorHour: number;
    concurrentSearches: number;
    meaning: string;
  };
  rights: { facts: string; photos: string; rawPayloadStored: boolean };
};
