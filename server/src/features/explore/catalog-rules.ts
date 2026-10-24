import {
  catalogEditableFields,
  type FieldProvenance,
  type SourceSnapshot,
} from '@goease/contracts';

/** Provider facts are observations; editorial placeholders are still unknown. */
export function initialSourceProvenance(
  source: Pick<
    SourceSnapshot,
    'name' | 'address' | 'openingHoursNote' | 'sourceUrl'
  >,
  receivedAt: string,
): FieldProvenance[] {
  const observed = new Set([
    'name',
    'category',
    'venueType',
    'locationQuery',
    'openingHoursNote',
    'sourceUrl',
    'mapLocation',
  ]);
  return catalogEditableFields.map((field) => {
    const fromSource = observed.has(field);
    const known =
      fromSource &&
      (field !== 'openingHoursNote' || Boolean(source.openingHoursNote)) &&
      (field !== 'locationQuery' || Boolean(source.address));
    return {
      field,
      origin: fromSource ? 'geoapify' : 'legacy',
      state: known ? 'observed' : 'unknown',
      sourceUrl: fromSource ? source.sourceUrl : null,
      receivedAt: fromSource ? receivedAt : null,
      verifiedAt: null,
      validUntil: null,
      actorId: null,
    };
  });
}

/** Pure evaluator used by the worker and simulation; missing evidence is blocked. */
export function evaluateDraftHours(input: {
  enabled: boolean;
  publicationStatus: string;
  locks: readonly string[];
  currentHours: string;
  previous: SourceSnapshot | null;
  incoming: SourceSnapshot;
  hasConflict: boolean;
}) {
  const { previous, incoming } = input;
  if (!input.enabled)
    return { eligible: false, reason: 'Quy tắc tự áp dụng đang tắt.' };
  if (input.publicationStatus !== 'draft')
    return { eligible: false, reason: 'Chỉ tự áp dụng giờ cho bản nháp.' };
  if (input.locks.includes('openingHoursNote'))
    return { eligible: false, reason: 'Biên tập viên đã khóa giờ hoạt động.' };
  if (
    !previous ||
    !incoming.openingHoursNote ||
    input.currentHours !== previous.openingHoursNote
  )
    return {
      eligible: false,
      reason: 'Thiếu mốc so sánh hoặc giờ đã được biên tập.',
    };
  if (input.hasConflict || incoming.closed === true)
    return {
      eligible: false,
      reason: 'Có nghi trùng hoặc nguồn cần đối chiếu.',
    };
  if (previous.openingHoursNote === incoming.openingHoursNote)
    return { eligible: false, reason: 'Giờ hoạt động không thay đổi.' };
  const onlyHours = Object.keys(incoming).every(
    (key) =>
      key === 'openingHoursNote' ||
      JSON.stringify(previous[key as keyof SourceSnapshot]) ===
        JSON.stringify(incoming[key as keyof SourceSnapshot]),
  );
  return onlyHours
    ? {
        eligible: true,
        reason:
          'Chỉ đổi giờ nguồn trên bản nháp chưa biên tập, không có xung đột.',
      }
    : {
        eligible: false,
        reason: 'Có thay đổi quan trọng ngoài giờ hoạt động.',
      };
}
