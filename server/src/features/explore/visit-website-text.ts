import type { VisitInfo } from '@goease/contracts';
const plain = (s: string) =>
  s
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#(\d{1,6});/g, (_, n: string) =>
      String.fromCodePoint(Math.min(Number(n), 0x10ffff)),
    )
    .replace(/\s+/g, ' ')
    .trim();
const key = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
const cleaned = (s: string) =>
  s.replace(/<(script|style|noscript|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
export const venueWebsiteMatches = (html: string, name: string) =>
  key(plain(cleaned(html))).includes(key(name));
/** Only explicit, short, labelled facts from a website linked to the venue. Never infer 24/7 or zero. */
export function websiteTextInfo(
  html: string,
  name: string,
  sourceUrl: string,
  linkedPage = false,
): VisitInfo {
  const safe = cleaned(html);
  const result: VisitInfo = { hours: null, price: null };
  if (!linkedPage && !key(plain(safe)).includes(key(name))) return result;
  // Keep adjacent heading + content, table row/cell labels and conditions together.
  const blocks = safe
    .split(/<\/(?:p|div|li|tr|h[1-6])\s*>|<br\s*\/?\s*>/i)
    .map(plain)
    .filter(Boolean);
  const evidence = {
    sourceUrl,
    observedAt: new Date().toISOString(),
    reviewed: false,
  };
  for (let i = 0; i < blocks.length; i++) {
    const line = blocks[i]!;
    const prior = blocks[i - 1] ?? '';
    const text = prior.length < 100 ? `${prior} ${line}`.trim() : line;
    const k = key(text);
    if (text.length > 400) continue;
    if (
      !result.hours &&
      /gio mo cua|gio tham quan|thoi gian mo cua|opening hours|visiting hours/.test(
        k,
      ) &&
      /\b(?:[01]?\d|2[0-3])\s*[:h]\s*(?:[0-5]\d)?\b/i.test(text)
    ) {
      // Include nearby schedule/closed-day qualifiers instead of dropping them.
      const next = blocks[i + 1] ?? '';
      const full =
        /thu |chu nhat|hang ngay|dong cua|monday|sunday|closed/i.test(key(next))
          ? `${text}; ${next}`
          : text;
      if (full.length <= 400) result.hours = { ...evidence, text: full };
    }
    if (
      result.price ||
      !/gia ve|ve vao|ve tham quan|admission|entrance|ticket/.test(k) ||
      /gui xe|parking|phat |donation|ung ho|hoc phi/.test(k)
    )
      continue;
    const amounts = [
      ...text.matchAll(
        /(?:^|[^\d.,])(\d{1,3}(?:[.,]\d{3})+|\d+)\s*(?:VND|VNĐ|đồng|đ)(?=\s|\/|$|[.,;])/gi,
      ),
    ];
    // Multiple prices need human context; never flatten adult/child/discount prices into one number.
    if (amounts.length !== 1) continue;
    const amount = Number(amounts[0]![1]!.replace(/[.,]/g, ''));
    if (!Number.isSafeInteger(amount) || amount < 0 || amount > 1e9) continue;
    result.price = {
      ...evidence,
      amount,
      currency: 'VND',
      unit: /\/\s*(người|khách|person)/i.test(text) ? 'person' : 'unspecified',
      conditions: text,
    };
  }
  return result;
}
export function visitPageLinks(html: string, base: string): string[] {
  const origin = new URL(base).origin;
  const links: string[] = [];
  for (const m of cleaned(html).matchAll(
    /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a\s*>/gi,
  )) {
    const label = key(`${m[1]} ${plain(m[2]!)}`);
    if (
      !/gia ve|bang gia|ticket|admission|gio mo cua|opening|tham quan|visit|lien he|contact/.test(
        label,
      )
    )
      continue;
    try {
      const u = new URL(m[1]!.replace(/&amp;/g, '&'), base);
      u.hash = '';
      if (
        u.protocol === 'https:' &&
        u.origin === origin &&
        !/\.(?:pdf|jpg|png|zip|mp4)$/i.test(u.pathname) &&
        u.href !== base &&
        !links.includes(u.href)
      )
        links.push(u.href);
    } catch {
      /* invalid link */
    }
    if (links.length === 2) break;
  }
  return links;
}
