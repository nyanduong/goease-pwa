import { z } from 'zod';
const evidence = {
  sourceUrl: z
    .url()
    .max(2048)
    .refine((v) => new URL(v).protocol === 'https:'),
  observedAt: z.iso.datetime(),
  reviewed: z.boolean(),
};
export const visitInfoSchema = z.strictObject({
  hours: z
    .strictObject({ ...evidence, text: z.string().trim().min(1).max(400) })
    .nullable(),
  price: z
    .strictObject({
      ...evidence,
      amount: z.number().int().min(0).max(1e9),
      currency: z.literal('VND'),
      unit: z.enum(['person', 'item', 'group', 'unspecified']),
      conditions: z.string().trim().min(1).max(500),
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
