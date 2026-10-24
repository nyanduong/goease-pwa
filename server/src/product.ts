import { passwordRecovery } from './features/auth/password-recovery.js';
import { adminCatalog } from './features/explore/admin-catalog.js';
import { placeImportService } from './features/explore/place-import.js';
import { geoapifyProvider } from './features/explore/geoapify.js';
import { catalogOperations } from './features/explore/catalog-operations.js';
import { adminInsights } from './features/explore/admin-insights.js';
import { adminSettingsSchema } from '@goease/contracts';
import {
  catalogScheduleSchema,
  catalogBatchSchema,
  reviewDecisionSchema,
} from '@goease/contracts';
import {
  adminPlaceWriteSchema,
  adminPlaceQuerySchema,
  placeImportSearchSchema,
  placeImportCommitSchema,
} from '@goease/contracts';
import {
  resetEmailSender,
  type ResetEmailSender,
} from './features/auth/reset-email.js';
import { createLogger, type Logger } from './observability/logger.js';
import { forgotPasswordSchema, resetPasswordSchema } from '@goease/contracts';
import { tripSharing } from './features/trips/trip-sharing.js';
import { shareCreateSchema } from '@goease/contracts';
import { tripManagement } from './features/trips/trip-management.js';
import { expenseService } from './features/expenses/expense.service.js';
import { exploreService } from './features/explore/explore.service.js';
import { Router } from 'express';
import mongoose, { type Connection } from 'mongoose';
import { z } from 'zod';
import {
  profileUpdateSchema,
  passwordChangeSchema,
  tripActionSchema,
  tripDuplicateSchema,
  tripListQuerySchema,
  tripTrashQuerySchema,
  expenseCreateSchema,
  expenseUpdateSchema,
  expenseRevisionSchema,
  expenseQuerySchema,
  loginSchema,
  registerSchema,
  tripInputSchema,
  plannerRequestSchema,
  rescheduleRequestSchema,
  goeRequestSchema,
  goeApplySchema,
} from '@goease/contracts';
import type { Config } from './config.js';
import { authService, userDto } from './features/auth/auth.service.js';
import { googleAuth } from './features/auth/google.js';
import { tripService } from './features/trips/trip.service.js';
import { businessAudit } from './features/audit/business-audit.js';
import { HttpError } from './http-error.js';
import { uuidPattern } from './observability/context.js';
import { calculateBudget } from './features/trips/budget.js';
import { plannerService } from './features/ai/planner.js';

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success)
    throw new HttpError(
      400,
      'INVALID_INPUT',
      'Dữ liệu chưa hợp lệ. Kiểm tra tên, email, mật khẩu, ngày và hoạt động.',
    );
  return parsed.data;
}
export function createProduct(
  connection: Connection,
  config: Config,
  dependencies: {
    resetEmail?: ResetEmailSender;
    logger?: Logger;
    geoapify?: ReturnType<typeof geoapifyProvider>;
  } = {},
) {
  const audit = businessAudit(connection, config.NODE_ENV);
  const auth = authService(connection, config, audit);
  const recovery = passwordRecovery(
    connection,
    config,
    auth,
    audit,
    dependencies.resetEmail ?? resetEmailSender(config),
    dependencies.logger ?? createLogger(config.NODE_ENV),
  );
  const trips = tripService(connection, audit);
  const sharing = tripSharing(connection, trips, audit);
  const manageTrip = tripManagement(connection, trips, audit);
  const expenses = expenseService(connection, trips, audit);
  const explore = exploreService(connection);
  const catalog = adminCatalog(
    connection,
    explore,
    trips,
    audit,
    auth.models.User,
  );
  const planner = plannerService(connection, config, trips, explore);
  const placeImport = placeImportService(
    connection,
    catalog,
    explore,
    trips,
    audit,
    dependencies.geoapify ?? geoapifyProvider(config.GEOAPIFY_API_KEY),
  );
  const google = googleAuth(connection, config, auth);
  const operations = catalogOperations(
    connection,
    catalog,
    explore,
    trips,
    placeImport,
    audit,
    dependencies.geoapify ?? geoapifyProvider(config.GEOAPIFY_API_KEY),
    Boolean(dependencies.geoapify || config.GEOAPIFY_API_KEY),
    dependencies.logger ?? createLogger(config.NODE_ENV),
  );
  placeImport.setQuotaGuard(operations.reserveSearch);
  const insights = adminInsights(connection, catalog, explore, audit);
  const router = Router();
  let ready = false;
  router.use((req, res, next) => {
    const publicTemplates = [
      '/shared-trip',
      '/auth/options',
      '/auth/me',
      '/me/profile',
      '/me/password',
      '/auth/register',
      '/auth/login',
      '/auth/forgot-password',
      '/auth/reset-password',
      '/auth/logout',
      '/auth/google',
      '/auth/google/callback',
      '/destinations',
      '/places',
      '/admin/places',
      '/admin/place-import/preview',
      '/admin/place-import/commit',
      '/admin/catalog/operations',
      '/admin/catalog/schedule',
      '/admin/catalog/run',
      '/admin/catalog/reviews',
      '/admin/catalog/batch-preview',
      '/admin/catalog/batch',
      '/admin/catalog/history',
      '/me/places',
      '/trips',
      '/trips/trash',
      '/trips/budget-preview',
      '/trips/ai-proposal',
      '/trips/reschedule-dates',
    ];
    if (publicTemplates.includes(req.path))
      res.locals.logRoute = '/api/v1' + req.path;
    else if (/^\/trips\/[^/]+$/.test(req.path))
      res.locals.logRoute = '/api/v1/trips/:id';
    if (/^\/trips\/[^/]+\/restore$/.test(req.path))
      res.locals.logRoute = '/api/v1/trips/:id/restore';
    if (/^\/trips\/[^/]+\/duplicate$/.test(req.path))
      res.locals.logRoute = '/api/v1/trips/:id/duplicate';
    if (/^\/trips\/[^/]+\/expenses$/.test(req.path))
      res.locals.logRoute = '/api/v1/trips/:id/expenses';
    if (/^\/trips\/[^/]+\/expenses\/[^/]+$/.test(req.path))
      res.locals.logRoute = '/api/v1/trips/:id/expenses/:expenseId';
    if (/^\/places\/[^/]+$/.test(req.path))
      res.locals.logRoute = '/api/v1/places/:id';
    if (/^\/admin\/places\/[^/]+$/.test(req.path))
      res.locals.logRoute = '/api/v1/admin/places/:id';
    if (/^\/admin\/catalog\/reviews\/[^/]+\/decision$/.test(req.path))
      res.locals.logRoute = '/api/v1/admin/catalog/reviews/:id/decision';
    if (/^\/me\/places\/[^/]+$/.test(req.path))
      res.locals.logRoute = '/api/v1/me/places/:id';
    if (/^\/trips\/[^/]+\/goe-proposal$/.test(req.path))
      res.locals.logRoute = '/api/v1/trips/:id/goe-proposal';
    if (/^\/trips\/[^/]+\/goe-apply$/.test(req.path))
      res.locals.logRoute = '/api/v1/trips/:id/goe-apply';
    if (/^\/trips\/[^/]+\/shares$/.test(req.path))
      res.locals.logRoute = '/api/v1/trips/:id/shares';
    if (/^\/trips\/[^/]+\/shares\/[^/]+$/.test(req.path))
      res.locals.logRoute = '/api/v1/trips/:id/shares/:shareId';
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (!ready || connection.readyState !== 1) {
      next(
        new HttpError(
          503,
          'DATABASE_UNAVAILABLE',
          'Dữ liệu chưa sẵn sàng. Giữ bản đang nhập và thử lại sau.',
        ),
      );
      return;
    }
    if (
      ['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method) &&
      (req.get('Origin') !== config.CLIENT_ORIGIN ||
        req.get('X-GoEase-Client') !== 'web')
    ) {
      next(
        new HttpError(
          403,
          'INVALID_ORIGIN',
          'Yêu cầu không xuất phát từ GoEase.',
        ),
      );
      return;
    }
    next();
  });
  router.get('/auth/options', (_req, res) =>
    res.json({
      ok: true,
      data: {
        google: google.configured,
        emailMode: 'password',
      },
    }),
  );
  router.get('/auth/me', async (req, res) => {
    const hadSessionCookie = auth.hasSessionCookie(req);
    const value = await auth.authenticate(req);
    const expiredSession = hadSessionCookie && !value;
    if (expiredSession) auth.clearSessionCookie(res);
    res.json({
      ok: true,
      data: {
        user: value ? userDto(value.user) : null,
        expiredSession,
      },
    });
  });
  router.post('/auth/register', async (req, res) => {
    const value = parse(registerSchema, req.body);
    try {
      const result = await auth.register(req, value);
      auth.setCookie(res, result.token);
      res.status(201).json({ ok: true, data: { user: result.user } });
    } catch (error) {
      if (
        error instanceof mongoose.mongo.MongoServerError &&
        error.code === 11000
      )
        throw new HttpError(
          409,
          'EMAIL_UNAVAILABLE',
          'Email này chưa dùng được cho đăng ký. Thử đăng nhập hoặc dùng email khác.',
        );
      throw error;
    }
  });
  router.post('/auth/login', async (req, res) => {
    const value = await auth.login(req, parse(loginSchema, req.body));
    auth.setCookie(res, value.token);
    res.json({ ok: true, data: { user: value.user } });
  });
  router.post('/auth/forgot-password', async (req, res) =>
    res.status(202).json({
      ok: true,
      data: await recovery.request(
        req,
        parse(forgotPasswordSchema, req.body).email,
      ),
    }),
  );
  router.post('/auth/reset-password', async (req, res) => {
    const data = await recovery.reset(
      req,
      parse(resetPasswordSchema, req.body),
    );
    auth.clearSessionCookie(res);
    res.json({ ok: true, data });
  });
  router.post('/auth/logout', async (req, res) => {
    await auth.logout(req, res);
    res.json({ ok: true, data: { loggedOut: true } });
  });
  router.get('/me/profile', async (req, res) =>
    res.json({ ok: true, data: await auth.account(req) }),
  );
  router.patch('/me/profile', async (req, res) =>
    res.json({
      ok: true,
      data: await auth.updateProfile(req, parse(profileUpdateSchema, req.body)),
    }),
  );
  router.post('/me/password', async (req, res) =>
    res.json({
      ok: true,
      data: await auth.changePassword(
        req,
        parse(passwordChangeSchema, req.body),
        parse(z.string().regex(uuidPattern), req.get('Idempotency-Key')),
      ),
    }),
  );
  router.get('/auth/google', google.begin);
  router.get('/auth/google/callback', google.callback);
  router.get('/destinations', async (_req, res) =>
    res.json({ ok: true, data: await trips.destinations() }),
  );
  router.get('/places', async (req, res) =>
    res.json({ ok: true, data: await explore.list(req.query) }),
  );
  router.get('/places/:id', async (req, res) =>
    res.json({ ok: true, data: await explore.read(String(req.params.id)) }),
  );
  router.use('/admin', async (req, res, next) => {
    const value = await auth.authenticate(req);
    if (!value)
      throw new HttpError(
        401,
        'AUTH_REQUIRED',
        'Đăng nhập bằng tài khoản quản trị.',
      );
    await catalog.requireAdmin(value.user._id);
    res.locals.authUser = value.user;
    next();
  });
  router.get('/admin/places', async (req, res) =>
    res.json({
      ok: true,
      data: await catalog.list(
        res.locals.authUser._id,
        parse(adminPlaceQuerySchema, req.query),
      ),
    }),
  );
  router.get('/admin/catalog/overview', async (req, res) =>
    res.json({
      ok: true,
      data: await insights.overview(
        res.locals.authUser._id,
        parse(
          z
            .string()
            .regex(/^[a-f0-9]{24}$/)
            .optional(),
          req.query.destinationId,
        ),
      ),
    }),
  );
  router.get('/admin/catalog/settings', async (_req, res) =>
    res.json({
      ok: true,
      data: await insights.settings(res.locals.authUser._id),
    }),
  );
  router.put('/admin/catalog/settings', async (req, res) =>
    res.json({
      ok: true,
      data: await insights.saveSettings(
        res.locals.authUser._id,
        parse(adminSettingsSchema, req.body),
      ),
    }),
  );
  router.get('/admin/places/:id/versions', async (req, res) =>
    res.json({
      ok: true,
      data: await insights.versions(
        res.locals.authUser._id,
        String(req.params.id),
      ),
    }),
  );
  router.post('/admin/places/:id/restore', async (req, res) => {
    const body = parse(
      z.strictObject({
        revision: z.number().int().nonnegative(),
        expectedRevision: z.number().int().nonnegative(),
      }),
      req.body,
    );
    res.json({
      ok: true,
      data: await insights.restore(
        res.locals.authUser._id,
        String(req.params.id),
        body.revision,
        body.expectedRevision,
        parse(z.string().regex(uuidPattern), req.get('Idempotency-Key')),
      ),
    });
  });
  router.get('/admin/catalog/operations', async (req, res) =>
    res.json({
      ok: true,
      data: await operations.status(
        res.locals.authUser._id,
        parse(
          z
            .string()
            .regex(/^[a-f0-9]{24}$/)
            .optional(),
          req.query.destinationId,
        ),
      ),
    }),
  );
  router.put('/admin/catalog/schedule', async (req, res) =>
    res.json({
      ok: true,
      data: await operations.saveSchedule(
        res.locals.authUser._id,
        parse(catalogScheduleSchema, req.body),
        parse(z.string().regex(uuidPattern), req.get('Idempotency-Key')),
      ),
    }),
  );
  router.post('/admin/catalog/run', async (req, res) => {
    const body = parse(
      z.strictObject({
        destinationId: z
          .string()
          .regex(/^[a-f0-9]{24}$/)
          .optional(),
      }),
      req.body ?? {},
    );
    res.json({
      ok: true,
      data: await operations.enqueue(
        res.locals.authUser._id,
        parse(z.string().regex(uuidPattern), req.get('Idempotency-Key')),
        body.destinationId,
      ),
    });
  });
  router.get('/admin/catalog/reviews', async (req, res) =>
    res.json({
      ok: true,
      data: await operations.reviews(
        res.locals.authUser._id,
        parse(
          z.coerce.number().int().min(0).max(100000),
          req.query.offset ?? 0,
        ),
        parse(
          z
            .string()
            .regex(/^[a-f0-9]{24}$/)
            .optional(),
          req.query.destinationId,
        ),
        parse(
          z
            .enum(['draft', 'source', 'duplicate', 'price', 'quality'])
            .optional(),
          req.query.kind,
        ),
        parse(z.string().trim().max(100).default(''), req.query.q),
      ),
    }),
  );
  router.post('/admin/catalog/reviews/:id/decision', async (req, res) =>
    res.json({
      ok: true,
      data: await operations.decide(
        res.locals.authUser._id,
        parse(z.string().regex(/^[a-f0-9]{24}$/), req.params.id),
        parse(reviewDecisionSchema, req.body),
        parse(z.string().regex(uuidPattern), req.get('Idempotency-Key')),
      ),
    }),
  );
  router.post('/admin/catalog/batch-preview', async (req, res) =>
    res.json({
      ok: true,
      data: await operations.batch(
        res.locals.authUser._id,
        parse(catalogBatchSchema, req.body),
      ),
    }),
  );
  router.post('/admin/catalog/batch', async (req, res) =>
    res.json({
      ok: true,
      data: await operations.batch(
        res.locals.authUser._id,
        parse(catalogBatchSchema, req.body),
        parse(z.string().regex(uuidPattern), req.get('Idempotency-Key')),
      ),
    }),
  );
  router.get('/admin/catalog/history', async (req, res) =>
    res.json({
      ok: true,
      data: await operations.history(
        res.locals.authUser._id,
        parse(
          z.coerce.number().int().min(0).max(100000),
          req.query.offset ?? 0,
        ),
      ),
    }),
  );
  router.post('/admin/place-import/preview', async (req, res) =>
    res.json({
      ok: true,
      data: await placeImport.preview(
        res.locals.authUser._id,
        parse(placeImportSearchSchema, req.body),
      ),
    }),
  );
  router.post('/admin/place-import/commit', async (req, res) =>
    res.json({
      ok: true,
      data: await placeImport.commit(
        res.locals.authUser._id,
        parse(placeImportCommitSchema, req.body),
        parse(z.string().regex(uuidPattern), req.get('Idempotency-Key')),
      ),
    }),
  );
  router.get('/admin/places/:id', async (req, res) =>
    res.json({
      ok: true,
      data: await catalog.read(res.locals.authUser._id, String(req.params.id)),
    }),
  );
  for (const method of ['post', 'patch'] as const) {
    router[method](
      method === 'post' ? '/admin/places' : '/admin/places/:id',
      async (req, res) => {
        const body = parse(adminPlaceWriteSchema, req.body);
        const key = parse(
          z.string().regex(uuidPattern),
          req.get('Idempotency-Key'),
        );
        res.status(method === 'post' ? 201 : 200).json({
          ok: true,
          data: await catalog.write(
            res.locals.authUser._id,
            body.place,
            key,
            method === 'patch'
              ? String('id' in req.params ? req.params.id : '')
              : undefined,
            body.expectedRevision,
          ),
        });
      },
    );
  }
  router.use('/me/places', async (req, res, next) => {
    const value = await auth.authenticate(req);
    if (!value)
      throw new HttpError(
        401,
        'AUTH_REQUIRED',
        'Đăng nhập để lưu địa điểm và ghi chú.',
      );
    res.locals.authUser = value.user;
    next();
  });
  router.get('/me/places', async (_req, res) =>
    res.json({ ok: true, data: await explore.saved(res.locals.authUser._id) }),
  );
  router.get('/me/places/:id', async (req, res) =>
    res.json({
      ok: true,
      data: await explore.readState(
        res.locals.authUser._id,
        String(req.params.id),
      ),
    }),
  );
  router.patch('/me/places/:id', async (req, res) =>
    res.json({
      ok: true,
      data: await explore.updateState(
        res.locals.authUser._id,
        String(req.params.id),
        req.body,
      ),
    }),
  );
  router.get('/shared-trip', async (req, res) => {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.json({
      ok: true,
      data: await sharing.read(
        (req.get('Authorization') ?? '').replace(/^Bearer /, ''),
      ),
    });
  });
  router.use('/trips', async (req, res, next) => {
    const value = await auth.authenticate(req);
    if (!value)
      throw new HttpError(
        401,
        'AUTH_REQUIRED',
        'Phiên đã hết hạn hoặc bạn chưa đăng nhập. Đăng nhập lại để lưu; bản đang nhập vẫn được giữ.',
      );
    res.locals.authUser = value.user;
    next();
  });
  router.get('/trips/:id/shares', async (req, res) =>
    res.json({
      ok: true,
      data: await sharing.list(res.locals.authUser._id, String(req.params.id)),
    }),
  );
  router.post('/trips/:id/shares', async (req, res) =>
    res.status(201).json({
      ok: true,
      data: await sharing.create(
        res.locals.authUser._id,
        String(req.params.id),
        parse(shareCreateSchema, req.body),
      ),
    }),
  );
  router.delete('/trips/:id/shares/:shareId', async (req, res) =>
    res.json({
      ok: true,
      data: await sharing.revoke(
        res.locals.authUser._id,
        String(req.params.id),
        String(req.params.shareId),
      ),
    }),
  );
  router.get('/trips/:id/expenses', async (req, res) => {
    const query = parse(expenseQuerySchema, req.query);
    res.json({
      ok: true,
      data: await expenses.list(
        res.locals.authUser._id,
        String(req.params.id),
        query,
      ),
    });
  });
  for (const [method, action, suffix] of [
    ['post', 'created', ''],
    ['patch', 'updated', '/:expenseId'],
    ['delete', 'deleted', '/:expenseId'],
  ] as const) {
    router[method](`/trips/:id/expenses${suffix}`, async (req, res) => {
      const body =
        action === 'created'
          ? parse(expenseCreateSchema, req.body)
          : action === 'updated'
            ? parse(expenseUpdateSchema, req.body)
            : parse(expenseRevisionSchema, req.body);
      const key = parse(
        z.string().regex(uuidPattern),
        req.get('Idempotency-Key'),
      );
      const result = await expenses.write(
        res.locals.authUser._id,
        String(req.params.id),
        action,
        key,
        'expense' in body ? body.expense : undefined,
        action === 'created'
          ? undefined
          : String('expenseId' in req.params ? req.params.expenseId : ''),
        'expectedRevision' in body ? body.expectedRevision : undefined,
      );
      res
        .status(action === 'created' ? 201 : 200)
        .json({ ok: true, data: result });
    });
  }
  router.get('/trips', async (req, res) =>
    res.json({
      ok: true,
      data: await trips.list(
        res.locals.authUser._id,
        parse(tripListQuerySchema, req.query),
      ),
    }),
  );
  router.get('/trips/trash', async (req, res) =>
    res.json({
      ok: true,
      data: await trips.trash(
        res.locals.authUser._id,
        parse(tripTrashQuerySchema, req.query),
      ),
    }),
  );
  router.post('/trips/:id/restore', async (req, res) => {
    const value = parse(tripActionSchema, req.body);
    const key = parse(
      z.string().regex(uuidPattern),
      req.get('Idempotency-Key'),
    );
    res.json({
      ok: true,
      data: await manageTrip(
        res.locals.authUser._id,
        String(req.params.id),
        'restore',
        value.expectedRevision,
        key,
      ),
    });
  });
  router.post('/trips/:id/duplicate', async (req, res) => {
    const value = parse(tripDuplicateSchema, req.body);
    const key = parse(
      z.string().regex(uuidPattern),
      req.get('Idempotency-Key'),
    );
    res.status(201).json({
      ok: true,
      data: await manageTrip(
        res.locals.authUser._id,
        String(req.params.id),
        'duplicate',
        value.expectedRevision,
        key,
        value.startDate,
      ),
    });
  });
  router.delete('/trips/:id', async (req, res) => {
    const value = parse(tripActionSchema, req.body);
    const key = parse(
      z.string().regex(uuidPattern),
      req.get('Idempotency-Key'),
    );
    res.json({
      ok: true,
      data: await manageTrip(
        res.locals.authUser._id,
        String(req.params.id),
        'delete',
        value.expectedRevision,
        key,
      ),
    });
  });
  router.post('/trips/budget-preview', (req, res) => {
    const { trip } = parse(z.strictObject({ trip: tripInputSchema }), req.body);
    res.json({ ok: true, data: { budget: calculateBudget(trip) } });
  });
  router.post('/trips/reschedule-dates', async (req, res) => {
    const value = parse(rescheduleRequestSchema, req.body);
    res.json({
      ok: true,
      data: await planner.reschedule(res.locals.authUser._id, value),
    });
  });
  router.post('/trips/ai-proposal', async (req, res) => {
    const value = parse(plannerRequestSchema, req.body);
    const key = parse(
      z.string().regex(uuidPattern),
      req.get('Idempotency-Key'),
    );
    await planner.reconcile();
    res.json({
      ok: true,
      data: await planner.propose(res.locals.authUser._id, value, key),
    });
  });
  router.get('/trips/:id', async (req, res) =>
    res.json({
      ok: true,
      data: await trips.read(String(req.params.id), res.locals.authUser._id),
    }),
  );
  router.post('/trips/:id/goe-proposal', async (req, res) => {
    const value = parse(goeRequestSchema, req.body);
    const key = parse(
      z.string().regex(uuidPattern),
      req.get('Idempotency-Key'),
    );
    await planner.reconcile();
    res.json({
      ok: true,
      data: await planner.chat(
        res.locals.authUser._id,
        String(req.params.id),
        value,
        key,
      ),
    });
  });
  router.post('/trips/:id/goe-apply', async (req, res) => {
    const value = parse(goeApplySchema, req.body);
    const key = parse(
      z.string().regex(uuidPattern),
      req.get('Idempotency-Key'),
    );
    res.json({
      ok: true,
      data: await planner.apply(
        res.locals.authUser._id,
        String(req.params.id),
        value.runId,
        value.expectedRevision,
        key,
      ),
    });
  });
  const createSchema = z.strictObject({ trip: tripInputSchema });
  const updateSchema = createSchema.extend({
    expectedRevision: z
      .number()
      .int()
      .nonnegative()
      .max(Number.MAX_SAFE_INTEGER),
  });
  router.post('/trips', async (req, res) => {
    const value = parse(createSchema, req.body);
    const key = parse(
      z.string().regex(uuidPattern),
      req.get('Idempotency-Key'),
    );
    res.status(201).json({
      ok: true,
      data: await trips.save(
        res.locals.authUser._id,
        value.trip,
        undefined,
        key,
      ),
    });
  });
  router.patch('/trips/:id', async (req, res) => {
    const value = parse(updateSchema, req.body);
    const key = parse(
      z.string().regex(uuidPattern),
      req.get('Idempotency-Key'),
    );
    res.json({
      ok: true,
      data: await trips.save(
        res.locals.authUser._id,
        value.trip,
        value.expectedRevision,
        key,
        String(req.params.id),
      ),
    });
  });
  return {
    router,
    auth,
    recovery,
    trips,
    explore,
    expenses,
    sharing,
    operations,
    async initialize() {
      ready = false;
      const all = [
        ...Object.values(auth.models),
        ...Object.values(trips.models),
        ...Object.values(explore.models),
        ...Object.values(expenses.models),
        ...Object.values(sharing.models),
        ...Object.values(planner.models),
        ...Object.values(operations.models),
      ];
      for (const model of all) {
        await model.createCollection();
        await model.createIndexes();
      }
      await audit.initialize();
      await planner.reconcile();
      ready = true;
    },
  };
}
