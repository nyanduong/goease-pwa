import { catalogToday, type adminPlaceQuerySchema } from '@goease/contracts';
import { Types } from 'mongoose';
import type { z } from 'zod';
import { normalizeSearch } from './explore.service.js';

/** One server predicate shared by list, frozen selection, count and map. */
export function catalogQuery(query: z.infer<typeof adminPlaceQuerySchema>) {
  const q = normalizeSearch(query.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return {
    deletedAt: null,
    ...(query.destinationId
      ? { destinationId: new Types.ObjectId(query.destinationId) }
      : {}),
    ...(query.category !== 'all' ? { category: query.category } : {}),
    ...(query.source === 'geoapify'
      ? { 'source.provider': 'geoapify' as const }
      : query.source === 'manual'
        ? { source: { $exists: false } }
        : {}),
    ...(query.quality === 'hours'
      ? { openingHoursNote: { $in: ['', null] } }
      : query.quality === 'location'
        ? { mapLocation: null }
        : query.quality === 'price'
          ? {
              $or: [
                { referencePrice: null },
                { 'referencePrice.reviewAfter': { $lt: catalogToday() } },
                { 'referencePrice.checkedAt': { $gt: catalogToday() } },
                { 'referencePrice.inclusions': { $in: ['', null] } },
                { 'referencePrice.exclusions': { $in: ['', null] } },
              ],
            }
          : {}),
    ...(query.status === 'all'
      ? query.quality === 'all'
        ? {}
        : { publicationStatus: { $ne: 'archived' as const } }
      : { publicationStatus: query.status }),
    ...(q ? { searchText: { $regex: q } } : {}),
  };
}
