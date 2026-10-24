import { Types } from 'mongoose';
import type { tripModels } from './trip.models.js';
import type { TourismRegion } from '@goease/contracts';
export async function seedDestinations(
  Destination: ReturnType<typeof tripModels>['Destination'],
) {
  const entries = [
    [
      '000000000000000000000004',
      'hoi-an',
      'Hội An',
      'Phố cổ, hương vị và những khoảng xanh.',
    ],
    [
      '000000000000000000000001',
      'da-nang',
      'Đà Nẵng',
      'Biển, phố và một nhịp đi thong thả.',
    ],
    [
      '000000000000000000000002',
      'da-lat',
      'Đà Lạt',
      'Những khoảng nghỉ trên cao nguyên.',
    ],
    [
      '000000000000000000000003',
      'ha-noi',
      'Hà Nội',
      'Khám phá phố phường theo cách của bạn.',
    ],
  ] as const;
  const regions: Record<string, TourismRegion> = {
    'hoi-an': 'south-central-coast',
    'da-nang': 'south-central-coast',
    'da-lat': 'central-highlands',
    'ha-noi': 'northern-delta',
  };
  for (const [id, slug, name, summary] of entries) {
    if (await Destination.exists({ $or: [{ _id: id }, { slug }] })) continue;
    await new Destination({
      _id: new Types.ObjectId(id),
      slug,
      name,
      summary,
      tourismRegion: regions[slug],
      publicationStatus: 'published',
      source: {
        provider: 'goease_curated',
        fetchedAt: new Date(),
        rights: {
          policyRef: 'goease-authored-catalog-v1',
          cacheAllowed: true,
          persistentSnapshotAllowed: true,
          attributionRequired: false,
        },
      },
    }).save();
  }
}
