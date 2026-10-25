import { z } from 'zod';
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
    minTravelers: z.number().int().min(1).max(1000).optional(),
    conditions: z.string().trim().min(1).max(500),
    inclusions: z.string().trim().min(1).max(500).optional(),
    exclusions: z.string().trim().min(1).max(500).optional(),
    bundle: z
      .strictObject({
        code: z
          .string()
          .trim()
          .regex(/^[a-z0-9-]{3,80}$/),
        validDays: z.number().int().min(1).max(31),
        maxEntries: z.number().int().min(1).max(300),
      })
      .optional(),
    sourceUrl: publicSourceSchema,
    checkedAt: z.iso.date(),
    reviewAfter: z.iso.date(),
  })
  .refine((v) => (v.minTravelers ?? 1) <= v.maxTravelers, {
    message: 'Số người tối thiểu không được lớn hơn số người tối đa.',
  })
  .refine((v) => v.reviewAfter >= v.checkedAt, {
    message: 'Ngày kiểm tra lại phải từ ngày đối chiếu trở đi.',
  });
export type ReferencePrice = z.infer<typeof referencePriceSchema>;
export const catalogToday = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(
    new Date(),
  );
export function priceReady(
  price: ReferencePrice | null | undefined,
  travelers = 1,
) {
  return (
    !!price &&
    referencePriceSchema.safeParse(price).success &&
    !!price.inclusions?.trim() &&
    !!price.exclusions?.trim() &&
    price.checkedAt <= catalogToday() &&
    price.reviewAfter >= catalogToday() &&
    travelers >= (price.minTravelers ?? 1) &&
    travelers <= price.maxTravelers
  );
}
