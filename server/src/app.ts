import { randomUUID } from 'node:crypto';
import express, { type ErrorRequestHandler } from 'express';
import type { ApiError, HealthResponse } from '@goease/contracts';
import { log } from './logger.js';

const clientErrors = new Map<number, ApiError['error']>([
  [400, { code: 'INVALID_REQUEST', message: 'Invalid request body.' }],
  [413, { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large.' }],
  [
    415,
    {
      code: 'UNSUPPORTED_MEDIA_TYPE',
      message: 'Unsupported request encoding or charset.',
    },
  ],
]);

const handleError: ErrorRequestHandler = (
  error: unknown,
  _request,
  response,
  next,
) => {
  if (response.headersSent) {
    next(error);
    return;
  }

  const status =
    typeof error === 'object' && error !== null && 'status' in error
      ? error.status
      : undefined;
  if (typeof status === 'number') {
    const detail = clientErrors.get(status);
    if (detail) {
      response
        .status(status)
        .json({ ok: false, error: detail } satisfies ApiError);
      return;
    }
  }

  response.status(500).json({
    ok: false,
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' },
  } satisfies ApiError);
};

export function createApp(writeLog = log) {
  const app = express();
  app.disable('x-powered-by');
  app.use((request, response, next) => {
    const requestId = randomUUID();
    const started = performance.now();
    response.setHeader('X-Request-Id', requestId);
    response.setHeader('Cache-Control', 'no-store');

    response.once('finish', () => {
      writeLog(
        response.statusCode >= 500 ? 'error' : 'info',
        'http.completed',
        {
          requestId,
          method: request.method,
          statusCode: response.statusCode,
          durationMs: Math.round(performance.now() - started),
        },
      );
    });
    next();
  });

  app.use(express.json({ limit: '16kb' }));
  app.get('/api/v1/health', (_request, response) => {
    response.json({
      ok: true,
      data: { status: 'up', service: 'goease-api' },
    } satisfies HealthResponse);
  });
  app.get('/api/v1/health/db', (_request, response) => {
    response.status(503).json({
      ok: false,
      error: {
        code: 'DATABASE_NOT_CONFIGURED',
        message: 'No database connection is configured.',
      },
    } satisfies ApiError);
  });
  app.use((_request, response) => {
    response.status(404).json({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'Endpoint not found.' },
    } satisfies ApiError);
  });
  app.use(handleError);

  return app;
}
