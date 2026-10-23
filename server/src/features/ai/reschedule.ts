import {
  catalogCost,
  priceFitsGroup,
  shiftTripDays,
  tripInputSchema,
  type TripInput,
  type PlaceDto,
} from '@goease/contracts';
import { randomUUID } from 'node:crypto';
import { HttpError } from '../../http-error.js';
import { eligibleForPlanner, outsideKnownHours } from './itinerary-policy.js';

const minutes = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
const clock = (n: number) =>
  `${Math.floor(n / 60)}`.padStart(2, '0') + ':' + `${n % 60}`.padStart(2, '0');

// Work on a copy: failure never returns a partially repaired itinerary.
export function rescheduleDates(
  input: TripInput,
  startDate: string,
  endDate: string,
  catalog: PlaceDto[],
) {
  const trip = structuredClone(
    shiftTripDays(input, startDate, endDate, randomUUID),
  );
  const places = catalog.filter((p) =>
    eligibleForPlanner(p, trip.travelers.totalCount),
  );
  const occupied = new Set(
    trip.days.flatMap((d) =>
      d.activities.filter((a) => a.kind !== 'meal').map((a) => a.placeId),
    ),
  );
  const changes: string[] = [];
  for (const day of trip.days) {
    let end = 390;
    const used = new Set<string>();
    for (let i = 0; i < day.activities.length; i++) {
      const activity = day.activities[i]!;
      if (!activity.placeId) {
        // Personal appointments remain fixed, including their notes and costs.
        if (activity.startLocalTime && activity.endLocalTime) {
          if (minutes(activity.startLocalTime) < end + 30) throw unavailable();
          end = minutes(activity.endLocalTime);
        }
        continue;
      }
      const original = places.find((p) => p.id === activity.placeId);
      const sameKind = (p: PlaceDto) =>
        activity.kind === 'meal'
          ? p.category === 'food' &&
            p.venueType === 'restaurant' &&
            /nhà hàng|restaurant|món chay|foods/i.test(
              `${p.name} ${p.description}`,
            )
          : p.category !== 'food';
      const alternatives = places.filter(
        (p) =>
          p.destinationId === day.destinationId &&
          sameKind(p) &&
          !used.has(p.id) &&
          !occupied.has(p.id),
      );
      // Prefer the same category; preserve the original stop whenever its hours permit.
      alternatives.sort(
        (a, b) =>
          Number(b.category === original?.category) -
          Number(a.category === original?.category),
      );
      const candidates = [
        ...(original && sameKind(original) && !used.has(original.id)
          ? [original]
          : []),
        ...alternatives,
      ];
      const preferred = activity.startLocalTime
        ? minutes(activity.startLocalTime)
        : end + 30;
      const meal = activity.kind === 'meal';
      const earliest = meal ? (preferred < 960 ? 660 : 1020) : 420;
      const latest = meal ? (preferred < 960 ? 840 : 1200) : 1260;
      const nextFixed = day.activities
        .slice(i + 1)
        .find((a) => !a.placeId && a.startLocalTime);
      const deadline = nextFixed?.startLocalTime
        ? minutes(nextFixed.startLocalTime) - 30
        : 1320;
      let found = false;
      for (const place of candidates) {
        const duration =
          place.id === activity.placeId &&
          activity.startLocalTime &&
          activity.endLocalTime
            ? Math.max(
                place.planning!.durationMinutes,
                minutes(activity.endLocalTime) -
                  minutes(activity.startLocalTime),
              )
            : place.planning!.durationMinutes;
        const first = Math.max(end + 30, earliest);
        const slots = [
          ...new Set([
            Math.max(first, preferred),
            ...Array.from(
              { length: Math.max(0, Math.floor((latest - first) / 15) + 1) },
              (_, n) => first + n * 15,
            ),
          ]),
        ];
        for (const start of slots) {
          if (
            start > latest ||
            start + duration > deadline ||
            outsideKnownHours(place, day.date, start, start + duration)
          )
            continue;
          const replacement = place.id !== activity.placeId;
          if (
            !replacement &&
            (activity.estimatedCost.amountMinor === null ||
              !priceFitsGroup(
                activity.estimatedCost,
                trip.travelers.totalCount,
              ))
          ) {
            activity.estimatedCost = catalogCost(place);
            changes.push(
              `${day.date}: cập nhật giá đủ điều kiện cho ${place.name}`,
            );
          }
          if (replacement) {
            changes.push(`${day.date}: ${activity.title} → ${place.name}`);
            activity.placeId = place.id;
            activity.title = place.name;
            activity.estimatedCost = catalogCost(place);
            // Keep the activity identity so saved expenses remain attached.
            const oldPlace = catalog.find(
              (p) =>
                p.id ===
                input.days
                  .find((d) => d.dayId === day.dayId)
                  ?.activities.find((a) => a.activityId === activity.activityId)
                  ?.placeId,
            );
            const defaultNotes = [
              oldPlace?.planning?.locationQuery,
              oldPlace?.openingHoursNote,
            ]
              .filter(Boolean)
              .join('\n')
              .slice(0, 500);
            if (activity.notes === defaultNotes)
              activity.notes = [
                place.planning!.locationQuery,
                place.openingHoursNote,
              ]
                .filter(Boolean)
                .join('\n')
                .slice(0, 500);
          } else if (activity.startLocalTime !== clock(start)) {
            changes.push(
              `${day.date}: ${activity.title} chuyển sang ${clock(start)}`,
            );
          }
          activity.startLocalTime = clock(start);
          activity.endLocalTime = clock(start + duration);
          end = start + duration;
          used.add(place.id);
          if (!meal) occupied.add(place.id);
          found = true;
          break;
        }
        if (found) break;
      }
      if (!found) throw unavailable();
    }
  }
  return { trip: tripInputSchema.parse(trip), changes };
}

function unavailable() {
  return new HttpError(
    409,
    'DATE_SCHEDULE_UNAVAILABLE',
    'Goe chưa tìm đủ điểm mở cửa phù hợp cho ngày mới. Lịch cũ vẫn được giữ; bạn có thể thử ngày khác.',
  );
}
