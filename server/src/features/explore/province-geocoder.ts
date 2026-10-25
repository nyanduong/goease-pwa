import { z } from 'zod';
import { HttpError } from '../../http-error.js';
import { foldDestination } from '../trips/province-data.js';
import type { IngestionArea } from './ingestion-scope.js';
import { distanceMeters } from './geoapify.js';

export type ResolveProvinceArea = (
  name: string,
  provinceName?: string,
) => Promise<IngestionArea>;
const normalized = (name: string) =>
  foldDestination(name)
    .replace(
      /^(tinh|thanh pho|thi xa|huyen|phuong|xa|tp\.?|province|city)\s+/,
      '',
    )
    .replace(/\s+(province|city)$/, '');
const resultSchema = z.object({
  results: z
    .array(
      z.object({
        lat: z.number().min(-90).max(90),
        lon: z.number().min(-180).max(180),
        country_code: z.string(),
        name: z.string().max(200).optional(),
        city: z.string().max(200).optional(),
        state: z.string().max(200).optional(),
        county: z.string().max(200).optional(),
        result_type: z.string(),
      }),
    )
    .max(5),
});

/** A named search centre, never an assertion about provincial boundaries. */
export function provinceGeocoder(
  key: string | undefined,
  request: typeof fetch = fetch,
): ResolveProvinceArea {
  return async (name, provinceName) => {
    if (!key?.trim())
      throw new HttpError(
        503,
        'GEOAPIFY_NOT_CONFIGURED',
        'Chưa cấu hình nguồn Geoapify trên máy chủ.',
      );
    const url = new URL('https://api.geoapify.com/v1/geocode/search');
    url.search = new URLSearchParams({
      text: `${name}${provinceName && provinceName !== name ? `, ${provinceName}` : ''}, Việt Nam`,
      type: 'locality',
      filter: 'countrycode:vn',
      lang: 'vi',
      format: 'json',
      limit: '5',
      apiKey: key.trim(),
    }).toString();
    try {
      const response = await request(url, {
        signal: AbortSignal.timeout(20000),
        redirect: 'error',
      });
      if (!response.ok) {
        await response.body?.cancel();
        throw new HttpError(
          response.status === 429 ? 429 : 502,
          'AREA_LOOKUP_FAILED',
          'Nguồn chưa xác định được vùng lấy dữ liệu. Kiểm tra kết nối/hạn mức rồi thử lại.',
        );
      }
      const reader = response.body?.getReader();
      if (!reader) throw new Error('Empty response');
      let size = 0,
        text = '';
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 64000) {
          await reader.cancel();
          throw new Error('Response limit');
        }
        text += decoder.decode(value, { stream: true });
      }
      text += decoder.decode();
      if (text.includes(key.trim())) throw new Error('Unsafe response');
      const matches = resultSchema
        .parse(JSON.parse(text))
        .results.filter(
          (r) =>
            r.country_code.toLowerCase() === 'vn' &&
            (!provinceName ||
              !r.state ||
              normalized(r.state) === normalized(provinceName)) &&
            [
              'city',
              'state',
              'county',
              'district',
              'suburb',
              'locality',
            ].includes(r.result_type) &&
            normalized(
              r.name ?? r[r.result_type as 'city' | 'state' | 'county'] ?? '',
            ) === normalized(name),
        );
      // Prefer a named city over the centroid of a large province. Ambiguity is actionable.
      const candidates = matches.some((r) => r.result_type === 'city')
        ? matches.filter((r) => r.result_type === 'city')
        : matches;
      // Providers may retain both ward and former-city labels for one town.
      // Only nearby representations of the same name/province share a centre;
      // geographically distinct namesakes remain ambiguous.
      if (
        !candidates.length ||
        candidates.some(
          (r) =>
            distanceMeters(
              r.lon,
              r.lat,
              candidates[0]!.lon,
              candidates[0]!.lat,
            ) > 1000,
        )
      )
        throw new HttpError(
          422,
          'AREA_LOOKUP_AMBIGUOUS',
          'Chưa xác định duy nhất vùng tìm kiếm. Cấu hình phạm vi trong Cài đặt rồi thử lại.',
        );
      return {
        latitude: candidates[0]!.lat,
        longitude: candidates[0]!.lon,
        radiusMeters: 10000,
      };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(
        502,
        'AREA_LOOKUP_FAILED',
        'Chưa đọc được vùng tìm kiếm hợp lệ từ nguồn. Chưa tạo đợt thu thập; hãy thử lại.',
      );
    }
  };
}
