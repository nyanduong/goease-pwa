import { Router } from 'express';
import mongoose, { type Connection } from 'mongoose';
import { z } from 'zod';
import {
  loginSchema,
  registerSchema,
  tripInputSchema,
} from '@goease/contracts';
import type { Config } from './config.js';
import { authService, userDto } from './features/auth/auth.service.js';
import { googleAuth } from './features/auth/google.js';
import { tripService } from './features/trips/trip.service.js';
import { businessAudit } from './features/audit/business-audit.js';
import { HttpError } from './http-error.js';
import { uuidPattern } from './observability/context.js';

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
      '/trips',
    ];
    if (publicTemplates.includes(req.path))
      res.locals.logRoute = '/api/v1' + req.path;
    else if (/^\/trips\/[^/]+$/.test(req.path))
      res.locals.logRoute = '/api/v1/trips/:id';
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
  router.get('/trips', async (_req, res) =>
    res.json({ ok: true, data: await trips.list(res.locals.authUser._id) }),
  );
  router.get('/trips/:id', async (req, res) =>
    res.json({
      ok: true,
      data: await trips.read(String(req.params.id), res.locals.authUser._id),
    }),
  );
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
    async initialize() {
      ready = false;
      const all = [
        ...Object.values(auth.models),
        ...Object.values(trips.models),
      ];
      for (const model of all) {
        await model.createCollection();
        await model.createIndexes();
      }
      await audit.initialize();
      ready = true;
    },
  };
}
