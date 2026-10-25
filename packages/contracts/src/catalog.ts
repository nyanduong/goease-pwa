import { z } from 'zod';
import type { ActivityInput } from './product.js';
import type { PlaceDto } from './explore.js';
import type { PlaceProvenance } from './place-import.js';
import { mapLocationSchema } from './explore.js';

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
export const catalogImageSchema = z.strictObject({
  url: publicSourceSchema,
  credit: z.string().trim().min(1).max(1000),
  license: z.enum([
    'owned',
    'permission',
    'CC0',
    'Public-domain',
    'CC-BY-2.0',
    'CC-BY-2.5',
    'CC-BY-3.0',
    'CC-BY-4.0',
    'CC-BY-SA-2.0',
    'CC-BY-SA-2.5',
    'CC-BY-SA-3.0',
    'CC-BY-SA-4.0',
  ]),
  sourceUrl: publicSourceSchema,
  licenseUrl: publicSourceSchema.optional(),
  reviewed: z.boolean().optional(),
});
export type CatalogImage = z.infer<typeof catalogImageSchema>;
export const approvedPhoto = (image: CatalogImage | undefined) =>
  !!image &&
  image.reviewed === true &&
  !/minh họa|\bAI\b|generated|illustration/i.test(image.credit) &&
  catalogImageSchema.safeParse(image).success;
export function catalogPhotoCover(images: unknown[]) {
  const parsed = catalogImageSchema.safeParse(images[0]);
  return parsed.success && approvedPhoto(parsed.data) ? parsed.data : undefined;
}
export const imageCandidateSchema = z.strictObject({
  id: z.string().max(40),
  title: z.string().max(300),
  match: z.enum(['name', 'nearby']),
  image: catalogImageSchema,
});
export type ImageCandidate = z.infer<typeof imageCandidateSchema>;
export type PlaceImageSearchDto = {
  state: string;
  candidates: ImageCandidate[];
  message: string;
  checkedAt: string | null;
};
export const priceSnapshotSchema = referencePriceSchema.safeExtend({
  placeRevision: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
});
export const catalogEditableFields = [
  'name',
  'description',
  'category',
  'venueType',
  'locationQuery',
  'durationMinutes',
  'openingHoursNote',
  'sourceUrl',
  'referencePrice',
  'mapLocation',
  'images',
] as const;
export const catalogFieldSchema = z.enum(catalogEditableFields);
export type CatalogField = z.infer<typeof catalogFieldSchema>;
export const fieldProvenanceSchema = z.strictObject({
  field: catalogFieldSchema,
  origin: z.enum(['manual', 'geoapify', 'legacy']),
  sourceUrl: publicSourceSchema.nullable(),
  receivedAt: z.iso.datetime().nullable(),
  verifiedAt: z.iso.datetime().nullable(),
  validUntil: z.iso.date().nullable(),
  actorId: z
    .string()
    .regex(/^[a-f0-9]{24}$/)
    .nullable(),
  state: z.enum(['unknown', 'observed', 'edited', 'verified']),
});
export type FieldProvenance = z.infer<typeof fieldProvenanceSchema>;
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
    mapLocation: mapLocationSchema.nullable().optional(),
    internalNote: z.string().trim().max(1000).optional(),
    images: z.array(catalogImageSchema).max(8).optional(),
    fieldLocks: z
      .array(catalogFieldSchema)
      .max(catalogEditableFields.length)
      .refine((fields) => new Set(fields).size === fields.length)
      .optional(),
  })
  .superRefine((v, ctx) => {
    if (v.publicationStatus === 'published' && !approvedPhoto(v.images?.[0]))
      ctx.addIssue({
        code: 'custom',
        path: ['images'],
        message:
          'Cần ảnh bìa thật đã được admin duyệt và đủ nguồn/quyền sử dụng trước khi xuất bản.',
      });
    if (
      v.publicationStatus === 'published' &&
      /cần đối chiếu|đang rà soát|cần xác minh/i.test(
        `${v.name} ${v.description}`,
      )
    )
      ctx.addIssue({
        code: 'custom',
        message:
          'Chuyển ghi chú rà soát vào ghi chú nội bộ trước khi xuất bản.',
      });
    if (v.referencePrice?.bundle && v.category === 'food')
      ctx.addIssue({
        code: 'custom',
        message: 'Vé gói chỉ dùng cho điểm tham quan, không gộp các bữa ăn.',
      });
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
  imageUrl?: string;
  imageCredit?: string;
  proposalRevision?: number | null;
  publicRevision?: number | null;
  fieldProvenance?: FieldProvenance[];
  capabilities?: {
    discovery: boolean;
    scheduling: boolean;
    budgeting: boolean;
  };
};
export const adminPlaceWriteSchema = z.strictObject({
  place: adminPlaceInputSchema,
  expectedRevision: z
    .number()
    .int()
    .min(0)
    .max(Number.MAX_SAFE_INTEGER)
    .optional(),
  intent: z.enum(['save', 'publish']).default('save'),
});

// Discovery is independent of scheduling and money. Missing facts remain unknown.
// The same narrow editorial hours gate is used by the actual Goe planner.
export function plannerHoursReady(note: string | null | undefined) {
  return (
    !/chưa xác minh|chưa thống nhất|chưa rõ|tạm đóng cửa/i.test(note ?? '') &&
    /(?:[01]\d|2[0-3]):[0-5]\d\s*[–-]\s*(?:[01]\d|2[0-3]):[0-5]\d/.test(
      note ?? '',
    )
  );
}
export function catalogCapabilities(
  place: Pick<
    AdminPlaceInput,
    | 'name'
    | 'description'
    | 'locationQuery'
    | 'sourceUrl'
    | 'durationMinutes'
    | 'openingHoursNote'
    | 'referencePrice'
    | 'venueType'
    | 'images'
  >,
  travelers = 1,
) {
  const discovery =
    approvedPhoto(place.images?.[0]) &&
    !!place.name.trim() &&
    !!place.description.trim() &&
    !!place.locationQuery.trim() &&
    publicSourceSchema.safeParse(place.sourceUrl).success &&
    !/cần đối chiếu|đang rà soát|cần xác minh/i.test(
      `${place.name} ${place.description}`,
    );
  const budgeting =
    place.venueType !== 'food_idea' &&
    priceReady(place.referencePrice, travelers);
  return {
    discovery,
    scheduling:
      discovery &&
      budgeting &&
      plannerHoursReady(place.openingHoursNote) &&
      place.durationMinutes > 0 &&
      !/^\s*\[(?:TEST|KIỂM THỬ)\]/i.test(place.name),
    budgeting,
  };
}
export const adminPlaceQuerySchema = z.strictObject({
  q: z.string().trim().max(100).default(''),
  status: z.enum(['all', 'draft', 'published', 'archived']).default('all'),
  offset: z.coerce.number().int().min(0).max(1000000).default(0),
  destinationId: z
    .string()
    .regex(/^[a-f0-9]{24}$/)
    .optional(),
  category: z.enum(['all', 'food', 'culture', 'nature']).default('all'),
  source: z.enum(['all', 'manual', 'geoapify']).default('all'),
  quality: z.enum(['all', 'price', 'hours', 'location']).default('all'),
  sort: z.enum(['updated', 'oldest', 'name']).default('updated'),
});
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
// Snapshot selection only. Totals and persisted provenance are checked by the API.
export function catalogCost(
  place: Pick<PlaceDto, 'referencePrice' | 'revision'>,
): ActivityInput['estimatedCost'] {
  const price = place.referencePrice;
  if (!price || !priceReady(price, price.minTravelers ?? 1))
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
  return (
    !cost.reference ||
    (travelers >= (cost.reference.minTravelers ?? 1) &&
      travelers <= cost.reference.maxTravelers)
  );
}
