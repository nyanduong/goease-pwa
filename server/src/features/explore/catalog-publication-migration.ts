import type { Connection } from 'mongoose';
import { Types } from 'mongoose';
import { createHash } from 'node:crypto';
import {
  catalogEditableFields,
  catalogFieldSchema,
  fieldProvenanceSchema,
  type FieldProvenance,
} from '@goease/contracts';
import { z } from 'zod';

const metadataFields = [
  'publicationModelVersion',
  'publicRevision',
  'proposalRevision',
  'fieldLocks',
  'fieldProvenance',
] as const;
type Metadata = Partial<Record<(typeof metadataFields)[number], unknown>>;
const metadataSchema = z.strictObject({
  publicationModelVersion: z.literal(2).optional(),
  publicRevision: z.number().int().nonnegative().nullable().optional(),
  proposalRevision: z.number().int().nonnegative().nullable().optional(),
  fieldLocks: z
    .array(catalogFieldSchema)
    .max(catalogEditableFields.length)
    .optional(),
  fieldProvenance: z
    .array(fieldProvenanceSchema)
    .max(catalogEditableFields.length)
    .optional(),
});
export type PublicationMigrationPlan = {
  format: 'goease-publication-v2';
  database: string;
  createdAt: string;
  items: {
    id: string;
    revision: number;
    publicHash: string;
    before: Metadata;
    after: Metadata;
    versionExisted: boolean;
  }[];
};
const digest = (doc: Record<string, unknown>) =>
  createHash('sha256')
    .update(
      JSON.stringify(
        Object.fromEntries(
          Object.entries(doc).filter(
            ([key]) =>
              !metadataFields.includes(key as (typeof metadataFields)[number]),
          ),
        ),
      ),
    )
    .digest('hex');
const metadata = (doc: Record<string, unknown>): Metadata =>
  Object.fromEntries(
    metadataFields.filter((key) => key in doc).map((key) => [key, doc[key]]),
  );

export function validatePublicationMigrationUri(
  uri: string,
  environment?: string,
) {
  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    throw new Error('A valid explicit migration URI is required');
  }
  if (
    environment === 'production' ||
    parsed.protocol !== 'mongodb:' ||
    !['127.0.0.1', 'localhost'].includes(parsed.hostname) ||
    parsed.username ||
    parsed.password ||
    !/^\/goease_(?:admin_v3_(?:dev|test)_[a-z0-9_-]+|f1b_test_[0-9a-f]{32})$/.test(
      parsed.pathname,
    ) ||
    !/^[a-zA-Z0-9_-]+$/.test(parsed.searchParams.get('replicaSet') ?? '')
  )
    throw new Error(
      'Migration requires a named, owned local development/test replica set; application and production databases are refused',
    );
  return uri;
}

// A manifest contains only catalog metadata and hashes; public data remains in the existing catalog_versions.
export async function planPublicationMigration(
  connection: Connection,
): Promise<PublicationMigrationPlan> {
  const items: PublicationMigrationPlan['items'] = [];
  for await (const place of connection
    .collection('places')
    .find({ publicationModelVersion: { $ne: 2 } })) {
    if (place.proposalRevision != null)
      throw new Error(
        'Unmigrated record already has a proposal; review before migration',
      );
    const provenance: FieldProvenance[] = catalogEditableFields.map(
      (field) => ({
        field,
        origin: 'legacy',
        sourceUrl: typeof place.sourceUrl === 'string' ? place.sourceUrl : null,
        receivedAt: null,
        verifiedAt: null,
        validUntil: null,
        actorId: null,
        // Historical presence is not independent evidence of verification.
        state: 'unknown',
      }),
    );
    items.push({
      id: String(place._id),
      revision: place.revision,
      publicHash: digest(place),
      before: metadata(place),
      after: {
        publicationModelVersion: 2,
        publicRevision:
          place.publicationStatus === 'published' ? place.revision : null,
        proposalRevision: null,
        fieldLocks: place.fieldLocks ?? [],
        fieldProvenance: place.fieldProvenance ?? provenance,
      },
      versionExisted: !!(await connection
        .collection('catalog_versions')
        .findOne({ placeId: place._id, revision: place.revision })),
    });
  }
  return {
    format: 'goease-publication-v2',
    database: connection.name,
    createdAt: new Date().toISOString(),
    items,
  };
}
export async function applyPublicationMigration(
  connection: Connection,
  plan: PublicationMigrationPlan,
  rollback = false,
) {
  if (
    plan.format !== 'goease-publication-v2' ||
    plan.database !== connection.name
  )
    throw new Error('Migration manifest database mismatch');
  if (
    !Array.isArray(plan.items) ||
    new Set(plan.items.map((item) => item.id)).size !== plan.items.length
  )
    throw new Error('Invalid or duplicate migration manifest items');
  for (const item of plan.items) {
    if (
      !/^[a-f0-9]{24}$/.test(item.id) ||
      !Number.isSafeInteger(item.revision) ||
      item.revision < 0 ||
      !/^[a-f0-9]{64}$/.test(item.publicHash)
    )
      throw new Error('Invalid migration manifest item');
    metadataSchema.parse(item.before);
    metadataSchema.parse(item.after);
  }
  let applied = 0,
    skipped = 0;
  for (const item of plan.items) {
    await connection.transaction(async (session) => {
      const place = await connection
        .collection('places')
        .findOne({ _id: new Types.ObjectId(item.id) }, { session });
      if (
        !place ||
        place.revision !== item.revision ||
        digest(place) !== item.publicHash
      )
        throw new Error(`Catalog changed after manifest: ${item.id}`);
      const expected = rollback ? item.after : item.before;
      const target = rollback ? item.before : item.after;
      if (JSON.stringify(metadata(place)) === JSON.stringify(target)) {
        skipped++;
        return;
      }
      if (JSON.stringify(metadata(place)) !== JSON.stringify(expected))
        throw new Error(`Metadata changed after manifest: ${item.id}`);
      if (!rollback)
        await connection.collection('catalog_versions').updateOne(
          { placeId: place._id, revision: place.revision },
          {
            $setOnInsert: {
              snapshot: place,
              recordedAt: new Date(),
              state: 'historical',
              reason: 'backfill',
              basePublicRevision:
                place.publicationStatus === 'published' ? place.revision : null,
            },
          },
          { upsert: true, session },
        );
      const unset = Object.fromEntries(
        metadataFields
          .filter((key) => !(key in target))
          .map((key) => [key, '']),
      );
      await connection.collection('places').updateOne(
        { _id: place._id, revision: place.revision },
        {
          ...(Object.keys(target).length ? { $set: target } : {}),
          ...(Object.keys(unset).length ? { $unset: unset } : {}),
        },
        { session },
      );
      if (rollback && !item.versionExisted)
        await connection.collection('catalog_versions').deleteOne(
          {
            placeId: place._id,
            revision: place.revision,
            reason: 'backfill',
          },
          { session },
        );
      const after = await connection
        .collection('places')
        .findOne({ _id: place._id }, { session });
      if (
        !after ||
        digest(after) !== item.publicHash ||
        JSON.stringify(metadata(after)) !== JSON.stringify(target)
      )
        throw new Error(`Migration postcondition failed: ${item.id}`);
      applied++;
    });
  }
  return { applied, skipped, total: plan.items.length, rollback };
}
