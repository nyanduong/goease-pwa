import type { Connection, ClientSession } from 'mongoose';
import { adminOperationsModels } from './admin-operations.models.js';
import { HttpError } from '../../http-error.js';
export const initialDestinationId = '000000000000000000000004';
export const scopeKey = (id = initialDestinationId) =>
  id === initialDestinationId ? 'hoi-an' : id;
export const scopeDestination = (scope: string) =>
  scope === 'hoi-an' ? initialDestinationId : scope;
export type IngestionArea = {
  latitude: number;
  longitude: number;
  radiusMeters: number;
};
export async function ingestionScope(
  connection: Connection,
  destinationId = initialDestinationId,
  session?: ClientSession,
): Promise<IngestionArea> {
  const settings = await adminOperationsModels(connection)
    .Settings.findOne({ scope: 'global' })
    .session(session ?? null);
  const saved = settings?.regions.find(
    (r) => r.destinationId === destinationId,
  );
  if (
    saved?.enabled &&
    saved.latitude != null &&
    saved.longitude != null &&
    saved.radiusMeters != null
  )
    return {
      latitude: saved.latitude,
      longitude: saved.longitude,
      radiusMeters: saved.radiusMeters,
    };
  if (!saved && destinationId === initialDestinationId)
    return { latitude: 15.88, longitude: 108.328, radiusMeters: 5000 };
  throw new HttpError(
    400,
    'REGION_NOT_CONFIGURED',
    'Khu vực chưa bật nguồn nhập. Mở Cài đặt để xác định tâm, bán kính và bật khu vực.',
  );
}
