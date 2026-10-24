import { z } from 'zod';

// GoEase editorial travel areas, independent of administrative boundaries.
export const tourismRegions = [
  { code: 'northwest', name: 'Tây Bắc', region: 'north' },
  { code: 'northeast', name: 'Đông Bắc', region: 'north' },
  { code: 'northern-delta', name: 'Đồng bằng Bắc Bộ', region: 'north' },
  { code: 'north-central', name: 'Bắc Trung Bộ', region: 'central' },
  {
    code: 'south-central-coast',
    name: 'Duyên hải Nam Trung Bộ',
    region: 'central',
  },
  { code: 'central-highlands', name: 'Tây Nguyên', region: 'central' },
  { code: 'southeast', name: 'Đông Nam Bộ', region: 'south' },
  { code: 'mekong-delta', name: 'Miền Tây (Tây Nam Bộ)', region: 'south' },
] as const;
export const travelRegions = [
  { code: 'north', name: 'Miền Bắc' },
  { code: 'central', name: 'Miền Trung' },
  { code: 'south', name: 'Miền Nam' },
] as const;
export const tourismRegionSchema = z.enum(tourismRegions.map((r) => r.code));
export type TourismRegion = z.infer<typeof tourismRegionSchema>;
export type TravelRegion = (typeof travelRegions)[number]['code'];
export function travelRegionOf(
  code: string | null | undefined,
): TravelRegion | null {
  return tourismRegions.find((r) => r.code === code)?.region ?? null;
}
export const destinationQuerySchema = z
  .strictObject({
    region: z.enum(['north', 'central', 'south']).optional(),
    tourismRegion: tourismRegionSchema.optional(),
    q: z.string().trim().max(100).default(''),
    offset: z.coerce.number().int().min(0).max(10000).default(0),
    limit: z.coerce.number().int().min(1).max(200).default(200),
  })
  .refine(
    (q) =>
      !q.region ||
      !q.tourismRegion ||
      travelRegionOf(q.tourismRegion) === q.region,
    'Miền và vùng du lịch không khớp nhau.',
  );
export const destinationInputSchema = z.strictObject({
  name: z.string().trim().min(1).max(100),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(100),
  summary: z.string().trim().max(1000).default(''),
  tourismRegion: tourismRegionSchema,
  publicationStatus: z
    .enum(['draft', 'published', 'archived'])
    .default('draft'),
});
export const destinationWriteSchema = z.strictObject({
  destination: destinationInputSchema,
  expectedRevision: z
    .number()
    .int()
    .nonnegative()
    .max(Number.MAX_SAFE_INTEGER)
    .optional(),
});
export type DestinationInput = z.infer<typeof destinationInputSchema>;
export type AdminDestinationDto = Omit<DestinationInput, 'tourismRegion'> & {
  tourismRegion: TourismRegion | null;
  id: string;
  revision: number;
  countryCode: 'VN';
  timezone: string;
  region: TravelRegion | null;
};
