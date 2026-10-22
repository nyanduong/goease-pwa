import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import type { ApiError } from '@goease/contracts';
import type { Config } from './config.js';
import { healthRouter } from './features/health/health.routes.js';
import { getRequestContext, requestContext } from './observability/context.js';
import {
  createLogger,
  httpMethods,
  type Logger,
} from './observability/logger.js';

export function createApp(
  config: Pick<Config, 'CLIENT_ORIGIN'> & Partial<Pick<Config, 'NODE_ENV'>>,
  ping: () => Promise<void>,
  logger: Logger = createLogger(config.NODE_ENV),
) {
  const app = express();
  app.disable('x-powered-by');
  app.use(requestContext);
  app.use((req, res, next) => {
    const context = getRequestContext();
    const started = performance.now();
    res.locals.logRoute = 'unmatched';
    res.once('finish', () => {
      logger.write('http.completed', {
        ...context,
        method: httpMethods.find((method) => method === req.method) ?? 'OTHER',
        route: res.locals.logRoute,
        statusCode: res.statusCode,
        durationMs: Math.min(
          3_600_000,
          Math.max(0, Math.round(performance.now() - started)),
        ),
      });
    });
    next();
  });
  app.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use(
    cors({ origin: config.CLIENT_ORIGIN, exposedHeaders: ['X-Request-Id'] }),
  );
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
    if (!clientError) logger.write('http.error');
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
