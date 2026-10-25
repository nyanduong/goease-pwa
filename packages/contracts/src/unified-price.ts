import {
  catalogToday,
  referencePriceSchema,
  type ReferencePrice,
} from './reference-price.js';
import type { VisitInfo } from './visit-info.js';
export function sharedPriceBudget(
  price: VisitInfo['price'] | undefined,
  venueType: string,
  today = catalogToday(),
): { referencePrice: ReferencePrice | null; reasons: string[] } {
  const reasons: string[] = [];
  if (!price)
    return { referencePrice: null, reasons: ['Chưa có giá được xác nhận.'] };
  if (!price.reviewed) reasons.push('Xác nhận giá sau khi kiểm tra nguồn.');
  if (venueType === 'food_idea')
    reasons.push('Chọn một quán cụ thể để tính chi phí.');
  if (price.unit !== 'person' && price.unit !== 'group')
    reasons.push(
      price.unit === 'item'
        ? 'Giá một món chưa đại diện cho chi phí một bữa ăn.'
        : 'Chọn đơn vị mỗi người hoặc mỗi nhóm.',
    );
  const t = price.terms;
  if (t?.audience !== 'standard')
    reasons.push(
      t?.audience === 'restricted'
        ? 'Giá ưu đãi hoặc đối tượng đặc biệt chỉ dùng để tham khảo.'
        : 'Xác định đây là giá thông thường cho người lớn hoặc suất ăn tiêu chuẩn.',
    );
  if (!t?.inclusions?.trim()) reasons.push('Nêu dịch vụ đã bao gồm trong giá.');
  if (!t?.exclusions?.trim())
    reasons.push('Nêu dịch vụ chưa bao gồm; ghi “Không có” nếu phù hợp.');
  if (!t?.checkedAt || t.checkedAt > today)
    reasons.push('Cần ngày xác nhận hợp lệ, không ở tương lai.');
  if (
    !t?.reviewAfter ||
    t.reviewAfter < today ||
    (!!t.checkedAt && t.reviewAfter < t.checkedAt)
  )
    reasons.push('Giá cần có thời hạn kiểm tra còn hiệu lực.');
  const min = t?.minTravelers ?? 1,
    max = t?.maxTravelers ?? (price.unit === 'group' ? undefined : 1000);
  if (max === undefined)
    reasons.push('Xác định số người áp dụng cho giá nhóm.');
  else if (min > max) reasons.push('Giới hạn số người chưa hợp lệ.');
  if (venueType !== 'place' && t?.bundle)
    reasons.push('Vé gói chỉ áp dụng cho điểm tham quan.');
  const parsed = referencePriceSchema.safeParse({
    label:
      t?.label ||
      (venueType === 'restaurant'
        ? 'Chi phí bữa ăn tham khảo'
        : 'Chi phí tham quan'),
    amountMinor: price.amount,
    basis: price.unit === 'person' ? 'per_person' : 'group_total',
    minTravelers: min,
    maxTravelers: max,
    conditions: price.conditions,
    inclusions: t?.inclusions,
    exclusions: t?.exclusions,
    sourceUrl: price.sourceUrl,
    checkedAt: t?.checkedAt,
    reviewAfter: t?.reviewAfter,
    ...(t?.bundle ? { bundle: t.bundle } : {}),
  });
  if (!parsed.success && !reasons.length)
    reasons.push('Kiểm tra lại số tiền, nguồn và điều kiện của giá.');
  return {
    referencePrice: !reasons.length && parsed.success ? parsed.data : null,
    reasons,
  };
}
/** Legacy prices enter the same editor with the original amount, terms, validity and bundle. */
export function visitInfoForEditor(
  info: VisitInfo | null | undefined,
  reference: ReferencePrice | null | undefined,
): VisitInfo {
  if (info?.pricingVersion === 1) return info;
  const legacy = reference
    ? {
        amount: reference.amountMinor,
        currency: 'VND' as const,
        unit:
          reference.basis === 'per_person'
            ? ('person' as const)
            : ('group' as const),
        conditions: reference.conditions,
        sourceUrl: reference.sourceUrl,
        observedAt: reference.checkedAt + 'T00:00:00.000Z',
        reviewed: true,
        terms: {
          audience: 'standard' as const,
          label: reference.label,
          minTravelers: reference.minTravelers ?? 1,
          maxTravelers: reference.maxTravelers,
          inclusions: reference.inclusions ?? '',
          exclusions: reference.exclusions ?? '',
          checkedAt: reference.checkedAt,
          reviewAfter: reference.reviewAfter,
          ...(reference.bundle ? { bundle: reference.bundle } : {}),
        },
      }
    : null;
  const current = info?.price;
  const same =
    !!current &&
    !!legacy &&
    current.amount === legacy.amount &&
    current.unit === legacy.unit &&
    current.sourceUrl === legacy.sourceUrl &&
    current.conditions === legacy.conditions;
  return {
    ...info,
    hours: info?.hours ?? null,
    pricingVersion: 1,
    price: current
      ? {
          ...current,
          ...(!current.terms && same ? { terms: legacy.terms } : {}),
        }
      : legacy,
  };
}
export function synchronizeSharedPrice<
  T extends {
    visitInfo?: VisitInfo | null | undefined;
    referencePrice: ReferencePrice | null;
    venueType: string;
  },
>(input: T): T {
  if (input.visitInfo == null) return input;
  const visitInfo = { ...input.visitInfo, pricingVersion: 1 as const };
  return {
    ...input,
    visitInfo,
    referencePrice: sharedPriceBudget(visitInfo.price, input.venueType)
      .referencePrice,
  };
}
