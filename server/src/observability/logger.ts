import { writeSync } from 'node:fs';
import { z } from 'zod';
import { getRequestContext, uuidPattern } from './context.js';

const levels = {
  'email.reset_accepted': 'info',
  'email.reset_failed': 'error',
  'email.reset_cleanup_failed': 'error',
  'http.completed': 'info',
  'http.error': 'error',
  'database.connected': 'info',
  'database.disconnected': 'warn',
  'database.error': 'error',
  'database.retry': 'warn',
  'api.started': 'info',
  'api.stopping': 'info',
  'api.listen_failed': 'error',
  'api.startup_failed': 'error',
  'api.shutdown_failed': 'error',
  'logger.invalid_input': 'warn',
  'product.init_failed': 'error',
  'catalog.worker_failed': 'error',
} as const;
export const httpMethods = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS',
  'OTHER',
] as const;
const fieldsSchema = z.object({
  requestId: z.string().regex(uuidPattern).optional(),
  correlationId: z.string().regex(uuidPattern).optional(),
  method: z.enum(httpMethods).optional(),
  route: z
    .enum([
      '/api/v1/health',
      '/api/v1/health/db',
      '/api/v1/auth/options',
      '/api/v1/auth/me',
      '/api/v1/me/profile',
      '/api/v1/me/password',
      '/api/v1/auth/register',
      '/api/v1/auth/login',
      '/api/v1/auth/forgot-password',
      '/api/v1/auth/reset-password',
      '/api/v1/auth/logout',
      '/api/v1/auth/verify-email',
      '/api/v1/auth/google',
      '/api/v1/auth/google/callback',
      '/api/v1/dev/mailbox',
      '/api/v1/destinations',
      '/api/v1/places',
      '/api/v1/admin/places',
      '/api/v1/admin/places/:id',
      '/api/v1/admin/catalog/operations',
      '/api/v1/admin/catalog/schedule',
      '/api/v1/admin/catalog/run',
      '/api/v1/admin/catalog/reviews',
      '/api/v1/admin/catalog/reviews/:id/decision',
      '/api/v1/admin/catalog/batch-preview',
      '/api/v1/admin/catalog/batch',
      '/api/v1/admin/catalog/history',
      '/api/v1/admin/place-import/preview',
      '/api/v1/admin/place-import/commit',
      '/api/v1/places/:id',
      '/api/v1/me/places',
      '/api/v1/me/places/:id',
      '/api/v1/trips',
      '/api/v1/trips/trash',
      '/api/v1/trips/:id/restore',
      '/api/v1/shared-trip',
      '/api/v1/trips/:id/shares',
      '/api/v1/trips/:id/shares/:shareId',
      '/api/v1/trips/:id/expenses',
      '/api/v1/trips/:id/expenses/:expenseId',
      '/api/v1/trips/budget-preview',
      '/api/v1/trips/ai-proposal',
      '/api/v1/trips/:id/goe-proposal',
      '/api/v1/trips/:id/goe-apply',
      '/api/v1/trips/:id',
      '/api/v1/trips/:id/duplicate',
      'unmatched',
    ])
    .optional(),
  statusCode: z.number().int().min(100).max(599).optional(),
  durationMs: z.number().finite().min(0).max(3_600_000).optional(),
});
export type LogEvent = keyof typeof levels;

// No recursive fallback logging. Technical sink failure never masks an audit error.
export function createLogger(
  environment: unknown = 'development',
  sink: (line: string) => void = (line) => {
    writeSync(1, line);
  },
) {
  const env = z
    .enum(['development', 'test', 'production'])
    .catch('development')
    .parse(environment);
  return Object.freeze({
    write(event: LogEvent, fields: unknown = {}) {
      try {
        const parsed = fieldsSchema.safeParse(fields);
        const validEvent = Object.hasOwn(levels, event);
        const code =
          parsed.success && validEvent ? event : 'logger.invalid_input';
        const context = getRequestContext();
        sink(
          JSON.stringify({
            timestamp: new Date().toISOString(),
            level: levels[code],
            event: code,
            service: 'goease-api',
            environment: env,
            appVersion: '0.0.0',
            ...(context ?? {}),
            ...(parsed.success && validEvent ? parsed.data : {}),
          }) + '\n',
        );
      } catch {
        // Includes a failed sink or hostile object getter; never serialize the error.
      }
    },
  });
}
export type Logger = ReturnType<typeof createLogger>;
