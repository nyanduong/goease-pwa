import type { IngestionArea } from './ingestion-scope.js';
import { z } from 'zod';
import { HttpError } from '../../http-error.js';

export const hoiAnArea = {
  longitude: 108.328,
  latitude: 15.88,
  radiusMeters: 5000,
} as const;
export const geoapifyGroups = {
  sights: 'tourism.attraction,tourism.sights,entertainment.museum,beach',
  restaurant: 'catering.restaurant',
  cafe: 'catering.cafe',
} as const;
export type GeoapifyGroup = keyof typeof geoapifyGroups;
export class GeoapifyRateLimit extends HttpError {
  constructor(public retryAt: Date) {
    super(
      429,
      'GEOAPIFY_REJECTED',
      'Nguồn dữ liệu đang giới hạn lượt truy cập. Hãy chờ thời điểm thử lại.',
    );
  }
}

const featureSchema = z.object({
  type: z.literal('Feature'),
  geometry: z.object({
    type: z.literal('Point'),
    coordinates: z.tuple([z.number().finite(), z.number().finite()]),
  }),
  properties: z.object({
    place_id: z.string().trim().min(1).max(512),
    name: z.string().trim().max(500).optional(),
    formatted: z.string().trim().max(2000).optional(),
    street: z.string().max(500).optional(),
    housenumber: z.string().max(100).optional(),
    city: z.string().max(200).optional(),
    country_code: z.string().max(10).optional(),
    categories: z.array(z.string().max(160)).max(100),
    datasource: z
      .object({
        sourcename: z.string().max(200).optional(),
        attribution: z.string().max(500).optional(),
        license: z.string().max(200).optional(),
        url: z.string().max(2048).optional(),
        raw: z
          .object({
            osm_type: z.string().max(30).optional(),
            osm_id: z
              .union([z.string().max(50), z.number().int().positive()])
              .optional(),
            opening_hours: z.string().max(1000).optional(),
            disused: z.string().max(20).optional(),
            abandoned: z.string().max(20).optional(),
            wikipedia: z.string().max(300).optional(),
            wikidata: z.string().max(40).optional(),
            website: z.string().max(2048).optional(),
            phone: z.string().max(200).optional(),
          })
          .optional(),
      })
      .optional(),
  }),
});
const responseSchema = z.object({
  type: z.literal('FeatureCollection'),
  features: z.array(z.unknown()).max(50),
});
export type GeoapifyCandidate = {
  externalId: string;
  name: string;
  address: string;
  longitude: number;
  latitude: number;
  categories: string[];
  category: 'food' | 'culture' | 'nature';
  venueType: 'restaurant' | 'place';
  sourceUrl: string;
  wikipedia?: string;
  wikidata?: string;
  openingHoursNote: string;
  flags: string[];
  closed?: boolean | null;
};
export type GeoapifyBatch = {
  group: GeoapifyGroup;
  received: number;
  rejected: number;
  items: GeoapifyCandidate[];
};

export function distanceMeters(
  longitude: number,
  latitude: number,
  otherLongitude: number,
  otherLatitude: number,
) {
  const rad = Math.PI / 180;
  const a =
    Math.sin(((latitude - otherLatitude) * rad) / 2) ** 2 +
    Math.cos(latitude * rad) *
      Math.cos(otherLatitude * rad) *
      Math.sin(((longitude - otherLongitude) * rad) / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}

export function normalizeGeoapify(
  data: unknown,
  group: GeoapifyGroup,
  area: IngestionArea,
): GeoapifyBatch {
  const collection = responseSchema.parse(data);
  const items: GeoapifyCandidate[] = [];
  for (const rawFeature of collection.features) {
    const parsed = featureSchema.safeParse(rawFeature);
    if (!parsed.success) continue;
    const { properties: p, geometry } = parsed.data;
    const [longitude, latitude] = geometry.coordinates;
    if (
      !p.name ||
      p.name.length > 120 ||
      longitude < -180 ||
      longitude > 180 ||
      latitude < -90 ||
      latitude > 90 ||
      distanceMeters(longitude, latitude, area.longitude, area.latitude) >
        area.radiusMeters ||
      (p.country_code && p.country_code.toLowerCase() !== 'vn')
    )
      continue;
    const categories = p.categories;
    const food = categories.some(
      (c) => c === 'catering' || c.startsWith('catering.'),
    );
    const nature = categories.some(
      (c) =>
        c === 'beach' || c.startsWith('beach.') || c.startsWith('natural.'),
    );
    if (!(
      food ||
      nature ||
      categories.some(
        (c) =>
          c.startsWith('tourism.') ||
          c === 'entertainment.museum' ||
          c.startsWith('entertainment.museum.'),
      )
    ))
      continue;
    const osm = p.datasource?.raw;
    const rawOsmType = osm?.osm_type?.toLowerCase();
    const osmType =
      ({ n: 'node', w: 'way', r: 'relation' } as Record<string, string>)[
        rawOsmType ?? ''
      ] ?? rawOsmType;
    const osmId = String(osm?.osm_id ?? '');
    // This import path is licensed for OSM-backed results only. Canonical OSM
    // identity survives provider place_id/coordinate changes between searches.
    if (
      p.datasource?.sourcename !== 'openstreetmap' ||
      !['node', 'way', 'relation'].includes(osmType ?? '') ||
      !/^\d+$/.test(osmId)
    )
      continue;
    const sourceUrl = `https://www.openstreetmap.org/${osmType}/${osmId}`;
    const address = (p.formatted ?? '').trim();
    items.push({
      externalId: `osm:${osmType}:${osmId}`,
      name: p.name,
      address: address.slice(0, 200),
      longitude,
      latitude,
      categories,
      category: food ? 'food' : nature ? 'nature' : 'culture',
      venueType: food ? 'restaurant' : 'place',
      sourceUrl,
      ...(osm?.wikipedia ? { wikipedia: osm.wikipedia } : {}),
      ...(osm?.wikidata && /^Q[1-9][0-9]*$/.test(osm.wikidata)
        ? { wikidata: osm.wikidata }
        : {}),
      openingHoursNote: (osm?.opening_hours ?? '').slice(0, 400),
      closed: osm?.disused === 'yes' || osm?.abandoned === 'yes' ? true : null,
      flags: [
        ...(!address ? ['missing_address'] : []),
        ...(!p.street ? ['missing_street'] : []),
        ...(!p.housenumber ? ['missing_house_number'] : []),
        ...(address.length > 200 ? ['address_truncated'] : []),
        ...(!osm?.opening_hours ? ['missing_hours'] : []),
        'unverified_location',
        'unknown_price',
        'missing_photo',
      ],
    });
  }
  return {
    group,
    received: collection.features.length,
    rejected: collection.features.length - items.length,
    items,
  };
}

export function geoapifyProvider(
  apiKey: string | undefined,
  request: typeof fetch = fetch,
) {
  return async (
    group: GeoapifyGroup,
    limit: number,
    area?: IngestionArea,
  ): Promise<GeoapifyBatch> => {
    if (!area)
      throw new HttpError(
        400,
        'SCOPE_REQUIRED',
        'Chọn phạm vi nguồn trước khi thu thập.',
      );
    if (!apiKey?.trim())
      throw new HttpError(
        503,
        'GEOAPIFY_NOT_CONFIGURED',
        'Chưa kết nối nguồn dữ liệu. Nhờ người thiết lập điền khóa Geoapify trên máy chủ rồi khởi động lại API.',
      );
    if (
      !(group in geoapifyGroups) ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 50
    )
      throw new HttpError(
        400,
        'INVALID_INPUT',
        'Chọn nhóm địa điểm và số lượng từ 1 đến 50.',
      );
    const url = new URL('https://api.geoapify.com/v2/places');
    url.search = new URLSearchParams({
      categories: geoapifyGroups[group],
      filter: `circle:${area.longitude},${area.latitude},${area.radiusMeters}`,
      bias: `proximity:${area.longitude},${area.latitude}`,
      limit: String(limit),
      lang: 'vi',
      apiKey: apiKey.trim(),
    }).toString();
    try {
      const response = await request(url, {
        signal: AbortSignal.timeout(20000),
        redirect: 'error',
      });
      if (!response.ok) {
        await response.body?.cancel();
        if (response.status === 429) {
          const header = response.headers.get('retry-after');
          const supplied =
            header && /^\d+$/.test(header)
              ? Date.now() + Number(header) * 1000
              : Date.parse(header ?? '');
          throw new GeoapifyRateLimit(
            new Date(
              Number.isFinite(supplied)
                ? Math.min(
                    Date.now() + 86400000,
                    Math.max(Date.now() + 1000, supplied),
                  )
                : Date.now() + 15 * 60000,
            ),
          );
        }
        if (response.status === 401 || response.status === 403)
          throw new HttpError(
            503,
            'GEOAPIFY_AUTH',
            'Nguồn dữ liệu chưa chấp nhận kết nối. Nhờ người thiết lập kiểm tra khóa và quyền truy cập Geoapify.',
          );
        throw new HttpError(
          response.status === 429 ? 429 : 502,
          'GEOAPIFY_REJECTED',
          'Geoapify chưa trả dữ liệu. Kiểm tra cấu hình/hạn mức và thử lại sau.',
        );
      }
      const reader = response.body?.getReader();
      if (!reader) throw new Error('Empty response');
      let text = '';
      let size = 0;
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 512000) {
          await reader.cancel();
          throw new Error('Response limit');
        }
        text += decoder.decode(value, { stream: true });
      }
      text += decoder.decode();
      if (text.includes(apiKey.trim())) throw new Error('Unsafe response');
      return normalizeGeoapify(JSON.parse(text), group, area);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      // Never propagate fetch URL/cause or provider payload: it can contain apiKey.
      throw new HttpError(
        502,
        'GEOAPIFY_UNAVAILABLE',
        'Chưa đọc được dữ liệu Geoapify hợp lệ. Chưa nhập địa điểm nào; hãy thử lại sau.',
      );
    }
  };
}
