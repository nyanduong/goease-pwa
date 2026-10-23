import { z } from 'zod';
import type { ActivityInput } from './product.js';
import type { PlaceDto } from './explore.js';
import type { PlaceProvenance } from './place-import.js';

export const publicSourceSchema = z
  .string()
  .trim()
  .max(2048)
  .refine((v) => {
    try {
      const u = new URL(v);
      return u.protocol === 'https:' && !u.username && !u.password;
    } catch {
      return false;
    }
  }, 'Nhập đường dẫn nguồn HTTPS hợp lệ.');
export const referencePriceSchema = z
  .strictObject({
    label: z.string().trim().min(1).max(120),
    amountMinor: z.number().int().min(0).max(1e12),
    basis: z.enum(['per_person', 'group_total']),
    maxTravelers: z.number().int().min(1).max(1000),
    conditions: z.string().trim().min(1).max(500),
    sourceUrl: publicSourceSchema,
    checkedAt: z.iso.date(),
    reviewAfter: z.iso.date(),
  })
  .refine((v) => v.reviewAfter >= v.checkedAt, {
    message: 'Ngày kiểm tra lại phải từ ngày đối chiếu trở đi.',
  });
export type ReferencePrice = z.infer<typeof referencePriceSchema>;
export const priceSnapshotSchema = referencePriceSchema.safeExtend({
  placeRevision: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
});
export const adminPlaceInputSchema = z
  .strictObject({
    destinationId: z.string().regex(/^[a-f0-9]{24}$/),
    name: z.string().trim().min(1).max(120),
    category: z.enum(['food', 'culture', 'nature']),
    venueType: z.enum(['place', 'restaurant', 'food_idea']),
    description: z.string().trim().min(1).max(2000),
    locationQuery: z.string().trim().min(1).max(200),
    durationMinutes: z.number().int().min(15).max(720),
    openingHoursNote: z.string().trim().max(400),
    sourceUrl: publicSourceSchema,
    referencePrice: referencePriceSchema.nullable(),
    publicationStatus: z.enum(['draft', 'published', 'archived']),
  })
  .superRefine((v, ctx) => {
    if ((v.category === 'food') !== (v.venueType !== 'place'))
      ctx.addIssue({
        code: 'custom',
        message: 'Quán ăn/gợi ý món ăn phải thuộc nhóm Ăn uống.',
      });
    if (v.venueType === 'food_idea' && v.referencePrice)
      ctx.addIssue({
        code: 'custom',
        message: 'Chọn quán cụ thể trước khi bật giá tự động.',
      });
  });
export type AdminPlaceInput = z.infer<typeof adminPlaceInputSchema>;
export type AdminPlaceDto = AdminPlaceInput & {
  source?: PlaceProvenance;
  id: string;
  revision: number;
  updatedAt: string;
};
export const adminPlaceWriteSchema = z.strictObject({
  place: adminPlaceInputSchema,
  expectedRevision: z
    .number()
    .int()
    .min(0)
    .max(Number.MAX_SAFE_INTEGER)
    .optional(),
});
export const adminPlaceQuerySchema = z.strictObject({
  q: z.string().trim().max(100).default(''),
  status: z.enum(['all', 'draft', 'published', 'archived']).default('all'),
  offset: z.coerce.number().int().min(0).max(1000000).default(0),
});
export const catalogToday = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(
    new Date(),
  );
// Snapshot selection only. Totals and persisted provenance are checked by the API.
export function catalogCost(
  place: Pick<PlaceDto, 'referencePrice' | 'revision'>,
): ActivityInput['estimatedCost'] {
  const price = place.referencePrice;
  if (
    !price ||
    price.checkedAt > catalogToday() ||
    price.reviewAfter < catalogToday()
  )
    return {
      amountMinor: null,
      currency: 'VND',
      basis: 'group_total',
      quantity: 1,
      confidence: 'user_entered',
    };
  return {
    amountMinor: price.amountMinor,
    currency: 'VND',
    basis: price.basis,
    quantity: 1,
    confidence: 'catalog_reference',
    reference: { ...price, placeRevision: place.revision ?? 0 },
  };
}
export function priceFitsGroup(
  cost: ActivityInput['estimatedCost'],
  travelers: number,
) {
  return !cost.reference || travelers <= cost.reference.maxTravelers;
}
