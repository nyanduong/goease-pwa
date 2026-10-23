import {
  catalogCost,
  type PlaceDto,
  type PlannerRequest,
} from '@goease/contracts';
import { generatedPlanSchema, type GeneratedPlan } from './gemini.js';

const toClock = (minutes: number) =>
  `${Math.floor(minutes / 60)}`.padStart(2, '0') +
  ':' +
  `${minutes % 60}`.padStart(2, '0');

// AI ranks candidates; the server constructs a feasible day from the supplied
// catalog. This is not a fallback for provider errors or a routing service.
export function arrangeCompleteDays(
  raw: unknown,
  input: PlannerRequest,
  places: PlaceDto[],
): GeneratedPlan {
  const plan = generatedPlanSchema.parse(raw);
  if (
    JSON.stringify(plan.days.map((d) => d.date)) !==
      JSON.stringify(input.trip.days.map((d) => d.date)) ||
    plan.days.some((d) =>
      d.stops.some((s) => !places.some((p) => p.id === s.placeId)),
    )
  )
    throw new Error('Invalid provider selection');
  const visits = places.filter((p) => p.category !== 'food');
  const meals = places.filter(
    (p) =>
      p.category === 'food' &&
      p.venueType === 'restaurant' &&
      /nhà hàng|restaurant|món chay|foods/i.test(`${p.name} ${p.description}`),
  );
  if (visits.length < 4 || meals.length < 2) return plan;
  const used = new Set<string>();
  const max = itineraryPolicy(input).maxStops;
  return {
    days: plan.days.map((day) => {
      const ranked = day.stops.map((s) => s.placeId);
      const ordered = (pool: PlaceDto[]) =>
        [...pool].sort((a, b) => {
          const ai = ranked.indexOf(a.id),
            bi = ranked.indexOf(b.id);
          return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
        });
      const stops: GeneratedPlan['days'][number]['stops'] = [];
      let end = 510;
      const take = (
        pool: PlaceDto[],
        earliest: number,
        latestStart: number,
        latestEnd: number,
        visit: boolean,
      ) => {
        for (const p of ordered(pool)) {
          if (
            (visit && used.has(p.id)) ||
            stops.some((s) => s.placeId === p.id)
          )
            continue;
          for (
            let start = Math.max(earliest, end + 30);
            start <= latestStart;
            start += 15
          ) {
            const finish = start + p.planning!.durationMinutes;
            if (
              finish > latestEnd ||
              outsideKnownHours(p, day.date, start, finish)
            )
              continue;
            stops.push({
              placeId: p.id,
              start: toClock(start),
              end: toClock(finish),
            });
            end = finish;
            if (visit) used.add(p.id);
            return true;
          }
        }
        return false;
      };
      if (
        !take(visits, 540, 660, 750, true) ||
        !take(meals, 720, 840, 900, false) ||
        !take(visits, 840, 990, 1080, true)
      )
        throw new Error('Insufficient available catalog for full day');
      // Keep at least two unused visits for each remaining day before adding extras.
      const remainingDays = plan.days.length - plan.days.indexOf(day) - 1;
      while (
        stops.length < max - 1 &&
        visits.filter((p) => !used.has(p.id)).length > remainingDays * 2
      ) {
        if (
          !take(
            visits.filter((p) => ranked.includes(p.id)),
            900,
            1020,
            1080,
            true,
          )
        )
          break;
      }
      if (!take(meals, 1080, 1200, 1320, false))
        throw new Error('No available dinner');
      return { date: day.date, stops };
    }),
  };
}

export function itineraryPolicy(input: PlannerRequest, adjustment = false) {
  const existingStops = Math.min(
    6,
    Math.max(0, ...input.trip.days.map((d) => d.activities.length)),
  );
  return {
    maxStops: Math.max(
      adjustment ? existingStops : 0,
      (adjustment
        ? { relaxed: 2, balanced: 3, active: 6 }
        : { relaxed: 4, balanced: 5, active: 6 })[input.trip.preferences.pace],
    ),
    fullDays: !adjustment,
  };
}

export function eligibleForPlanner(place: PlaceDto) {
  return (
    Boolean(place.planning) &&
    place.venueType !== 'food_idea' &&
    !/^\s*\[(?:TEST|KIỂM THỬ)\]/i.test(place.name) &&
    !/tạm đóng cửa/i.test(place.openingHoursNote ?? '')
  );
}

// Only this narrow, documented editorial format is executable. Other notes
// remain provider context; no claim that arbitrary prose is an hours schema.
export function outsideKnownHours(
  place: PlaceDto,
  date: string,
  start: number,
  end: number,
) {
  const note = place.openingHoursNote ?? '';
  const closed = note.match(/đóng cửa ngày (\d{1,2}) và (\d{1,2}) hằng tháng/i);
  if (
    closed &&
    [Number(closed[1]), Number(closed[2])].includes(Number(date.slice(-2)))
  )
    return true;
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  const closure = note.match(
    /(?:nghỉ|đóng cửa)\s+((?:thứ\s*(?:hai|ba|tư|năm|sáu|bảy|[2-7])|chủ nhật)(?:\s*[/,và]+\s*(?:thứ\s*(?:hai|ba|tư|năm|sáu|bảy|[2-7])|chủ nhật))*)/i,
  );
  if (closure) {
    const names = [
      'chủ nhật',
      'thứ hai',
      'thứ ba',
      'thứ tư',
      'thứ năm',
      'thứ sáu',
      'thứ bảy',
    ];
    const text = closure[1]!.toLowerCase().replace(/\s+/g, ' ');
    if (
      text.includes(names[weekday]!) ||
      (weekday > 0 && text.includes(`thứ ${weekday + 1}`))
    )
      return true;
  }
  if (/chưa xác minh|chưa thống nhất/i.test(note)) return false;
  const ranges = [
    ...note.matchAll(/(\d{2}):(\d{2})\s*[–-]\s*(\d{2}):(\d{2})/g),
  ];
  if (!ranges.length) return false;
  return !ranges.some((hours) => {
    const open = Number(hours[1]) * 60 + Number(hours[2]);
    const close = Number(hours[3]) * 60 + Number(hours[4]);
    return close < open
      ? (start >= open && end <= 1440) || end <= close
      : start >= open && end <= close;
  });
}

export function plannerCatalog(places: PlaceDto[]) {
  return places.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    venueType: p.venueType,
    description: p.description,
    durationMinutes: p.planning!.durationMinutes,
    location: p.planning!.locationQuery,
    coordinates: p.mapLocation
      ? { latitude: p.mapLocation.latitude, longitude: p.mapLocation.longitude }
      : null,
    openingHoursNote: p.openingHoursNote ?? '',
    referenceCost: catalogCost(p),
  }));
}
