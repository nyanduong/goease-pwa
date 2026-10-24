import { z } from 'zod';
import { priceReady, type AdminPlaceDto } from './catalog.js';

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
  >,
  freshnessDays = 90,
  now = Date.now(),
) {
  const checks: [string, string, boolean, 'high' | 'medium'][] = [
    [
      'name',
      'Tên công khai cần biên tập',
      !!p.name?.trim() &&
        !/cần đối chiếu|đang rà soát|cần xác minh/i.test(p.name),
      'high',
    ],
    ['description', 'Thiếu giới thiệu', !!p.description?.trim(), 'medium'],
    ['address', 'Thiếu địa chỉ', !!p.locationQuery?.trim(), 'high'],
    ['duration', 'Thiếu thời lượng ước tính', p.durationMinutes > 0, 'medium'],
    ['source', 'Thiếu nguồn đối chiếu', !!p.sourceUrl, 'high'],
    [
      'price',
      'Giá thiếu, chưa đủ điều kiện hoặc quá hạn',
      !!priceReady(p.referencePrice, p.referencePrice?.minTravelers ?? 1),
      'high',
    ],
  ];
  const issues: QualityIssue[] = checks
    .filter((c) => !c[2])
    .map(([code, label, , severity]) => ({ code, label, severity }));
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
  if (!p.imageCredit)
    issues.push({
      code: 'image',
      label: 'Thiếu thông tin quyền sử dụng ảnh',
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
