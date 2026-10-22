import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

// Only opaque UUIDv4 values are accepted, never free-form tracing strings.
export const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export type RequestContext = Readonly<{
  requestId: string;
  correlationId?: string;
}>;
const storage = new AsyncLocalStorage<RequestContext>();

export function getRequestContext() {
  return storage.getStore();
}

export function tracingId(value: unknown): string | undefined {
  return typeof value === 'string' &&
    value.length === 36 &&
    uuidPattern.test(value)
    ? value.toLowerCase()
    : undefined;
}

export const requestContext: RequestHandler = (req, res, next) => {
  const correlationId = tracingId(req.headers['x-correlation-id']);
  const context = Object.freeze({
    requestId: tracingId(req.headers['x-request-id']) ?? randomUUID(),
    ...(correlationId ? { correlationId } : {}),
  });
  res.setHeader('X-Request-Id', context.requestId);
  storage.run(context, next);
};
