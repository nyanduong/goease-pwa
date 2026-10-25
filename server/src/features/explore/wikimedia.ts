import { z } from 'zod';
import {
  catalogImageSchema,
  imageCandidateSchema,
  type ImageCandidate,
} from '@goease/contracts';
import { HttpError } from '../../http-error.js';

export type ImageQuery = {
  name: string;
  destinationName: string;
  latitude?: number;
  longitude?: number;
  preferredCandidates?: ImageCandidate[];
};
export type FindImages = (query: ImageQuery) => Promise<ImageCandidate[]>;
export const imageSourceContext = (place: {
  name: string;
  destinationId: unknown;
  sourceUrl: string;
  mapLocation?: { latitude: number; longitude: number } | null;
}) =>
  JSON.stringify([
    place.name,
    String(place.destinationId),
    place.sourceUrl,
    place.mapLocation?.latitude ?? null,
    place.mapLocation?.longitude ?? null,
  ]);
const normalizedName = (value: string) =>
  value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
const genericNameWords = new Set(
  'cafe coffee caphe ca phe restaurant nha hang quan the and bar beach bai chua temple hotel khach san'.split(
    ' ',
  ),
);
export function matchesPlaceImage(
  name: string,
  candidate: ImageCandidate,
): boolean {
  const title = ` ${normalizedName(candidate.title)} `;
  const normalized = normalizedName(name);
  if (normalized && title.includes(` ${normalized} `)) return true;
  const terms = normalized
    .split(' ')
    .filter((word) => word.length >= 2 && !genericNameWords.has(word));
  return (
    terms.length >= 2 && terms.every((word) => title.includes(` ${word} `))
  );
}
const plain = (s: string) =>
  s
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
const metadata = z.record(
  z.string(),
  z.object({
    value: z.union([z.string().max(30000), z.number(), z.boolean()]),
  }),
);
const responseSchema = z.object({
  query: z
    .object({
      pages: z
        .array(
          z.object({
            pageid: z.number().int(),
            title: z.string().max(300),
            imageinfo: z
              .array(
                z.object({
                  url: z.string(),
                  thumburl: z.string().optional(),
                  descriptionurl: z.string(),
                  mime: z.string(),
                  extmetadata: metadata,
                }),
              )
              .optional(),
          }),
        )
        .max(10),
    })
    .optional(),
  error: z.unknown().optional(),
});
const safeUrl = (url: string, host: string) => {
  try {
    const u = new URL(url);
    return (
      u.protocol === 'https:' &&
      u.hostname === host &&
      !u.username &&
      !u.password &&
      !u.port
    );
  } catch {
    return false;
  }
};
export function parseCommons(
  data: unknown,
  match: 'name' | 'nearby',
): ImageCandidate[] {
  const parsed = responseSchema.parse(data);
  if (parsed.error) throw new Error('Provider error');
  const result: ImageCandidate[] = [];
  for (const p of parsed.query?.pages ?? []) {
    const info = p.imageinfo?.[0];
    if (!info || !['image/jpeg', 'image/png', 'image/webp'].includes(info.mime))
      continue;
    const field = (name: string) => {
      const value = info.extmetadata[name]?.value;
      return typeof value === 'string' ? plain(value) : '';
    };
    if (
      /artificial intelligence|AI.generated|generative|illustration|\bmap\b|\blogo\b|\brender\b/i.test(
        `${p.title} ${field('ImageDescription')} ${field('Categories')}`,
      )
    )
      continue;
    const license = field('LicenseShortName')
      .replace(/CC BY-SA /, 'CC-BY-SA-')
      .replace(/CC BY /, 'CC-BY-')
      .replace(/^CC0.*$/, 'CC0')
      .replace(/^Public domain$/i, 'Public-domain');
    if (!license.startsWith('CC') && license !== 'Public-domain') continue;
    // Cache the original raster, never a small Commons preview.
    const url = info.url;
    if (
      (!safeUrl(url, 'upload.wikimedia.org') &&
        !safeUrl(url, 'thumb.wikimedia.org')) ||
      !safeUrl(info.descriptionurl, 'commons.wikimedia.org')
    )
      continue;
    const licenseUrl = field('LicenseUrl');
    // Accept only explicit open licenses supported by the catalog; never guess a missing license.
    const image = catalogImageSchema.safeParse({
      url,
      sourceUrl: info.descriptionurl,
      credit: field('Attribution') || field('Artist'),
      license,
      ...(licenseUrl.startsWith('https://') ? { licenseUrl } : {}),
      reviewed: false,
    });
    if (!image.success) continue;
    result.push({
      id: String(p.pageid),
      title: p.title,
      match,
      image: image.data,
    });
  }
  return result.slice(0, 5);
}
export function wikimediaImages(request: typeof fetch = fetch): FindImages {
  let pending: Promise<unknown> = Promise.resolve();
  let cooldownUntil = 0;
  function query(params: Record<string, string>, match: 'name' | 'nearby') {
    const result = pending.then(() => queryNow(params, match));
    pending = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
  async function queryNow(
    params: Record<string, string>,
    match: 'name' | 'nearby',
  ) {
    const url = new URL('https://commons.wikimedia.org/w/api.php');
    url.search = new URLSearchParams({
      action: 'query',
      format: 'json',
      formatversion: '2',
      prop: 'imageinfo',
      iiprop: 'url|mime|extmetadata',
      maxlag: '5',
      ...params,
    }).toString();
    try {
      if (Date.now() < cooldownUntil) throw new Error('Provider cooldown');
      const response = await request(url, {
        headers: {
          'User-Agent':
            'GoEase/1.0 (catalog photo review; https://github.com/nyanduong/goease-pwa)',
        },
        signal: AbortSignal.timeout(12000),
        redirect: 'error',
      });
      if (!response.ok) {
        if ([429, 503].includes(response.status)) {
          const retry = response.headers.get('retry-after') ?? '';
          const delay = /^\d+$/.test(retry)
            ? Number(retry) * 1000
            : Date.parse(retry) - Date.now();
          cooldownUntil =
            Date.now() +
            Math.min(
              300000,
              Math.max(30000, Number.isFinite(delay) ? delay : 30000),
            );
        }
        await response.body?.cancel();
        throw new Error('Unavailable');
      }
      const reader = response.body?.getReader();
      if (!reader) throw new Error('Empty');
      let body = '',
        size = 0;
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 1000000) {
          await reader.cancel();
          throw new Error('Limit');
        }
        body += decoder.decode(value, { stream: true });
      }
      const data: unknown = JSON.parse(body + decoder.decode());
      const providerError = z
        .object({ error: z.object({ code: z.string() }) })
        .safeParse(data);
      if (
        providerError.success &&
        ['maxlag', 'ratelimited'].includes(providerError.data.error.code)
      )
        cooldownUntil = Date.now() + 30000;
      return parseCommons(data, match);
    } catch {
      throw new HttpError(
        502,
        'WIKIMEDIA_UNAVAILABLE',
        'Chưa lấy được ảnh Wikimedia. Địa điểm vẫn là nháp; có thể thử lại.',
      );
    }
  }
  return async (input) => {
    // Fresh source metadata may be prepared in a bulk lookup; still require the same name guard.
    const preferred = (input.preferredCandidates ?? [])
      .slice(0, 5)
      .flatMap((value) => {
        const parsed = imageCandidateSchema.safeParse(value);
        return parsed.success &&
          matchesPlaceImage(input.name, parsed.data) &&
          safeUrl(parsed.data.image.url, 'upload.wikimedia.org') &&
          safeUrl(parsed.data.image.sourceUrl, 'commons.wikimedia.org') &&
          (parsed.data.image.license.startsWith('CC') ||
            parsed.data.image.license === 'Public-domain') &&
          parsed.data.image.kind !== 'ai_illustration' &&
          !/generated|illustration|logo|render|\bmap\b|\bAI\b/i.test(
            parsed.data.title + ' ' + parsed.data.image.credit,
          )
          ? [parsed.data]
          : [];
      });
    if (preferred.length) return preferred;
    // Strip search operators; the external text is search data, never an instruction.
    const name = input.name.replace(/["|:{}<>]/g, ' ').slice(0, 120);
    const named = (
      await query(
        {
          generator: 'search',
          gsrsearch: `"${name}" ${input.destinationName.replace(/["|:{}<>]/g, ' ')}`,
          gsrnamespace: '6',
          gsrlimit: '6',
        },
        'name',
      )
    ).filter((candidate) => matchesPlaceImage(input.name, candidate));
    if (named.length) return named;
    // Historical Commons descriptions may still use a province name from before a merger.
    const byName = (
      await query(
        {
          generator: 'search',
          gsrsearch: `"${name}"`,
          gsrnamespace: '6',
          gsrlimit: '6',
        },
        'name',
      )
    ).filter((candidate) => matchesPlaceImage(input.name, candidate));
    if (byName.length || input.latitude == null || input.longitude == null)
      return byName;
    return (
      await query(
        {
          generator: 'geosearch',
          ggscoord: `${input.latitude}|${input.longitude}`,
          ggsradius: '500',
          ggsnamespace: '6',
          ggslimit: '6',
        },
        'nearby',
      )
    ).filter((candidate) => matchesPlaceImage(input.name, candidate));
  };
}
