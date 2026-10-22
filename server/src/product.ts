import { tripManagement } from './features/trips/trip-management.js';
import { expenseService } from './features/expenses/expense.service.js';
import { exploreService } from './features/explore/explore.service.js';
import { Router } from 'express';
import mongoose, { type Connection } from 'mongoose';
import { z } from 'zod';
import {
  tripActionSchema,
  tripDuplicateSchema,
  tripListQuerySchema,
  expenseCreateSchema,
  expenseUpdateSchema,
  expenseRevisionSchema,
  expenseQuerySchema,
  loginSchema,
  registerSchema,
  tripInputSchema,
  plannerRequestSchema,
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
export function createProduct(connection: Connection, config: Config) {
  const audit = businessAudit(connection, config.NODE_ENV);
  const auth = authService(connection, config, audit);
  const trips = tripService(connection, audit);
  const manageTrip = tripManagement(connection, trips, audit);
  const expenses = expenseService(connection, trips, audit);
  const explore = exploreService(connection);
  const planner = plannerService(connection, config, trips, explore);
  const google = googleAuth(connection, config, auth);
  const router = Router();
  let ready = false;
  router.use((req, res, next) => {
    const publicTemplates = [
      '/auth/options',
      '/auth/me',
      '/auth/register',
      '/auth/login',
      '/auth/logout',
      '/auth/google',
      '/auth/google/callback',
      '/destinations',
      '/places',
      '/me/places',
      '/trips',
      '/trips/budget-preview',
      '/trips/ai-proposal',
    ];
    if (publicTemplates.includes(req.path))
      res.locals.logRoute = '/api/v1' + req.path;
    else if (/^\/trips\/[^/]+$/.test(req.path))
      res.locals.logRoute = '/api/v1/trips/:id';
    if (/^\/trips\/[^/]+\/duplicate$/.test(req.path))
      res.locals.logRoute = '/api/v1/trips/:id/duplicate';
    if (/^\/trips\/[^/]+\/expenses$/.test(req.path))
      res.locals.logRoute = '/api/v1/trips/:id/expenses';
    if (/^\/trips\/[^/]+\/expenses\/[^/]+$/.test(req.path))
      res.locals.logRoute = '/api/v1/trips/:id/expenses/:expenseId';
    if (/^\/places\/[^/]+$/.test(req.path))
      res.locals.logRoute = '/api/v1/places/:id';
    if (/^\/me\/places\/[^/]+$/.test(req.path))
      res.locals.logRoute = '/api/v1/me/places/:id';
    if (/^\/trips\/[^/]+\/goe-proposal$/.test(req.path))
      res.locals.logRoute = '/api/v1/trips/:id/goe-proposal';
    if (/^\/trips\/[^/]+\/goe-apply$/.test(req.path))
      res.locals.logRoute = '/api/v1/trips/:id/goe-apply';
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
  router.post('/auth/logout', async (req, res) => {
    await auth.logout(req, res);
    res.json({ ok: true, data: { loggedOut: true } });
  });
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
    trips,
    explore,
    expenses,
    async initialize() {
      ready = false;
      const all = [
        ...Object.values(auth.models),
        ...Object.values(trips.models),
        ...Object.values(explore.models),
        ...Object.values(expenses.models),
        ...Object.values(planner.models),
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
