import { z } from 'zod';
export const placeCategorySchema = z.enum(['food', 'culture', 'nature']);
export type PlaceCategory = z.infer<typeof placeCategorySchema>;
export type PlaceDto = {
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
export const placeQuerySchema = z.strictObject({
  destinationId: z
    .string()
    .regex(/^[a-f0-9]{24}$/)
    .optional(),
  q: z.string().trim().max(100).default(''),
  category: placeCategorySchema.optional(),
  offset: z.coerce.number().int().min(0).max(10000).default(0),
  limit: z.coerce.number().int().min(1).max(30).default(20),
});
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
