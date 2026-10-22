import type { TripInput, TripDto } from '@goease/contracts';
export const interests = {
  nature: 'Thiên nhiên',
  food: 'Ẩm thực',
  culture: 'Văn hóa',
  relaxation: 'Nghỉ ngơi',
  adventure: 'Khám phá',
} as const;
export const moneyText = (value: number) =>
  new Intl.NumberFormat('vi-VN').format(value) + ' ₫';
export function initialDraft(): TripInput {
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date());
  return {
    title: '',
    destinations: [],
    startDate: date,
    endDate: date,
    timezone: 'Asia/Ho_Chi_Minh',
    travelers: { totalCount: 1 },
    budget: {
      amountMinor: null,
      currency: 'VND',
      scope: 'group_total',
      includedCategories: [],
    },
    preferences: { interestCodes: [], pace: 'balanced', transportModes: [] },
    generationMode: 'manual',
    days: [],
    notes: '',
  };
}
export function inputFromTrip(data: TripDto): TripInput {
  const {
    title,
    destinations,
    startDate,
    endDate,
    timezone,
    travelers,
    budget,
    preferences,
    generationMode,
    days,
    notes,
  } = data;
  return {
    title,
    destinations,
    startDate,
    endDate,
    timezone,
    travelers,
    budget,
    preferences,
    generationMode,
    days,
    notes,
  };
}
export function withDays(value: TripInput): TripInput {
  const destinationId = value.destinations[0]?.destinationId;
  const count =
    (Date.parse(value.endDate) - Date.parse(value.startDate)) / 86400000 + 1;
  if (!destinationId || !Number.isInteger(count) || count < 1 || count > 31)
    return { ...value, days: [] };
  return {
    ...value,
    days: Array.from({ length: count }, (_, i) => {
      const date = new Date(Date.parse(value.startDate) + i * 86400000)
        .toISOString()
        .slice(0, 10);
      const old = value.days.find((d) => d.date === date);
      return {
        dayId: old?.dayId ?? crypto.randomUUID(),
        date,
        destinationId,
        activities: old?.activities ?? [],
      };
    }),
  };
}
