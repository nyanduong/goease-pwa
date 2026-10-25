import { Router } from 'express';
import { z } from 'zod';
import {
  campaignInputSchema,
  campaignListQuerySchema,
  provinceImportSchema,
  campaignControlSchema,
  catalogPolicyInputSchema,
  bulkPreviewSchema,
  adminMapQuerySchema,
} from '@goease/contracts';
import type { adminV3Service } from './admin-v3.js';
import { HttpError } from '../../http-error.js';
const id = z.string().regex(/^[a-f0-9]{24}$/);
const offset = z.coerce.number().int().min(0).max(1000000).default(0);
const key = z.string().uuid();
function parse<T>(schema: z.ZodType<T>, input: unknown) {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new HttpError(
      400,
      'INVALID_INPUT',
      result.error.issues[0]?.message ?? 'Dữ liệu chưa hợp lệ.',
    );
  return result.data;
}
/** Mount after the existing authenticated admin middleware at /admin/v3. */
export function adminV3Router(service: ReturnType<typeof adminV3Service>) {
  const router = Router();
  router.post('/province-imports', async (req, res) =>
    res.status(201).json({
      ok: true,
      data: await service.startProvinceImport(
        res.locals.authUser._id,
        parse(provinceImportSchema, req.body),
        parse(key, req.get('Idempotency-Key')),
      ),
    }),
  );
  router.get('/campaigns', async (req, res) =>
    res.json({
      ok: true,
      data: await service.campaigns(
        res.locals.authUser._id,
        parse(campaignListQuerySchema, req.query),
      ),
    }),
  );
  router.post('/campaigns', async (req, res) =>
    res.status(201).json({
      ok: true,
      data: await service.createCampaign(
        res.locals.authUser._id,
        parse(campaignInputSchema, req.body),
        parse(key, req.get('Idempotency-Key')),
      ),
    }),
  );
  router.get('/campaigns/:id', async (req, res) =>
    res.json({
      ok: true,
      data: await service.campaignDetail(
        res.locals.authUser._id,
        parse(id, req.params.id),
      ),
    }),
  );
  router.post('/campaigns/:id/control', async (req, res) =>
    res.json({
      ok: true,
      data: await service.controlCampaign(
        res.locals.authUser._id,
        parse(id, req.params.id),
        parse(campaignControlSchema, req.body).action,
      ),
    }),
  );
  router.get('/policies', async (_req, res) =>
    res.json({
      ok: true,
      data: await service.policies(res.locals.authUser._id),
    }),
  );
  router.post('/policies', async (req, res) =>
    res.status(201).json({
      ok: true,
      data: await service.createPolicy(
        res.locals.authUser._id,
        parse(catalogPolicyInputSchema, req.body),
        req.get('Idempotency-Key')
          ? parse(key, req.get('Idempotency-Key'))
          : undefined,
      ),
    }),
  );
  router.post('/policies/dry-run', async (req, res) => {
    const body = parse(
      z.strictObject({ policyId: id, destinationId: id, offset }),
      req.body,
    );
    res.json({
      ok: true,
      data: await service.dryRun(
        res.locals.authUser._id,
        body.policyId,
        body.destinationId,
        body.offset,
      ),
    });
  });
  router.post('/bulk/preview', async (req, res) =>
    res.status(201).json({
      ok: true,
      data: await service.previewBulk(
        res.locals.authUser._id,
        parse(bulkPreviewSchema, req.body),
        parse(key, req.get('Idempotency-Key')),
      ),
    }),
  );
  router.get('/bulk/:id', async (req, res) =>
    res.json({
      ok: true,
      data: await service.bulkDetail(
        res.locals.authUser._id,
        parse(id, req.params.id),
        parse(offset, req.query.offset),
      ),
    }),
  );
  router.post('/bulk/:id/execute', async (req, res) => {
    const body = parse(
      z.strictObject({ retryFailed: z.boolean().default(false) }),
      req.body ?? {},
    );
    res.json({
      ok: true,
      data: await service.executeBulk(
        res.locals.authUser._id,
        parse(id, req.params.id),
        body.retryFailed,
      ),
    });
  });
  router.get('/map', async (req, res) =>
    res.json({
      ok: true,
      data: await service.map(
        res.locals.authUser._id,
        parse(adminMapQuerySchema, req.query),
      ),
    }),
  );
  router.get('/sources', async (_req, res) =>
    res.json({
      ok: true,
      data: await service.sources(res.locals.authUser._id),
    }),
  );
  return router;
}
