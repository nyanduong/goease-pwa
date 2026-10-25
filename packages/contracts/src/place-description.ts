import { z } from 'zod';

export const importedDescriptionPlaceholder =
  'Địa điểm nhập từ Geoapify / OpenStreetMap; cần biên tập và kiểm tra thông tin trước khi đi.';
export const needsPlaceDescription = (text: string) =>
  !text.trim() || text.trim() === importedDescriptionPlaceholder;
export const placeDescriptionSchema = z.strictObject({
  text: z.string().trim().max(1000),
  originalText: z.string().trim().min(1).max(6000),
  title: z.string().min(1).max(300),
  sourceUrl: z.url().max(2048),
  language: z.enum(['vi', 'en']),
  translated: z.boolean(),
  revisionId: z.number().int().positive(),
  license: z.literal('CC-BY-SA-4.0'),
  match: z.enum(['linked', 'name_coordinates']),
});
export type PlaceDescription = z.infer<typeof placeDescriptionSchema>;
export type PlaceDescriptionSearchDto = {
  state:
    | 'pending'
    | 'searching'
    | 'ready'
    | 'empty'
    | 'failed'
    | 'needs_translation';
  result: PlaceDescription | null;
  message: string;
  checkedAt: string | null;
};
