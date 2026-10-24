import type { Connection, ClientSession } from 'mongoose';
import { adminOperationsModels } from './admin-operations.models.js';
import { HttpError } from '../../http-error.js';
export const initialDestinationId = '000000000000000000000004';
export function scopeKey(id?: string) {
  if (!id || !/^[a-f0-9]{24}$/.test(id))
    throw new HttpError(
      400,
      'SCOPE_REQUIRED',
      'Chọn điểm đến rõ ràng trước khi vận hành nguồn.',
    );
  return id === initialDestinationId ? 'hoi-an' : id;
}
export const scopeDestination = (scope: string) =>
  scope === 'hoi-an' ? initialDestinationId : scope;
export type IngestionArea = {
  latitude: number;
  longitude: number;
  radiusMeters: number;
};
export async function ingestionScope(
  connection: Connection,
  destinationId?: string,
  session?: ClientSession,
): Promise<IngestionArea> {
  scopeKey(destinationId);
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
  throw new HttpError(
    400,
    'REGION_NOT_CONFIGURED',
    'Khu vực chưa bật nguồn nhập. Mở Cài đặt để xác định tâm, bán kính và bật khu vực.',
  );
}
