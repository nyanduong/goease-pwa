import { SourceRateLimit } from './source-rate-limit.js';
import {
  websiteTextInfo,
  visitPageLinks,
  venueWebsiteMatches,
} from './visit-website-text.js';
import { visitInfoSchema, type VisitInfo } from '@goease/contracts';
import { visitSourceText } from './visit-source-http.js';
export type VisitQuery = {
  name: string;
  sourceUrl: string;
  destinationName: string;
  mapLocation?: { latitude: number; longitude: number } | null;
};
export type FindVisitInfo = (query: VisitQuery) => Promise<VisitInfo | null>;
export const visitContext = (q: VisitQuery) =>
  JSON.stringify([
    q.name,
    q.sourceUrl,
    q.destinationName,
    q.mapLocation?.latitude ?? null,
    q.mapLocation?.longitude ?? null,
  ]);
const normalized = (v: string) =>
  v
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]/g, '');
const record = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
const list = (v: unknown): unknown[] =>
  Array.isArray(v) ? v : v == null ? [] : [v];
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const stamp = (sourceUrl: string) => ({
  sourceUrl,
  observedAt: new Date().toISOString(),
  reviewed: false,
});

export function osmVisitInfo(
  tags: Record<string, string>,
  sourceUrl: string,
): VisitInfo {
  const hours = tags.opening_hours?.trim();
  const charge = tags.charge?.trim() ?? '';
  // Preserve the full charge expression. Never interpret conditional/multiple charges as one price.
  const match =
    /^(\d+)\s*VND(?:\s*\/\s*(person|người|item|món|group|nhóm))?$/i.exec(
      charge,
    );
  const amount = match ? Number(match[1]) : null;
  const unit: NonNullable<VisitInfo['price']>['unit'] = /person|người/i.test(
    match?.[2] ?? '',
  )
    ? 'person'
    : /item|món/i.test(match?.[2] ?? '')
      ? 'item'
      : /group|nhóm/i.test(match?.[2] ?? '')
        ? 'group'
        : 'unspecified';
  const unconditional = !tags['charge:conditional'] && !tags['fee:conditional'];
  return {
    hours:
      hours && hours.length <= 400
        ? { ...stamp(sourceUrl), text: hours }
        : null,
    price:
      unconditional &&
      amount !== null &&
      Number.isInteger(amount) &&
      amount <= 1e9
        ? {
            ...stamp(sourceUrl),
            amount,
            currency: 'VND',
            unit,
            conditions: `Giá nguồn OSM: ${charge}. Kiểm tra đối tượng và dịch vụ áp dụng.`,
          }
        : unconditional && tags.fee === 'no' && !charge
          ? {
              ...stamp(sourceUrl),
              amount: 0,
              currency: 'VND',
              unit: 'unspecified',
              conditions:
                'Nguồn OSM ghi không thu phí vào địa điểm; dịch vụ riêng có thể thu phí.',
            }
          : null,
  };
}

/** Read only structured fields on the exact named venue, not arbitrary prices elsewhere in HTML. */
export function websiteVisitInfo(
  html: string,
  name: string,
  sourceUrl: string,
): VisitInfo {
  const nodes: Record<string, unknown>[] = [];
  function collect(v: unknown, depth = 0) {
    if (depth > 5 || nodes.length >= 100) return;
    for (const item of list(v)) {
      const o = record(item);
      nodes.push(o);
      if (o['@graph']) collect(o['@graph'], depth + 1);
    }
  }
  for (const match of html.matchAll(
    /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi,
  )) {
    try {
      collect(JSON.parse(match[1]!));
    } catch (error) {
      if (error instanceof SourceRateLimit) throw error;
      /* malformed JSON is not evidence */
    }
  }
  const venues = nodes.filter(
    (o) =>
      normalized(str(o.name)) === normalized(name) &&
      /Place|Museum|Attraction|Restaurant|Cafe|Business|Park|Landmark/i.test(
        list(o['@type']).join(' '),
      ),
  );
  if (venues.length !== 1) return { hours: null, price: null };
  const venue = venues[0]!;
  const simple = list(venue.openingHours).map(str).filter(Boolean).join('; ');
  const specs = list(venue.openingHoursSpecification).map(record);
  const detailed = specs.map((s) => {
    const days = list(s.dayOfWeek)
      .map(str)
      .map((d) => d.replace(/^https?:\/\/schema.org\//, ''))
      .join(', ');
    const opens = str(s.opens),
      closes = str(s.closes);
    if (
      !days ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(opens) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(closes)
    )
      return '';
    return `${days}: ${opens}–${closes}${s.validFrom ? `; từ ${str(s.validFrom)}` : ''}${s.validThrough ? `; đến ${str(s.validThrough)}` : ''}`;
  });
  const hours = simple || (detailed.every(Boolean) ? detailed.join('; ') : '');
  const prices: NonNullable<VisitInfo['price']>[] = [];
  for (const raw of list(venue.offers).slice(0, 30)) {
    const offer = record(raw);
    const spec = record(offer.priceSpecification);
    if (str(offer.priceCurrency || spec.priceCurrency).toUpperCase() !== 'VND')
      continue;
    const value = offer.price ?? offer.lowPrice ?? spec.price;
    if (
      typeof value !== 'number' &&
      (typeof value !== 'string' || !/^\d+(\.0+)?$/.test(value))
    )
      continue;
    const amount = Number(value);
    if (!Number.isInteger(amount) || amount < 0 || amount > 1e9) continue;
    if (
      offer.priceValidUntil &&
      str(offer.priceValidUntil) < new Date().toISOString().slice(0, 10)
    )
      continue;
    const label = [str(offer.name), str(offer.description)]
      .filter(Boolean)
      .join(' · ');
    if (!label) continue; // No audience/offer label: do not invent applicability.
    prices.push({
      ...stamp(sourceUrl),
      amount,
      currency: 'VND',
      unit: 'unspecified',
      conditions: label.slice(0, 500),
    });
  }
  prices.sort((a, b) => a.amount - b.amount);
  return {
    hours:
      hours && hours.length <= 400
        ? { ...stamp(sourceUrl), text: hours }
        : null,
    price: prices[0] ?? null,
  };
}

export function visitInfoProvider(
  read: (url: string) => Promise<string> = visitSourceText,
): FindVisitInfo {
  return async (query) => {
    const deadline = Date.now() + 70000;
    let calls = 0;
    const get = async (url: string) => {
      if (++calls > 6 || Date.now() >= deadline)
        throw Error('Visit source budget exceeded');
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        return await Promise.race([
          read(url),
          new Promise<never>((_, reject) => {
            timer = setTimeout(
              () => reject(Error('Visit source timeout')),
              Math.max(1, deadline - Date.now()),
            );
          }),
        ]);
      } finally {
        clearTimeout(timer);
      }
    };
    const match =
      /^https:\/\/(?:www\.)?openstreetmap.org\/(node|way|relation)\/([1-9]\d*)\/?$/.exec(
        query.sourceUrl,
      );
    if (!match) return null;
    const data = record(
      JSON.parse(
        await get(
          `https://api.openstreetmap.org/api/0.6/${match[1]}/${match[2]}.json`,
        ),
      ),
    );
    const element = list(data.elements)
      .map(record)
      .find((e) => e.type === match[1] && String(e.id) === match[2]);
    if (!element) throw Error('Source identity mismatch');
    const tags = Object.fromEntries(
      Object.entries(record(element.tags)).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string',
      ),
    );
    if (
      ![tags.name, tags['name:vi'], tags['name:en']]
        .filter(Boolean)
        .some((n) => normalized(n!) === normalized(query.name))
    )
      return null;
    const info = osmVisitInfo(tags, query.sourceUrl);
    const websites = [tags.website || tags['contact:website']].filter(
      (s): s is string => !!s,
    );
    let failed = false;
    // Discover an entity only with BOTH an exact name/alias and coordinates near the imported POI.
    let entityId = tags.wikidata;
    let discoveredEntity: Record<string, unknown> | undefined;
    if (
      !websites.length &&
      !entityId &&
      query.mapLocation &&
      (!info.hours || !info.price)
    ) {
      try {
        const search = record(
          JSON.parse(
            await get(
              'https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&language=vi&type=item&limit=2&search=' +
                encodeURIComponent(query.name),
            ),
          ),
        );
        for (const candidate of list(search.search).slice(0, 2)) {
          const id = str(record(candidate).id);
          if (!/^Q[1-9][0-9]*$/.test(id)) continue;
          const data = record(
            JSON.parse(
              await get(
                'https://www.wikidata.org/wiki/Special:EntityData/' +
                  id +
                  '.json',
              ),
            ),
          );
          const entity = record(record(data.entities)[id]);
          const names = [
            ...Object.values(record(entity.labels)).map((v) =>
              str(record(v).value),
            ),
            ...Object.values(record(entity.aliases)).flatMap((v) =>
              list(v).map((x) => str(record(x).value)),
            ),
          ];
          if (!names.some((n) => normalized(n) === normalized(query.name)))
            continue;
          const close = list(record(entity.claims).P625).some((c) => {
            const coord = record(
              record(record(record(c).mainsnak).datavalue).value,
            );
            const lat = Number(coord.latitude),
              lon = Number(coord.longitude);
            if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
            const north = (lat - query.mapLocation!.latitude) * 111320;
            const east =
              (lon - query.mapLocation!.longitude) *
              111320 *
              Math.cos((lat * Math.PI) / 180);
            return Math.hypot(north, east) < 1500;
          });
          if (close) {
            entityId = id;
            discoveredEntity = entity;
            break;
          }
        }
      } catch (error) {
        if (error instanceof SourceRateLimit) throw error;
        failed = true;
      }
    }
    // Wikidata is reached only through the exact OSM feature's linked entity.
    if ((!info.hours || !info.price) && /^Q[1-9][0-9]*$/.test(entityId ?? '')) {
      try {
        const entity =
          discoveredEntity ??
          record(
            record(
              record(
                JSON.parse(
                  await get(
                    'https://www.wikidata.org/wiki/Special:EntityData/' +
                      entityId +
                      '.json',
                  ),
                ),
              ).entities,
            )[entityId!],
          );
        for (const claim of list(record(entity.claims).P856).slice(0, 2)) {
          const url = str(
            record(record(record(claim).mainsnak).datavalue).value,
          );
          if (url && !websites.includes(url)) websites.push(url);
        }
      } catch (error) {
        if (error instanceof SourceRateLimit) throw error;
        failed = true;
      }
    }
    let pages = 0;
    for (const website of websites.slice(0, 2)) {
      if (info.hours && info.price) break;
      try {
        const url = new URL(website);
        if (url.protocol === 'http:') url.protocol = 'https:';
        if (url.protocol !== 'https:' || url.username || url.password) continue;
        const html = await get(url.href);
        pages++;
        const extra = websiteVisitInfo(html, query.name, url.href);
        const text = websiteTextInfo(html, query.name, url.href);
        info.hours ??= extra.hours ?? text.hours;
        info.price ??= extra.price ?? text.price;
        for (const link of venueWebsiteMatches(html, query.name)
          ? visitPageLinks(html, url.href)
          : []) {
          if (pages >= 4 || (info.hours && info.price)) break;
          try {
            const page = await get(link);
            pages++;
            const structured = websiteVisitInfo(page, query.name, link);
            const visible = websiteTextInfo(page, query.name, link, true);
            info.hours ??= structured.hours ?? visible.hours;
            info.price ??= structured.price ?? visible.price;
          } catch (error) {
            if (error instanceof SourceRateLimit) throw error;
            pages++;
            failed = true;
          }
        }
      } catch (error) {
        if (error instanceof SourceRateLimit) throw error;
        failed = true;
      }
    }
    if (!info.hours && !info.price && failed)
      throw Error('Additional visit sources unavailable');
    return info.hours || info.price ? visitInfoSchema.parse(info) : null;
  };
}
