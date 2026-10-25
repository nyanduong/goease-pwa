import { Types, type PipelineStage } from 'mongoose';
import {
  visitProgressStates,
  type VisitProgressDto,
  type VisitProgressQuery,
} from '@goease/contracts';
import type { exploreService } from './explore.service.js';
import type { adminCatalog } from './admin-catalog.js';
import { visitContext } from './visit-info-provider.js';

type ProgressRow = {
  _id: Types.ObjectId;
  name: string;
  destinationName: string;
  destinationId: Types.ObjectId;
  publicationStatus: string;
  sourceUrl: string;
  mapLocation?: { latitude: number; longitude: number } | null;
  progressState: VisitProgressDto['items'][number]['state'];
  hasHours: boolean;
  hasPrice: boolean;
  expiredLease: boolean;
  visitSearch?: {
    context?: string;
    checkedAt?: Date;
    nextAttemptAt?: Date;
    attempts?: number;
    message?: string;
  };
  visitInfo?: {
    hours?: { reviewed?: boolean };
    price?: { reviewed?: boolean };
  };
};
export function visitProgress(
  explore: ReturnType<typeof exploreService>,
  catalog: ReturnType<typeof adminCatalog>,
) {
  return async (
    actor: Types.ObjectId,
    query: VisitProgressQuery,
  ): Promise<VisitProgressDto> => {
    await catalog.requireAdmin(actor);
    const now = new Date();
    const base = {
      deletedAt: null,
      $or: [
        { 'source.provider': 'geoapify' },
        { visitSearch: { $exists: true } },
      ],
      ...(query.destinationId
        ? { destinationId: new Types.ObjectId(query.destinationId) }
        : {}),
      ...(query.q
        ? {
            name: {
              $regex: query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
              $options: 'i',
            },
          }
        : {}),
    };
    const present = (path: string) => ({
      $ne: [{ $ifNull: [path, null] }, null],
    });
    const status = { $ifNull: ['$visitSearch.state', 'not_queued'] };
    const rowFilter = {
      ...(query.state !== 'all' ? { progressState: query.state } : {}),
      ...{
        all: {},
        hours: { hasHours: true },
        price: { hasPrice: true },
        both: { hasHours: true, hasPrice: true },
        missing_hours: { hasHours: false },
        missing_price: { hasPrice: false },
        neither: { hasHours: false, hasPrice: false },
      }[query.coverage],
    };
    const sum = (condition: unknown) => ({
      $sum: { $cond: [condition, 1, 0] },
    });
    const stateSums = Object.fromEntries(
      visitProgressStates.map((s) => [s, sum({ $eq: ['$progressState', s] })]),
    );
    const facets = await explore.models.Place.aggregate<{
      summary: Record<string, number>[];
      matched: { total: number }[];
      rows: ProgressRow[];
    }>([
      { $match: base },
      {
        $set: {
          progressState: {
            $cond: [
              {
                $and: [
                  { $ne: ['$publicationStatus', 'draft'] },
                  { $in: [status, ['pending', 'searching']] },
                ],
              },
              'inactive',
              status,
            ],
          },
          hasHours: present('$visitSearch.result.hours'),
          hasPrice: present('$visitSearch.result.price'),
          expiredLease: {
            $and: [
              { $eq: [status, 'searching'] },
              { $ne: [{ $ifNull: ['$visitSearch.leaseUntil', null] }, null] },
              { $lte: ['$visitSearch.leaseUntil', now] },
            ],
          },
        },
      },
      {
        $project: {
          name: 1,
          destinationName: 1,
          destinationId: 1,
          publicationStatus: 1,
          sourceUrl: 1,
          mapLocation: 1,
          progressState: 1,
          hasHours: 1,
          hasPrice: 1,
          expiredLease: 1,
          'visitSearch.context': 1,
          'visitSearch.checkedAt': 1,
          'visitSearch.nextAttemptAt': 1,
          'visitSearch.attempts': 1,
          'visitSearch.message': 1,
          'visitInfo.hours.reviewed': 1,
          'visitInfo.price.reviewed': 1,
        },
      },
      {
        $facet: {
          summary: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                ...stateSums,
                hours: sum('$hasHours'),
                price: sum('$hasPrice'),
                both: sum({ $and: ['$hasHours', '$hasPrice'] }),
                neither: sum({
                  $and: [{ $not: ['$hasHours'] }, { $not: ['$hasPrice'] }],
                }),
                reviewedHours: sum({
                  $eq: ['$visitInfo.hours.reviewed', true],
                }),
                reviewedPrice: sum({
                  $eq: ['$visitInfo.price.reviewed', true],
                }),
                expiredLeases: sum({
                  $and: [
                    { $eq: ['$progressState', 'searching'] },
                    '$expiredLease',
                  ],
                }),
              },
            },
          ],
          matched: [{ $match: rowFilter }, { $count: 'total' }],
          rows: [
            { $match: rowFilter },
            {
              $set: {
                priority: {
                  $switch: {
                    branches: [
                      {
                        case: { $eq: ['$progressState', 'searching'] },
                        then: 0,
                      },
                      { case: { $eq: ['$progressState', 'failed'] }, then: 1 },
                      { case: { $eq: ['$progressState', 'pending'] }, then: 2 },
                    ],
                    default: 3,
                  },
                },
              },
            },
            { $sort: { priority: 1, 'visitSearch.checkedAt': -1, _id: 1 } },
            { $skip: query.offset },
            { $limit: 20 },
            {
              $project: {
                name: 1,
                destinationName: 1,
                destinationId: 1,
                publicationStatus: 1,
                sourceUrl: 1,
                mapLocation: 1,
                progressState: 1,
                hasHours: 1,
                hasPrice: 1,
                expiredLease: 1,
                'visitSearch.context': 1,
                'visitSearch.checkedAt': 1,
                'visitSearch.nextAttemptAt': 1,
                'visitSearch.attempts': 1,
                'visitSearch.message': 1,
                'visitInfo.hours.reviewed': 1,
                'visitInfo.price.reviewed': 1,
              },
            },
          ],
        },
      },
    ] as PipelineStage[]);
    const result = facets[0];
    const summary = result?.summary[0] ?? {};
    const total = Number(result?.matched[0]?.total ?? 0);
    const date = (v: unknown) => (v instanceof Date ? v.toISOString() : null);
    return {
      generatedAt: now.toISOString(),
      summary: {
        total: summary.total ?? 0,
        states: Object.fromEntries(
          visitProgressStates.map((s) => [s, summary[s] ?? 0]),
        ) as VisitProgressDto['summary']['states'],
        hours: summary.hours ?? 0,
        price: summary.price ?? 0,
        both: summary.both ?? 0,
        neither: summary.neither ?? 0,
        reviewedHours: summary.reviewedHours ?? 0,
        reviewedPrice: summary.reviewedPrice ?? 0,
        expiredLeases: summary.expiredLeases ?? 0,
      },
      total,
      hasMore: query.offset + 20 < total,
      items: (result?.rows ?? []).map((r: ProgressRow) => ({
        id: String(r._id),
        name: r.name,
        destinationName: r.destinationName,
        destinationId: String(r.destinationId),
        state: r.progressState,
        publicationStatus: r.publicationStatus,
        attempts: r.visitSearch?.attempts ?? 0,
        hours: r.hasHours,
        price: r.hasPrice,
        reviewedHours: !!r.visitInfo?.hours?.reviewed,
        reviewedPrice: !!r.visitInfo?.price?.reviewed,
        previousResult:
          !!(r.hasHours || r.hasPrice) &&
          r.visitSearch?.context !== visitContext(r),
        expiredLease: r.progressState === 'searching' && r.expiredLease,
        checkedAt: date(r.visitSearch?.checkedAt),
        nextAttemptAt: date(r.visitSearch?.nextAttemptAt),
        message: r.visitSearch?.message ?? '',
      })),
    };
  };
}
