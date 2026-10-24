import { Types, type Connection, type PipelineStage } from 'mongoose';
import { catalogToday } from '@goease/contracts';

// Counts and issue groups are computed against the whole scope by MongoDB.
// Only the separately bounded map preview is materialized by the caller.
export async function catalogOverview(
  connection: Connection,
  freshnessDays: number,
  destinationId?: string,
) {
  const match = {
    deletedAt: null,
    ...(destinationId
      ? { destinationId: new Types.ObjectId(destinationId) }
      : {}),
  };
  const today = catalogToday();
  const text = (field: string) => ({
    $gt: [
      { $strLenCP: { $trim: { input: { $ifNull: [`$${field}`, ''] } } } },
      0,
    ],
  });
  const nameReady = {
    $and: [
      text('name'),
      {
        $not: [
          {
            $regexMatch: {
              input: { $ifNull: ['$name', ''] },
              regex: 'cần đối chiếu|đang rà soát|cần xác minh',
              options: 'i',
            },
          },
        ],
      },
    ],
  };
  const priceReady = {
    $and: [
      { $ne: [{ $ifNull: ['$referencePrice', null] }, null] },
      { $isNumber: '$referencePrice.amountMinor' },
      { $gte: ['$referencePrice.amountMinor', 0] },
      text('referencePrice.label'),
      text('referencePrice.conditions'),
      text('referencePrice.inclusions'),
      text('referencePrice.exclusions'),
      text('referencePrice.sourceUrl'),
      { $lte: ['$referencePrice.checkedAt', today] },
      { $gte: ['$referencePrice.reviewAfter', today] },
      {
        $gte: [
          '$referencePrice.maxTravelers',
          { $ifNull: ['$referencePrice.minTravelers', 1] },
        ],
      },
    ],
  };
  const definitions = [
    {
      code: 'name',
      label: 'Tên công khai cần biên tập',
      ready: nameReady,
      required: true,
    },
    {
      code: 'description',
      label: 'Thiếu giới thiệu',
      ready: text('description'),
      required: true,
    },
    {
      code: 'address',
      label: 'Thiếu địa chỉ',
      ready: text('planning.locationQuery'),
      required: true,
    },
    {
      code: 'duration',
      label: 'Thiếu thời lượng ước tính',
      ready: { $gt: ['$planning.durationMinutes', 0] },
      required: true,
    },
    {
      code: 'source',
      label: 'Thiếu nguồn đối chiếu',
      ready: text('sourceUrl'),
      required: true,
    },
    {
      code: 'price',
      label: 'Giá thiếu, chưa đủ điều kiện hoặc quá hạn',
      ready: priceReady,
      required: true,
    },
    {
      code: 'location',
      label: 'Chưa có tọa độ để kiểm tra trên bản đồ',
      ready: { $ne: [{ $ifNull: ['$mapLocation', null] }, null] },
      required: false,
    },
    {
      code: 'hours',
      label: 'Chưa có giờ mở cửa',
      ready: text('openingHoursNote'),
      required: false,
    },
    {
      code: 'image',
      label: 'Thiếu thông tin quyền sử dụng ảnh',
      ready: text('imageCredit'),
      required: false,
    },
    {
      code: 'freshness',
      label: `Chưa biên tập trong ${freshnessDays} ngày`,
      ready: {
        $gte: ['$updatedAt', new Date(Date.now() - freshnessDays * 86400000)],
      },
      required: false,
    },
  ];
  type Totals = {
    total: number;
    draft: number;
    published: number;
    archived: number;
    needsAttention: number;
    complete: number;
    located: number;
    geoapify: number;
  };
  const sum = (condition: unknown) => ({ $sum: { $cond: [condition, 1, 0] } });
  const pipeline: PipelineStage[] = [
    { $match: match },
    {
      $set: {
        qualityIssues: {
          $cond: [
            { $eq: ['$publicationStatus', 'archived'] },
            [],
            {
              $concatArrays: definitions.map((d) => ({
                $cond: [d.ready, [], [d.code]],
              })),
            },
          ],
        },
        complete: {
          $and: definitions
            .filter((d) => d.required)
            .map((d) =>
              d.code === 'name'
                ? text('name')
                : d.code === 'price'
                  ? { $ne: [{ $ifNull: ['$referencePrice', null] }, null] }
                  : d.ready,
            ),
        },
      },
    },
    {
      $facet: {
        totals: [
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              draft: sum({ $eq: ['$publicationStatus', 'draft'] }),
              published: sum({ $eq: ['$publicationStatus', 'published'] }),
              archived: sum({ $eq: ['$publicationStatus', 'archived'] }),
              needsAttention: sum({ $gt: [{ $size: '$qualityIssues' }, 0] }),
              complete: sum({
                $and: [
                  '$complete',
                  { $ne: ['$publicationStatus', 'archived'] },
                ],
              }),
              located: sum({
                $ne: [{ $ifNull: ['$mapLocation', null] }, null],
              }),
              geoapify: sum({ $eq: ['$source.provider', 'geoapify'] }),
            },
          },
        ],
        categories: [{ $group: { _id: '$category', count: { $sum: 1 } } }],
        issues: [
          { $unwind: '$qualityIssues' },
          { $group: { _id: '$qualityIssues', count: { $sum: 1 } } },
        ],
      },
    },
  ];
  const rows = await connection
    .collection('places')
    .aggregate<{
      totals: Totals[];
      categories: { _id: string; count: number }[];
      issues: { _id: string; count: number }[];
    }>(pipeline)
    .toArray();
  const row = rows[0];
  const totals = row?.totals[0] ?? {
    total: 0,
    draft: 0,
    published: 0,
    archived: 0,
    needsAttention: 0,
    complete: 0,
    located: 0,
    geoapify: 0,
  };
  return {
    ...totals,
    manual: totals.total - totals.geoapify,
    categories: ['food', 'culture', 'nature'].map((category) => ({
      category,
      count: row?.categories.find((r) => r._id === category)?.count ?? 0,
    })),
    issues: (row?.issues ?? []).map((r) => ({
      code: r._id,
      label: definitions.find((d) => d.code === r._id)?.label ?? r._id,
      count: r.count,
    })),
  };
}
