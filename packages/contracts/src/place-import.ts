import { z } from 'zod';

export const placeImportSearchSchema = z.strictObject({
  group: z.enum(['mixed', 'sights', 'restaurant', 'cafe']),
  limit: z.union([z.literal(30), z.literal(50)]),
});
export const placeImportCommitSchema = z.strictObject({
  previewId: z.uuid(),
  externalIds: z
    .array(z.string().min(1).max(512))
    .min(1)
    .max(50)
    .refine((v) => new Set(v).size === v.length),
  acknowledgeDuplicates: z.boolean().default(false),
});
export type PlaceImportSearch = z.infer<typeof placeImportSearchSchema>;
export type PlaceImportCommit = z.infer<typeof placeImportCommitSchema>;
export type PlaceImportCandidate = {
  externalId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  category: 'food' | 'culture' | 'nature';
  venueType: 'restaurant' | 'place';
  categories: string[];
  sourceUrl: string;
  openingHoursNote: string;
  flags: string[];
  existingPlaceId?: string;
  possibleDuplicates: string[];
};
export type PlaceImportPreview = {
  previewId: string;
  fetchedAt: string;
  expiresAt: string;
  received: number;
  rejected: number;
  duplicateExternalIds: number;
  items: PlaceImportCandidate[];
};
export type PlaceImportResult = {
  placeIds: string[];
  created: number;
  existing: number;
};
export type PlaceProvenance = {
  provider: 'geoapify';
  externalId: string;
  fetchedAt: string;
  attribution: string;
  license: string;
};
