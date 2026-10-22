import { createHash, randomBytes, createHmac } from 'node:crypto';
import type { Request } from 'express';
import { HttpError } from '../../http-error.js';
export const opaqueToken = () => randomBytes(32).toString('base64url');
export const tokenHash = (token: string) =>
  createHash('sha256').update(token).digest('hex');
export function cookie(req: Request, name: string) {
  const value = req.headers.cookie
    ?.split(';')
    .map((v) => v.trim())
    .find((v) => v.startsWith(name + '='))
    ?.slice(name.length + 1);
  return value && /^[a-zA-Z0-9_-]{43}$/.test(value) ? value : undefined;
}
export function authLimiter(limit: number, windowSeconds: number) {
  const secret = randomBytes(32);
  const buckets = new Map<string, { count: number; until: number }>();
  return (req: Request, email: string) => {
    const now = Date.now();
    for (const [key, value] of buckets)
      if (value.until <= now) buckets.delete(key);
    // Ephemeral keyed identifiers are used only for bounded security rate limiting, never analytics/logs.
    for (const raw of [
      `network:${req.socket.remoteAddress ?? 'unknown'}`,
      `account:${email}`,
    ]) {
      const key = createHmac('sha256', secret).update(raw).digest('hex');
      let entry = buckets.get(key);
      if (!entry) {
        if (buckets.size >= 10000)
          throw new HttpError(
            503,
            'AUTH_BUSY',
            'Máy chủ đang bận. Vui lòng thử lại sau.',
          );
        entry = { count: 0, until: now + windowSeconds * 1000 };
        buckets.set(key, entry);
      }
      if (++entry.count > limit)
        throw new HttpError(
          429,
          'RATE_LIMITED',
          'Bạn đã thử quá nhiều lần. Vui lòng thử lại sau.',
        );
    }
  };
}
