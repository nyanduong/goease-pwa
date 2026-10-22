import { Router } from 'express';
import type {
  ApiError,
  DatabaseHealthResponse,
  HealthResponse,
} from '@goease/contracts';

export function healthRouter(ping: () => Promise<void>) {
  const router = Router();
  router.get('/', (_req, res) => {
    res.locals.logRoute = '/api/v1/health';
    res.json({
      ok: true,
      data: { status: 'up', service: 'goease-api' },
    } satisfies HealthResponse);
  });
  router.get('/db', async (_req, res) => {
    res.locals.logRoute = '/api/v1/health/db';
    try {
      await ping();
      res.json({
        ok: true,
        data: { status: 'up', database: 'connected' },
      } satisfies DatabaseHealthResponse);
    } catch {
      res.status(503).json({
        ok: false,
        error: {
          code: 'DATABASE_UNAVAILABLE',
          message: 'Database is unavailable. Please retry.',
        },
      } satisfies ApiError);
    }
  });
  return router;
}
