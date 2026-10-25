import { z } from 'zod';
import { priceReady, approvedPhoto, type AdminPlaceDto } from './catalog.js';

export const adminSettingsSchema = z.strictObject({
  expectedRevision: z.number().int().nonnegative(),
  defaultDestinationId: z
    .string()
    .regex(/^[a-f0-9]{24}$/)
    .nullable(),
  freshnessDays: z.number().int().min(7).max(365),
  showQualityAlerts: z.boolean(),
  autoApplyDraftHours: z.boolean(),
  regions: z
    .array(
      z.strictObject({
        destinationId: z.string().regex(/^[a-f0-9]{24}$/),
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
        radiusMeters: z.number().int().min(500).max(10000),
        enabled: z.boolean(),
      }),
    )
    .max(100)
    .refine((v) => new Set(v.map((r) => r.destinationId)).size === v.length)
    .optional(),
});
export type AdminSettings = Omit<
  z.infer<typeof adminSettingsSchema>,
  'expectedRevision'
> & { revision: number };
export type QualityIssue = {
  code: string;
  label: string;
  severity: 'high' | 'medium';
};
export function catalogQuality(
  p: Pick<
    AdminPlaceDto,
    | 'name'
    | 'description'
    | 'locationQuery'
    | 'durationMinutes'
    | 'sourceUrl'
    | 'referencePrice'
    | 'openingHoursNote'
    | 'mapLocation'
    | 'updatedAt'
    | 'imageCredit'
    | 'images'
  >,
  freshnessDays = 90,
  now = Date.now(),
) {
  const checks: [string, string, boolean, 'high' | 'medium'][] = [
    ['name', 'Tên công khai cần biên tập', !!p.name?.trim(), 'high'],
    ['description', 'Thiếu giới thiệu', !!p.description?.trim(), 'medium'],
    ['address', 'Thiếu địa chỉ', !!p.locationQuery?.trim(), 'high'],
    ['duration', 'Thiếu thời lượng ước tính', p.durationMinutes > 0, 'medium'],
    ['source', 'Thiếu nguồn đối chiếu', !!p.sourceUrl, 'high'],
    [
      'price',
      'Giá thiếu, chưa đủ điều kiện hoặc quá hạn',
      !!p.referencePrice,
      'high',
    ],
  ];
  const issues: QualityIssue[] = checks
    .filter((c) => !c[2])
    .map(([code, label, , severity]) => ({ code, label, severity }));
  if (p.name?.trim() && /cần đối chiếu|đang rà soát|cần xác minh/i.test(p.name))
    issues.push({
      code: 'name',
      label: 'Tên công khai cần biên tập',
      severity: 'high',
    });
  if (
    p.referencePrice &&
    !priceReady(p.referencePrice, p.referencePrice.minTravelers ?? 1)
  )
    issues.push({
      code: 'price',
      label: 'Giá chưa đủ điều kiện hoặc quá hạn',
      severity: 'high',
    });
  if (!p.mapLocation)
    issues.push({
      code: 'location',
      label: 'Chưa có tọa độ để kiểm tra trên bản đồ',
      severity: 'medium',
    });
  if (!p.openingHoursNote)
    issues.push({
      code: 'hours',
      label: 'Chưa có giờ mở cửa',
      severity: 'medium',
    });
  if (!approvedPhoto(p.images?.[0]))
    issues.push({
      code: 'image',
      label: 'Chưa có ảnh bìa hợp lệ',
      severity: 'high',
    });
  if (now - new Date(p.updatedAt).getTime() > freshnessDays * 86400000)
    issues.push({
      code: 'freshness',
      label: `Chưa biên tập trong ${freshnessDays} ngày`,
      severity: 'medium',
    });
  return {
    completeness: Math.round(
      (checks.filter((c) => c[2]).length / checks.length) * 100,
    ),
    issues,
    freshness:
      now - new Date(p.updatedAt).getTime() > freshnessDays * 86400000
        ? ('stale' as const)
        : ('current' as const),
    // Completeness/freshness never assert that the content has been verified.
    verification: 'unknown' as const,
  };
}
export type AdminOverview = {
  total: number;
  draft: number;
  published: number;
  archived: number;
  needsAttention: number;
  complete: number;
  located: number;
  categories: { category: string; count: number }[];
  issues: { code: string; label: string; count: number }[];
  places: AdminPlaceDto[];
  mapTruncated: boolean;
  sources: {
    manual: number;
    geoapify: number;
    lastAttempt: string | null;
    lastSuccess: string | null;
    lastError: string | null;
  };
  jobs: { active: number; succeeded: number; failed: number };
};
