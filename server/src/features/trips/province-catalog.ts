import { randomUUID } from 'node:crypto';
import { Types, type Connection } from 'mongoose';
import type { tripModels } from './trip.models.js';
import type { businessAudit } from '../audit/business-audit.js';
import {
  provinces,
  provinceCatalogVersion,
  provinceCatalogSource,
  provinceCatalogEffectiveFrom,
  provinceSeedId,
} from './province-data.js';

/** Explicit startup bootstrap; never called by a GET or a customer request. */
export async function syncProvinceCatalog(
  connection: Connection,
  Destination: ReturnType<typeof tripModels>['Destination'],
  audit: ReturnType<typeof businessAudit>,
) {
  const requestId = randomUUID();
  return connection.transaction(async (session) => {
    let inserted = 0;
    let adopted = 0;
    for (const p of provinces) {
      const existing = await Destination.findOne({
        provinceCode: p.code,
      }).session(session);
      if (existing) continue; // Never overwrite the operator's enabled state or existing IDs.
      const legacy = await Destination.findOne({
        slug: p.slug,
        name: { $in: [p.name, `Tỉnh ${p.name}`, `Thành phố ${p.name}`] },
        provinceCode: null,
        deletedAt: null,
      }).session(session);
      const metadata = {
        provinceCode: p.code,
        catalogKind: 'province',
        catalogVersion: provinceCatalogVersion,
        catalogSourceUrl: provinceCatalogSource,
        catalogEffectiveFrom: provinceCatalogEffectiveFrom,
        tourismAreas: p.areas,
      };
      const preferredId = new Types.ObjectId(provinceSeedId(p.code));
      const idOccupied = await Destination.exists({ _id: preferredId }).session(
        session,
      );
      const d =
        legacy ??
        new Destination({
          _id: idOccupied ? new Types.ObjectId() : preferredId,
          name: p.name,
          slug: p.slug,
          summary: p.areas.length
            ? `Khu vực bên trong: ${p.areas.join(', ')}.`
            : '',
          tourismRegion: p.region,
          publicationStatus: 'draft',
          revision: 0,
          source: {
            provider: 'vietnam_administrative_catalog',
            fetchedAt: new Date(),
            rights: {
              policyRef: provinceCatalogVersion,
              cacheAllowed: true,
              persistentSnapshotAllowed: true,
              attributionRequired: true,
            },
          },
        });
      d.set(metadata);
      d.name = p.name;
      d.tourismRegion = p.region;
      d.revision += 1;
      await d.save({ session });
      await audit.append(
        {
          action: 'catalog.destination_catalogued',
          catalogSystem: true,
          entityId: String(d._id),
          entityRevision: d.revision,
          requestId,
          operationId: randomUUID(),
        },
        session,
      );
      if (legacy) adopted++;
      else inserted++;
    }
    // Retain historical identities and references, but remove non-provinces from new choices.
    const legacyRows = await Destination.find({
      provinceCode: null,
      catalogKind: { $ne: 'legacy' },
    }).session(session);
    for (const d of legacyRows) {
      d.catalogKind = 'legacy';
      d.revision += 1;
      await d.save({ session });
      await audit.append(
        {
          action: 'catalog.destination_catalogued',
          catalogSystem: true,
          entityId: String(d._id),
          entityRevision: d.revision,
          requestId,
          operationId: randomUUID(),
        },
        session,
      );
    }
    return {
      inserted,
      adopted,
      legacyRetained: legacyRows.length,
      version: provinceCatalogVersion,
    };
  });
}
