import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import type { ApiError } from '@goease/contracts';
import type { Config } from './config.js';
import { healthRouter } from './features/health/health.routes.js';

export function createApp(
  config: Pick<Config, 'CLIENT_ORIGIN'>,
  ping: () => Promise<void>,
) {
  const app = express();
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use(cors({ origin: config.CLIENT_ORIGIN }));
  app.use(express.json({ limit: '16kb' }));
  app.use('/api/v1/health', healthRouter(ping));
  app.use((_req, res) => {
    res.status(404).json({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'Endpoint not found' },
    } satisfies ApiError);
  });
  const errorHandler: ErrorRequestHandler = (
    error: unknown,
    _req,
    res,
    _next,
  ) => {
    const status =
      typeof error === 'object' && error !== null && 'status' in error
        ? error.status
        : undefined;
    const clientError = status === 400 || status === 413;
    if (!clientError) console.error('Unhandled API error');
    res.status(clientError ? status : 500).json({
      ok: false,
      error: {
        code: clientError ? 'INVALID_REQUEST' : 'INTERNAL_ERROR',
        message: clientError
          ? 'Invalid JSON request or payload too large'
          : 'An unexpected error occurred',
      },
    } satisfies ApiError);
  };
  app.use(errorHandler);
  return app;
}
