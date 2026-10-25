import {
  visitInfoForEditor,
  type VisitInfo,
  type ReferencePrice,
} from '@goease/contracts';
import { Schema } from 'mongoose';
import {
  catalogEditableFields,
  type CatalogField,
  type FieldProvenance,
} from '@goease/contracts';

// Bounded by the list of editable fields; never a growing observation history.
export const catalogPublicationFields = {
  publicationModelVersion: { type: Number, enum: [2], default: 2 },
  publicRevision: { type: Number, default: null },
  proposalRevision: { type: Number, default: null },
  fieldLocks: {
    type: [String],
    enum: catalogEditableFields,
    default: [],
    validate: (v: string[]) =>
      v.length <= catalogEditableFields.length && new Set(v).size === v.length,
  },
  fieldProvenance: {
    type: [
      new Schema(
        {
          field: { type: String, enum: catalogEditableFields, required: true },
          origin: {
            type: String,
            enum: ['manual', 'geoapify', 'legacy'],
            required: true,
          },
          sourceUrl: { type: String, default: null, maxlength: 2048 },
          receivedAt: { type: String, default: null },
          verifiedAt: { type: String, default: null },
          validUntil: { type: String, default: null },
          actorId: { type: String, default: null },
          state: {
            type: String,
            enum: ['unknown', 'observed', 'edited', 'verified'],
            required: true,
          },
        },
        { _id: false, strict: 'throw', versionKey: false },
      ),
    ],
    default: [],
    validate: (v: FieldProvenance[]) =>
      v.length <= catalogEditableFields.length &&
      new Set(v.map((p) => p.field)).size === v.length,
  },
};

const paths: Partial<Record<CatalogField, string>> = {
  locationQuery: 'planning.locationQuery',
  durationMinutes: 'planning.durationMinutes',
};
function get(snapshot: Record<string, unknown>, field: CatalogField): unknown {
  const path = paths[field];
  if (path)
    return (snapshot.planning as Record<string, unknown> | undefined)?.[
      path.split('.')[1]!
    ];
  return snapshot[field];
}
export function preserveCatalogLocks(
  current: Record<string, unknown>,
  candidate: Record<string, unknown>,
) {
  const result = { ...candidate };
  const locks = (current.fieldLocks ?? []) as CatalogField[];
  for (const field of locks) {
    if (paths[field]) {
      result.planning = {
        ...((result.planning as object) ?? {}),
        [paths[field]!.split('.')[1]!]: get(current, field),
      };
      if (field === 'durationMinutes')
        result.durationLabel = current.durationLabel;
    } else result[field] = get(current, field);
    if (field === 'images') {
      result.imageUrl = current.imageUrl;
      result.imageCredit = current.imageCredit;
    }
  }
  if (locks.includes('visitInfo'))
    result.referencePrice = current.referencePrice;
  if (locks.includes('referencePrice')) {
    const previous = visitInfoForEditor(
      current.visitInfo as VisitInfo | null | undefined,
      current.referencePrice as ReferencePrice | null | undefined,
    );
    const incoming = result.visitInfo as VisitInfo | null | undefined;
    result.visitInfo = {
      ...incoming,
      hours: incoming?.hours ?? null,
      pricingVersion: 1,
      price: previous.price,
    };
    result.referencePrice = current.referencePrice;
  }
  result.fieldLocks = locks;
  return result;
}
export function catalogProvenance(
  current: Record<string, unknown> | null,
  candidate: Record<string, unknown>,
  origin: 'manual' | 'geoapify',
  actorId: string | null,
  receivedAt: string | null = null,
): FieldProvenance[] {
  const previous = (current?.fieldProvenance ?? []) as FieldProvenance[];
  return catalogEditableFields.map((field) => {
    const before = previous.find((p) => p.field === field);
    const value = get(candidate, field);
    if (
      current &&
      JSON.stringify(get(current, field)) === JSON.stringify(value)
    )
      return (
        before ?? {
          field,
          origin: 'legacy',
          sourceUrl: null,
          receivedAt: null,
          verifiedAt: null,
          validUntil: null,
          actorId: null,
          state: 'unknown',
        }
      );
    const unknown =
      value == null || value === '' || (Array.isArray(value) && !value.length);
    return {
      field,
      origin,
      sourceUrl:
        typeof candidate.sourceUrl === 'string' ? candidate.sourceUrl : null,
      receivedAt,
      verifiedAt: null,
      validUntil:
        field === 'referencePrice'
          ? ((candidate.referencePrice as { reviewAfter?: string } | null)
              ?.reviewAfter ?? null)
          : null,
      actorId,
      state: unknown ? 'unknown' : origin === 'manual' ? 'edited' : 'observed',
    };
  });
}
