import { visitInfoSchema } from './visit-info.js';
import { needsPlaceDescription } from './place-description.js';
import { z } from 'zod';
import type { ActivityInput } from './product.js';
import type { PlaceDto } from './explore.js';
import type { PlaceProvenance } from './place-import.js';
import { mapLocationSchema } from './explore.js';

import {
  publicSourceSchema,
  referencePriceSchema,
  priceReady,
} from './reference-price.js';
export {
  publicSourceSchema,
  referencePriceSchema,
  catalogToday,
  priceReady,
  type ReferencePrice,
} from './reference-price.js';
export const catalogImageSchema = z
  .strictObject({
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
    selection: z.enum(['automatic', 'admin']).optional(),
    kind: z.enum(['photo', 'ai_illustration']).optional(),
    // Absent on legacy photos; new writes identify a cached cover versus a source link.
    storage: z.enum(['cloudinary', 'source']).optional(),
    originalUrl: publicSourceSchema.optional(),
  })
  .superRefine((image, ctx) => {
    if (
      image.storage === 'cloudinary' &&
      !/^https:\/\/res\.cloudinary\.com\//.test(image.url)
    )
      ctx.addIssue({
        code: 'custom',
        path: ['storage'],
        message: 'Ảnh đã lưu phải dùng URL Cloudinary hợp lệ.',
      });
  });
export type CatalogImage = z.infer<typeof catalogImageSchema>;
export function approvedPhoto(image: unknown): boolean {
  const parsed = catalogImageSchema.safeParse(image);
  if (!parsed.success) return false;
  const value = parsed.data;
  return (
    value.kind !== 'ai_illustration' &&
    (value.reviewed === true ||
      value.selection === 'automatic' ||
      value.selection === 'admin') &&
    !/minh họa|\bAI\b|generated|illustration/i.test(value.credit)
  );
}
export function approvedIllustration(image: unknown): boolean {
  const parsed = catalogImageSchema.safeParse(image);
  if (!parsed.success) return false;
  const value = parsed.data;
  return (
    value.kind === 'ai_illustration' &&
    (value.reviewed === true ||
      value.selection === 'admin' ||
      value.selection === 'automatic') &&
    ['owned', 'permission'].includes(value.license) &&
    !/^https:\/\/(?:commons|upload|thumb)\.wikimedia\.org\//i.test(
      value.sourceUrl,
    )
  );
}
export const approvedCover = (image: CatalogImage | undefined) =>
  approvedPhoto(image) || approvedIllustration(image);
export function catalogGallery(images: unknown[]): CatalogImage[] {
  const parsed = images.flatMap((image) => {
    const value = catalogImageSchema.safeParse(image);
    return value.success ? [value.data] : [];
  });
  const photos = parsed
    .filter(approvedPhoto)
    .filter(
      (image, index, all) =>
        all.findIndex(
          (other) =>
            (other.originalUrl ?? other.url) ===
            (image.originalUrl ?? image.url),
        ) === index,
    );
  return photos.length
    ? photos
        .slice(0, 5)
        .map((image, index) =>
          index > 0 && image.storage === 'cloudinary' && image.originalUrl
            ? { ...image, url: image.originalUrl, storage: 'source' as const }
            : image,
        )
    : parsed.filter(approvedIllustration).slice(0, 1);
}
export const catalogImageCover = (images: unknown[]) =>
  catalogGallery(images)[0];
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
  defaultCover?: CatalogImage | null;
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
  'visitInfo',
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
    description: z.string().trim().max(2000),
    locationQuery: z.string().trim().min(1).max(200),
    durationMinutes: z.number().int().min(15).max(720),
    openingHoursNote: z.string().trim().max(400),
    sourceUrl: publicSourceSchema,
    referencePrice: referencePriceSchema.nullable(),
    visitInfo: visitInfoSchema.nullable().optional(),
    publicationStatus: z.enum(['draft', 'published', 'archived']),
    mapLocation: mapLocationSchema.nullable().optional(),
    internalNote: z.string().trim().max(1000).optional(),
    images: z.array(catalogImageSchema).max(5).optional(),
    fieldLocks: z
      .array(catalogFieldSchema)
      .max(catalogEditableFields.length)
      .refine((fields) => new Set(fields).size === fields.length)
      .optional(),
  })
  .superRefine((v, ctx) => {
    if (
      v.images?.some((image) => image.kind === 'ai_illustration') &&
      (v.images.length !== 1 || !approvedIllustration(v.images[0]))
    )
      ctx.addIssue({
        code: 'custom',
        path: ['images'],
        message:
          'Chỉ dùng một ảnh minh họa AI có quyền sử dụng riêng khi chưa có ảnh thật; không trộn hai loại ảnh.',
      });
    if (
      v.publicationStatus === 'published' &&
      (v.visitInfo?.hours?.reviewed === false ||
        v.visitInfo?.price?.reviewed === false)
    )
      ctx.addIssue({
        code: 'custom',
        path: ['visitInfo'],
        message:
          'Kiểm tra hoặc bỏ thông tin giờ/giá lấy từ nguồn trước khi xuất bản.',
      });
    if (
      v.publicationStatus === 'published' &&
      needsPlaceDescription(v.description)
    )
      ctx.addIssue({
        code: 'custom',
        path: ['description'],
        message: 'Cần giới thiệu địa điểm có nội dung trước khi xuất bản.',
      });
    if (v.publicationStatus === 'published' && !approvedCover(v.images?.[0]))
      ctx.addIssue({
        code: 'custom',
        path: ['images'],
        message: 'Cần có ảnh bìa hợp lệ trước khi xuất bản.',
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
  publicationReadiness?: { ready: boolean; label: string };
  photoSearch?: { state: string; count: number };
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
    approvedCover(place.images?.[0]) &&
    !!place.name.trim() &&
    !needsPlaceDescription(place.description) &&
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
