import { z } from 'zod';
import {
  placeDescriptionSchema,
  type PlaceDescription,
} from '@goease/contracts';
import { distanceMeters } from './geoapify.js';
import { HttpError } from '../../http-error.js';
export type DescriptionQuery = {
  name: string;
  destinationName: string;
  latitude?: number;
  longitude?: number;
  sourceUrl: string;
  wikipedia?: string;
  wikidata?: string;
};
export type FindDescription = (
  query: DescriptionQuery,
) => Promise<PlaceDescription | null>;
export type TranslateDescription = (text: string) => Promise<string | null>;
export async function boundedDescriptionJson(response: Response) {
  if (!response.ok || !response.body) {
    await response.body?.cancel();
    throw new Error('Description source unavailable');
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 1_000_000) throw new Error('Description response too large');
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}
const key = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
export const shortDescription = (text: string) => {
  const clean = text
    .replace(/<[^>]*>/g, '')
    .replace(/\[[0-9]+\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const sentences = clean.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) ?? [];
  let result = '';
  for (const sentence of sentences.slice(0, 3)) {
    if ((result + sentence).length > 1000) break;
    result += sentence;
  }
  return result.trim();
};
const pageSchema = z.object({
  title: z.string().max(300),
  pageid: z.number().int().optional(),
  lastrevid: z.number().int().positive().optional(),
  extract: z.string().max(30000).optional(),
  missing: z.boolean().optional(),
  pageprops: z.record(z.string(), z.unknown()).optional(),
  coordinates: z
    .array(z.object({ lat: z.number(), lon: z.number() }))
    .optional(),
});
const resultSchema = z.object({
  error: z.unknown().optional(),
  query: z.object({ pages: z.array(pageSchema).max(5) }).optional(),
});
export function wikipediaDescriptions(
  request: typeof fetch = fetch,
  translate?: TranslateDescription,
): FindDescription {
  return async (query) => {
    let calls = 0;
    const get = async (url: URL) => {
      if (++calls > 8) throw new Error('Description request budget');
      return boundedDescriptionJson(
        await request(url, {
          redirect: 'error',
          signal: AbortSignal.timeout(12000),
          headers: {
            'User-Agent':
              'GoEase/1.0 (place descriptions; admin-reviewed drafts)',
          },
        }),
      );
    };
    try {
      let wikipedia = query.wikipedia,
        wikidata = query.wikidata;
      if (!wikipedia && !wikidata) {
        const osm = query.sourceUrl.match(
          /^https:\/\/www\.openstreetmap\.org\/(node|way|relation)\/(\d+)$/,
        );
        if (osm) {
          try {
            const raw = await get(
              new URL(
                `https://api.openstreetmap.org/api/0.6/${osm[1]}/${osm[2]}.json`,
              ),
            );
            const tags = z
              .object({
                elements: z
                  .array(
                    z.object({
                      tags: z
                        .object({
                          wikipedia: z.string().max(300).optional(),
                          wikidata: z.string().max(40).optional(),
                        })
                        .optional(),
                    }),
                  )
                  .max(1),
              })
              .parse(raw).elements[0]?.tags;
            wikipedia = tags?.wikipedia;
            wikidata = tags?.wikidata;
          } catch {
            /* Old POIs may have no OSM tags; bounded Wikipedia search still works. */
          }
        }
      }
      const linked: Partial<Record<'vi' | 'en', string>> = {};
      const link = wikipedia?.match(/^(vi|en):(.{1,280})$/);
      if (link) linked[link[1] as 'vi' | 'en'] = link[2]!;
      if (wikidata && /^Q[1-9][0-9]*$/.test(wikidata)) {
        const url = new URL('https://www.wikidata.org/w/api.php');
        url.search = new URLSearchParams({
          action: 'wbgetentities',
          ids: wikidata,
          props: 'sitelinks',
          sitefilter: 'viwiki|enwiki',
          format: 'json',
        }).toString();
        const body = z
          .object({
            entities: z.record(
              z.string(),
              z.object({
                sitelinks: z
                  .record(z.string(), z.object({ title: z.string().max(300) }))
                  .optional(),
              }),
            ),
          })
          .parse(await get(url));
        for (const language of ['vi', 'en'] as const) {
          const title =
            body.entities[wikidata]?.sitelinks?.[language + 'wiki']?.title;
          if (title) linked[language] ??= title;
        }
      }
      for (const language of ['vi', 'en'] as const) {
        const choices = linked[language] ? [true, false] : [false];
        for (const direct of choices) {
          if (
            !direct &&
            (query.latitude === undefined || query.longitude === undefined)
          )
            continue;
          const url = new URL(`https://${language}.wikipedia.org/w/api.php`);
          url.search = new URLSearchParams({
            action: 'query',
            format: 'json',
            formatversion: '2',
            redirects: '1',
            prop: 'extracts|coordinates|pageprops|info',
            exintro: '1',
            explaintext: '1',
            exsentences: '3',
            exlimit: 'max',
            colimit: 'max',
            ...(direct
              ? { titles: linked[language]! }
              : {
                  generator: 'search',
                  gsrsearch: `${query.name} ${query.destinationName}`,
                  gsrnamespace: '0',
                  gsrlimit: '3',
                }),
          }).toString();
          const parsed = resultSchema.parse(await get(url));
          if (parsed.error) throw new Error('Wikipedia API failure');
          const candidates = (parsed.query?.pages ?? []).filter((page) => {
            if (
              page.missing ||
              !page.extract ||
              !page.lastrevid ||
              page.pageprops?.disambiguation !== undefined
            )
              return false;
            const point = page.coordinates?.[0];
            const nearby =
              point &&
              query.latitude !== undefined &&
              query.longitude !== undefined &&
              distanceMeters(
                query.longitude,
                query.latitude,
                point.lon,
                point.lat,
              ) <= 1500;
            if (direct)
              return (
                !point ||
                query.latitude === undefined ||
                query.longitude === undefined ||
                !!nearby
              );
            const requested = key(query.name),
              found = key(page.title.replace(/\([^)]*\)/g, ''));
            return (
              nearby &&
              requested.length >= 4 &&
              found.length >= 4 &&
              (requested === found ||
                (requested.split(' ').length >= 2 &&
                  found.split(' ').length >= 2 &&
                  (requested.includes(found) || found.includes(requested))))
            );
          });
          if (candidates.length !== 1) continue;
          const page = candidates[0]!,
            originalText = shortDescription(page.extract!);
          if (originalText.length < 40) continue;
          const text =
            language === 'vi'
              ? originalText
              : ((await translate?.(originalText)) ?? '');
          return placeDescriptionSchema.parse({
            text,
            originalText,
            title: page.title,
            sourceUrl: `https://${language}.wikipedia.org/w/index.php?title=${encodeURIComponent(page.title)}&oldid=${page.lastrevid}`,
            language,
            translated: language === 'en' && !!text,
            revisionId: page.lastrevid,
            license: 'CC-BY-SA-4.0',
            match: direct ? 'linked' : 'name_coordinates',
          });
        }
      }
      return null;
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(
        502,
        'DESCRIPTION_SOURCE_FAILED',
        'Chưa lấy được giới thiệu từ Wikipedia. Bạn có thể thử lại.',
      );
    }
  };
}
