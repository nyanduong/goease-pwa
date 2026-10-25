import { z } from 'zod';
import { catalogImageSchema, type ImageCandidate } from '@goease/contracts';
import { HttpError } from '../../http-error.js';

export type ImageQuery = {
  name: string;
  destinationName: string;
  latitude?: number;
  longitude?: number;
};
export type FindImages = (query: ImageQuery) => Promise<ImageCandidate[]>;
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
  return result.slice(0, 6);
}
export function wikimediaImages(request: typeof fetch = fetch): FindImages {
  async function query(
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
      const response = await request(url, {
        headers: {
          'User-Agent':
            'GoEase/1.0 (catalog photo review; https://github.com/nyanduong/goease-pwa)',
        },
        signal: AbortSignal.timeout(12000),
        redirect: 'error',
      });
      if (!response.ok) {
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
      return parseCommons(JSON.parse(body + decoder.decode()), match);
    } catch {
      throw new HttpError(
        502,
        'WIKIMEDIA_UNAVAILABLE',
        'Chưa lấy được ảnh Wikimedia. Địa điểm vẫn là nháp; có thể thử lại.',
      );
    }
  }
  return async (input) => {
    // Strip search operators; the external text is search data, never an instruction.
    const name = input.name.replace(/["|:{}<>]/g, ' ').slice(0, 120);
    const named = await query(
      {
        generator: 'search',
        gsrsearch: `"${name}" ${input.destinationName.replace(/["|:{}<>]/g, ' ')}`,
        gsrnamespace: '6',
        gsrlimit: '6',
      },
      'name',
    );
    if (named.length || input.latitude == null || input.longitude == null)
      return named;
    return query(
      {
        generator: 'geosearch',
        ggscoord: `${input.latitude}|${input.longitude}`,
        ggsradius: '500',
        ggsnamespace: '6',
        ggslimit: '6',
      },
      'nearby',
    );
  };
}
