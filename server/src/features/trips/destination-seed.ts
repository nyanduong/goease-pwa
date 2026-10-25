// Isolated test fixtures only. Runtime/db:seed uses syncProvinceCatalog instead.
import { Types } from 'mongoose';
import type { tripModels } from './trip.models.js';
import {
  provinces,
  provinceSeedId,
  provinceCatalogVersion,
  provinceCatalogSource,
  provinceCatalogEffectiveFrom,
} from './province-data.js';
export async function seedDestinations(
  Destination: ReturnType<typeof tripModels>['Destination'],
) {
  for (const code of ['48', '46', '68', '01']) {
    const p = provinces.find((v) => v.code === code)!;
    const id = new Types.ObjectId(provinceSeedId(code));
    await Destination.updateOne(
      { _id: id },
      {
        $set: {
          name: p.name,
          slug: p.slug,
          provinceCode: p.code,
          catalogKind: 'province',
          catalogVersion: provinceCatalogVersion,
          catalogSourceUrl: provinceCatalogSource,
          catalogEffectiveFrom: provinceCatalogEffectiveFrom,
          tourismAreas: p.areas,
          tourismRegion: p.region,
          publicationStatus: 'published',
        },
        $setOnInsert: {
          summary: 'Danh mục tỉnh/thành trong cơ sở dữ liệu kiểm thử riêng.',
          source: { provider: 'fixture', rights: { policyRef: 'test-only' } },
        },
      },
      { upsert: true, runValidators: true },
    );
  }
}
