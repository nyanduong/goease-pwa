import { lookup } from 'node:dns/promises';
import { get } from 'node:https';
import { isIP } from 'node:net';
import { SourceRateLimit, sourceRetryAfter } from './source-rate-limit.js';
import { acquireSourceOrigin } from './source-origin-gate.js';
const pausedOrigins = new Map<string, number>();

export function publicIPv4(address: string) {
  if (isIP(address) !== 4) return false;
  const [a, b] = address.split('.').map(Number);
  return !(
    [0, 10, 127].includes(a!) ||
    a! >= 224 ||
    (a === 100 && b! >= 64 && b! <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b! >= 16 && b! <= 31) ||
    (a === 192 && [0, 168].includes(b!)) ||
    (a === 198 && [18, 19, 51].includes(b!)) ||
    (a === 203 && b === 0)
  );
}
/** DNS is resolved once, validated, and pinned on the socket; no cookies or credentials. */
export async function visitSourceText(
  url: string,
  redirects = 0,
): Promise<string> {
  const u = new URL(url);
  const pausedUntil = pausedOrigins.get(u.origin) ?? 0;
  if (Date.now() < pausedUntil)
    throw new SourceRateLimit(pausedUntil - Date.now());
  if (
    u.protocol !== 'https:' ||
    u.username ||
    u.password ||
    (u.port && u.port !== '443') ||
    isIP(u.hostname)
  )
    throw Error('Invalid source URL');
  const release = await acquireSourceOrigin(u.origin);
  try {
    const currentPause = pausedOrigins.get(u.origin) ?? 0;
    if (Date.now() < currentPause)
      throw new SourceRateLimit(currentPause - Date.now());
    const deadline = AbortSignal.timeout(12000);
    const addresses = await Promise.race([
      lookup(u.hostname, { all: true, family: 4 }),
      new Promise<never>((_, reject) =>
        deadline.addEventListener(
          'abort',
          () => reject(Error('Source timeout')),
          { once: true },
        ),
      ),
    ]);
    if (!addresses.length || addresses.some((a) => !publicIPv4(a.address)))
      throw Error('Invalid source address');
    return await new Promise<string>((resolve, reject) => {
      const req = get(
        u,
        {
          signal: deadline,
          headers: {
            'User-Agent': 'GoEase/1.0 (place information review)',
            Accept: 'application/json,text/html',
            'Accept-Encoding': 'identity',
          },
          lookup: (_host, options, callback) => {
            if (typeof options === 'object' && options.all)
              callback(null, [addresses[0]!]);
            else callback(null, addresses[0]!.address, 4);
          },
        },
        (res) => {
          if (res.statusCode === 429 || res.statusCode === 503) {
            const wait = sourceRetryAfter(res.headers['retry-after'] ?? null);
            // Bound the per-process host cache; active workers persist their own pause.
            if (pausedOrigins.size >= 256)
              for (const [origin, until] of pausedOrigins)
                if (until < Date.now()) pausedOrigins.delete(origin);
            if (pausedOrigins.size < 256)
              pausedOrigins.set(u.origin, Date.now() + wait);
            res.destroy();
            reject(new SourceRateLimit(wait));
            return;
          }
          if (
            [301, 302, 303, 307, 308].includes(res.statusCode ?? 0) &&
            res.headers.location &&
            redirects < 2
          ) {
            res.destroy();
            release(); // Redirects may target this origin; release before recursive lookup.
            try {
              void visitSourceText(
                new URL(res.headers.location, u).href,
                redirects + 1,
              ).then(resolve, reject);
            } catch {
              reject(Error('Invalid source redirect'));
            }
            return;
          }
          if (
            res.statusCode !== 200 ||
            !/json|html/i.test(res.headers['content-type'] ?? '') ||
            Number(res.headers['content-length'] ?? 0) > 1_000_000
          ) {
            res.destroy();
            reject(Error('Source unavailable'));
            return;
          }
          let size = 0;
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => {
            size += chunk.length;
            if (size > 1_000_000) {
              res.destroy(Error('Source too large'));
              return;
            }
            chunks.push(chunk);
          });
          res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
          res.on('error', reject);
        },
      );
      req.on('error', reject);
    });
  } finally {
    release();
  }
}
