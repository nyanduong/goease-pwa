import express, { type ErrorRequestHandler, type Router } from 'express';
import { HttpError } from './http-error.js';
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
  config: Pick<Config, 'CLIENT_ORIGIN'> &
    Partial<Pick<Config, 'NODE_ENV' | 'TRUST_PROXY_LOOPBACK'>>,
  ping: () => Promise<void>,
  logger: Logger = createLogger(config.NODE_ENV),
  productRouter?: Router,
) {
  const app = express();
  if (config.TRUST_PROXY_LOOPBACK) app.set('trust proxy', 'loopback');
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
    cors({
      origin: config.CLIENT_ORIGIN,
      credentials: true,
      exposedHeaders: ['X-Request-Id'],
    }),
  );
  if (productRouter) app.use('/api/v1/trips', express.json({ limit: '256kb' }));
  if (productRouter)
    app.use(
      '/api/v1/admin/place-import/commit',
      express.json({ limit: '48kb' }),
    );
  app.use(express.json({ limit: '16kb' }));
  app.use('/api/v1/health', healthRouter(ping));
  if (productRouter) app.use('/api/v1', productRouter);
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
    if (error instanceof HttpError) {
      res.status(error.status).json({
        ok: false,
        error: { code: error.code, message: error.message },
      });
      return;
    }
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
