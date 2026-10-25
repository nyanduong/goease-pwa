import { referencePriceSchema } from './reference-price.js';
import { z } from 'zod';
const evidence = {
  sourceUrl: z
    .url()
    .max(2048)
    .refine((v) => {
      try {
        return new URL(v).protocol === 'https:';
      } catch {
        return false;
      }
    }),
  observedAt: z.iso.datetime(),
  reviewed: z.boolean(),
};
export const visitPriceTermsSchema = z.strictObject({
  audience: z.enum(['standard', 'restricted', 'unknown']).optional(),
  label: z.string().trim().max(120).optional(),
  minTravelers: z.number().int().min(1).max(1000).optional(),
  maxTravelers: z.number().int().min(1).max(1000).optional(),
  inclusions: z.string().trim().max(500).optional(),
  exclusions: z.string().trim().max(500).optional(),
  checkedAt: z.union([z.iso.date(), z.literal('')]).optional(),
  reviewAfter: z.union([z.iso.date(), z.literal('')]).optional(),
  bundle: referencePriceSchema.shape.bundle,
});
export const visitInfoSchema = z.strictObject({
  pricingVersion: z.literal(1).optional(),
  hours: z
    .strictObject({ ...evidence, text: z.string().trim().min(1).max(400) })
    .nullable(),
  price: z
    .strictObject({
      ...evidence,
      amount: z.number().int().min(0).max(1e12),
      currency: z.literal('VND'),
      unit: z.enum(['person', 'item', 'group', 'unspecified']),
      conditions: z.string().trim().min(1).max(500),
      terms: visitPriceTermsSchema.optional(),
    })
    .nullable(),
});
export type VisitInfo = z.infer<typeof visitInfoSchema>;
export type VisitInfoSearchDto = {
  state: 'pending' | 'searching' | 'ready' | 'empty' | 'failed';
  result: VisitInfo | null;
  message: string;
  checkedAt: string | null;
};
export function visitPriceLabel(price: NonNullable<VisitInfo['price']>) {
  if (price.amount === 0) return 'Miễn phí';
  const suffix = {
    person: '/người',
    item: '/món',
    group: '/nhóm',
    unspecified: '',
  }[price.unit];
  return `Từ ${price.amount.toLocaleString('vi-VN')}đ${suffix}`;
}
