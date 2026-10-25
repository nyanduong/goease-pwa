import { z } from 'zod';
import { destinationQuerySchema, travelRegionOf } from './geography.js';
import type { ReferencePrice, catalogImageSchema } from './catalog.js';
import type { PlaceProvenance } from './place-import.js';
export const placeCategorySchema = z.enum(['food', 'culture', 'nature']);
export type PlaceCategory = z.infer<typeof placeCategorySchema>;
export const mapLocationSchema = z.strictObject({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  label: z.string().min(1).max(150),
  precision: z.literal('area'),
  sourceUrl: z
    .url()
    .max(2048)
    .refine((v) => v.startsWith('https://')),
  checkedAt: z.iso.date(),
});
export type MapLocation = z.infer<typeof mapLocationSchema>;
export type PlaceDto = {
  images?: z.infer<typeof catalogImageSchema>[] | undefined;
  source?: PlaceProvenance;
  revision?: number;
  venueType?: 'place' | 'restaurant' | 'food_idea';
  openingHoursNote?: string;
  referencePrice?: ReferencePrice | null;
  mapLocation?: MapLocation;
  planning?: {
    durationMinutes: number;
    locationQuery: string;
    costNote: string;
    priceOptions: {
      label: string;
      amountMinor: number;
      basis: 'per_person' | 'group_total';
      sourceUrl: string;
      checkedAt: string;
    }[];
  };
  id: string;
  destinationId: string;
  destinationName: string;
  name: string;
  slug: string;
  category: PlaceCategory;
  subtitle: string;
  description: string;
  descriptionSource?: {
    title: string;
    sourceUrl: string;
    license: string;
    translated: boolean;
  } | null;
  imageUrl: string;
  durationLabel: string;
  travelLabel: string;
  bestTimeLabel: string;
  tip: string;
  highlights: { name: string; query: string }[];
  sourceUrl: string;
  imageCredit: string;
};
export type PlaceStateDto = {
  placeId: string;
  saved: boolean;
  note: string;
  revision: number;
};
export type SavedPlacesDto = {
  items: { place: PlaceDto; state: PlaceStateDto }[];
  unavailable: { placeId: string; state: PlaceStateDto }[];
};
export const placeQuerySchema = z
  .strictObject({
    region: destinationQuerySchema.shape.region,
    tourismRegion: destinationQuerySchema.shape.tourismRegion,
    destinationId: z
      .string()
      .regex(/^[a-f0-9]{24}$/)
      .optional(),
    q: z.string().trim().max(100).default(''),
    category: placeCategorySchema.optional(),
    offset: z.coerce.number().int().min(0).max(10000).default(0),
    limit: z.coerce.number().int().min(1).max(30).default(20),
  })
  .refine(
    (q) =>
      !q.region ||
      !q.tourismRegion ||
      travelRegionOf(q.tourismRegion) === q.region,
  );
export const placeStateInputSchema = z
  .strictObject({
    expectedRevision: z
      .number()
      .int()
      .nonnegative()
      .max(Number.MAX_SAFE_INTEGER),
    saved: z.boolean().optional(),
    note: z.string().max(2000).optional(),
  })
  .refine((v) => v.saved !== undefined || v.note !== undefined);
