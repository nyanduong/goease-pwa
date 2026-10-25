import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { z } from 'zod';
import { Types } from 'mongoose';
import {
  catalogToday,
  tourismRegions,
  type AdminDestinationDto,
  type PlannerProposal,
  type TripInput,
  type TripDto,
} from '@goease/contracts';
import { images } from '@goease/media';
import { createProduct } from '../src/product.js';
import { createApp } from '../src/app.js';
import { parseConfig } from '../src/config.js';
import { createLogger } from '../src/observability/logger.js';
import { startTestReplicaSet } from './support/replica-set.js';

test(
  'national destination administration and planner isolate every travel area, preserve quota and save/reload owned proposals',
  { timeout: 90000 },
  async (t) => {
    const harness = await startTestReplicaSet();
    const calls: { destination: string; countryCode: string; ids: string[] }[] =
      [];
    let foreignOutput = false;
    const config = parseConfig({
      NODE_ENV: 'test',
      CLIENT_ORIGIN: 'http://localhost:5180',
      MONGODB_URI: `mongodb://127.0.0.1:27021/${harness.connection.name}?replicaSet=${harness.setName}`,
      AUTH_MAX_ATTEMPTS: '100',
      AI_PROVIDER: 'fulldichvu',
      FULLDICHVU_API_KEY: 'fixture-never-sent',
      AI_DAILY_USER_LIMIT: '100',
      AI_DAILY_GLOBAL_LIMIT: '100',
    });
    const product = createProduct(harness.connection, config, {
      generate: async (raw) => {
        const input = z
          .object({
            destination: z.string(),
            countryCode: z.string(),
            dates: z.array(z.string()),
            selectionOnly: z.boolean(),
            catalog: z.array(
              z.object({
                id: z.string(),
                category: z.string(),
                mealSuitable: z.boolean(),
              }),
            ),
          })
          .parse(raw);
        calls.push({
          destination: input.destination,
          countryCode: input.countryCode,
          ids: input.catalog.map((p) => p.id),
        });
        assert.ok(!JSON.stringify(raw).includes('PRIVATE_TRIP_SENTINEL'));
        if (foreignOutput)
          return {
            placeIds: [
              String(
                (await product.explore.models.Place.findOne({
                  destinationId: targets[1]!.id,
                }))!._id,
              ),
              ...input.catalog.slice(0, 3).map((p) => p.id),
            ],
          };
        if (input.selectionOnly)
          return { placeIds: input.catalog.map((p) => p.id) };
        const visits = input.catalog.filter((p) => p.category !== 'food'),
          meals = input.catalog.filter((p) => p.mealSuitable);
        const ids = [visits[0]!.id, meals[0]!.id, visits[1]!.id, meals[1]!.id];
        return {
          days: input.dates.map((date) => ({
            date,
            stops: ids.map((placeId, i) => ({
              placeId,
              start: ['09:00', '12:00', '14:00', '18:00'][i]!,
              end: ['10:00', '13:00', '15:00', '19:00'][i]!,
            })),
          })),
        };
      },
    });
    try {
      await product.initialize(true);
    } catch (error) {
      await harness.stop();
      throw error;
    }
    const server = createApp(
      config,
      async () => {},
      createLogger('test', () => {}),
      product.router,
    ).listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
    let adminCookie = '';
    const call = (
      path: string,
      method = 'GET',
      body?: unknown,
      key = randomUUID(),
      cookie = adminCookie,
    ) =>
      fetch(base + path, {
        method,
        headers: {
          Origin: config.CLIENT_ORIGIN,
          'X-GoEase-Client': 'web',
          'Content-Type': 'application/json',
          'Idempotency-Key': key,
          Cookie: cookie,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    const read = async <T>(response: Response): Promise<T> => {
      const body = (await response.json()) as {
        data: T;
        error?: { code: string };
      };
      assert.ok(response.ok, JSON.stringify(body.error));
      return body.data;
    };
    const errorCode = async (response: Response, status: number) => {
      assert.equal(response.status, status);
      return ((await response.json()) as { error: { code: string } }).error
        .code;
    };
    const input = (destinationId: string, count = 1): TripInput => ({
      title: 'PRIVATE_TRIP_SENTINEL',
      destinations: [{ destinationId, order: 0 }],
      startDate: '2026-11-12',
      endDate: count === 1 ? '2026-11-12' : '2026-11-13',
      timezone: 'Asia/Ho_Chi_Minh',
      travelers: { totalCount: 2 },
      budget: {
        amountMinor: null,
        currency: 'VND',
        scope: 'group_total',
        includedCategories: [],
      },
      preferences: { interestCodes: [], pace: 'balanced', transportModes: [] },
      generationMode: 'manual',
      notes: 'PRIVATE_TRIP_SENTINEL',
      days: Array.from({ length: count }, (_, i) => ({
        dayId: randomUUID(),
        date: `2026-11-${12 + i}`,
        destinationId,
        activities: [],
      })),
    });
    const targets: AdminDestinationDto[] = [];
    try {
      const registered = await call('/auth/register', 'POST', {
        email: 'national-admin@example.invalid',
        password: 'National-fixture-password-2026',
        displayName: 'Fixture admin',
      });
      adminCookie = registered.headers.get('set-cookie')!.split(';')[0]!;
      const admin = await product.auth.models.User.findOne({
        emailNormalized: 'national-admin@example.invalid',
      });
      assert.ok(admin);
      assert.equal((await call('/admin/destinations')).status, 403);
      await product.auth.models.User.updateOne(
        { _id: admin._id },
        { $set: { roles: ['admin'] } },
      );
      assert.equal(
        (await call('/admin/destinations', 'GET', undefined, randomUUID(), ''))
          .status,
        401,
      );
      await t.test(
        'the fixed province catalog enables one destination per travel region with authorization, revision and retry guards',
        async () => {
          const all = await read<{ items: AdminDestinationDto[] }>(
            await call('/admin/destinations'),
          );
          assert.equal(all.items.length, 34);
          assert.equal(new Set(all.items.map((d) => d.provinceCode)).size, 34);
          assert.ok(all.items.every((d) => d.publicationStatus === 'draft'));
          assert.equal(
            (await read<{ items: unknown[] }>(await call('/destinations')))
              .items.length,
            0,
          );
          const geography = await read<{
            regions: unknown[];
            tourismRegions: unknown[];
          }>(await call('/geography'));
          assert.equal(geography.regions.length, 3);
          assert.equal(geography.tourismRegions.length, 8);
          for (const r of tourismRegions) {
            const item = all.items.find((d) => d.tourismRegion === r.code)!;
            const key = randomUUID();
            const body = { enabled: true, expectedRevision: item.revision };
            const response = await read<{ destination: AdminDestinationDto }>(
              await call(`/admin/destinations/${item.id}`, 'PATCH', body, key),
            );
            targets.push(response.destination);
            assert.equal(response.destination.region, r.region);
            const replay = await read<{ destination: AdminDestinationDto }>(
              await call(`/admin/destinations/${item.id}`, 'PATCH', body, key),
            );
            assert.equal(
              replay.destination.revision,
              response.destination.revision,
            );
            assert.equal(
              await errorCode(
                await call(
                  `/admin/destinations/${item.id}`,
                  'PATCH',
                  { ...body, enabled: false },
                  key,
                ),
                409,
              ),
              'IDEMPOTENCY_CONFLICT',
            );
          }
          assert.equal(
            await product.trips.models.Destination.countDocuments(),
            34,
          );
          assert.equal(
            (
              await read<{ items: unknown[] }>(
                await call('/destinations?region=north'),
              )
            ).items.length,
            3,
          );
          assert.equal(
            (
              await read<{ items: unknown[] }>(
                await call('/destinations?region=central'),
              )
            ).items.length,
            3,
          );
          assert.equal(
            (
              await read<{ items: unknown[] }>(
                await call(
                  '/destinations?region=south&tourismRegion=mekong-delta',
                ),
              )
            ).items.length,
            1,
          );
          assert.equal(
            (
              await call(
                '/destinations?region=north&tourismRegion=mekong-delta',
              )
            ).status,
            400,
          );
          assert.equal(
            (
              await call('/admin/destinations', 'POST', {
                destination: { name: 'Custom' },
              })
            ).status,
            405,
          );
          const first = targets[0]!;
          assert.equal(
            (
              await call(`/admin/destinations/${first.id}`, 'PATCH', {
                enabled: true,
                expectedRevision: first.revision,
                name: 'Changed',
              })
            ).status,
            400,
          );
          const changes = await Promise.all(
            [0, 1].map(() =>
              call(`/admin/destinations/${first.id}`, 'PATCH', {
                enabled: true,
                expectedRevision: first.revision,
              }),
            ),
          );
          assert.deepEqual(changes.map((r) => r.status).sort(), [200, 409]);
          const firstPage = await read<{
            items: AdminDestinationDto[];
            hasMore: boolean;
          }>(await call('/destinations?limit=2'));
          const secondPage = await read<{ items: AdminDestinationDto[] }>(
            await call('/destinations?limit=2&offset=2'),
          );
          assert.ok(firstPage.hasMore);
          assert.ok(
            !secondPage.items.some((d) =>
              firstPage.items.some((f) => f.id === d.id),
            ),
          );
          const alias = await read<{ items: AdminDestinationDto[] }>(
            await call('/admin/destinations?q=hoi%20an'),
          );
          assert.deepEqual(
            alias.items.map((d) => d.provinceCode),
            ['48'],
          );
          const before = await product.trips.models.Destination.find()
            .sort({ _id: 1 })
            .lean();
          await product.initialize(true);
          const after = await product.trips.models.Destination.find()
            .sort({ _id: 1 })
            .lean();
          assert.deepEqual(after, before);
        },
      );
      await t.test(
        'empty and incomplete catalog fail before provider calls and quota reservation',
        async () => {
          const trip = input(targets[0]!.id);
          assert.equal(
            await errorCode(
              await call('/trips/ai-proposal', 'POST', { trip, consent: true }),
              503,
            ),
            'AI_CATALOG_EMPTY',
          );
          assert.equal(calls.length, 0);
          assert.equal(
            await harness.connection
              .collection('usage_buckets')
              .countDocuments(),
            0,
          );
        },
      );
      // Explicit test-only data in the isolated replica set; no real provider or application writes.
      for (const target of targets)
        for (let n = 0; n < 6; n++) {
          const meal = n >= 4;
          await product.explore.models.Place.create({
            destinationId: target.id,
            destinationName: target.name,
            name: meal
              ? `Quán phở fixture ${n}`
              : `Điểm tham quan fixture ${n}`,
            slug: `fixture-${n}`,
            category: meal ? 'food' : 'culture',
            venueType: meal ? 'restaurant' : 'place',
            subtitle: 'Fixture',
            description: 'Synthetic test data',
            searchText: 'fixture',
            imageUrl: images.exploreHoian,
            imageCredit: 'Fixture AI',
            durationLabel: '60 phút',
            travelLabel: 'Ước tính',
            bestTimeLabel: 'Ban ngày',
            tip: 'Fixture',
            highlights: [],
            sourceUrl: 'https://example.invalid/fixture',
            openingHoursNote: '08:00–21:00',
            publicationStatus: 'published',
            planning: {
              durationMinutes: 60,
              locationQuery: `${target.name} fixture address`,
              costNote: 'Fixture',
              priceOptions: [],
            },
            referencePrice: {
              label: 'Fixture',
              amountMinor: 20000,
              maxTravelers: 10,
              basis: 'per_person',
              conditions: 'Fixture',
              inclusions: 'Fixture',
              exclusions: 'Fixture',
              sourceUrl: 'https://example.invalid/price',
              checkedAt: catalogToday(),
              reviewAfter: '2099-12-31',
            },
          });
        }
      await t.test(
        'coverage shortages and a large drinks-only page are handled before quota and selection',
        async () => {
          const destinationId = targets[0]!.id;
          await product.explore.models.Place.updateMany(
            { destinationId, category: 'food' },
            { $set: { publicationStatus: 'draft' } },
          );
          assert.equal(
            await errorCode(
              await call('/trips/ai-proposal', 'POST', {
                trip: input(destinationId),
                consent: true,
              }),
              409,
            ),
            'AI_CATALOG_COVERAGE',
          );
          assert.equal(calls.length, 0);
          assert.equal(
            await harness.connection
              .collection('usage_buckets')
              .countDocuments(),
            0,
          );
          await product.explore.models.Place.updateMany(
            { destinationId, category: 'food' },
            { $set: { publicationStatus: 'published' } },
          );
          const template = (await product.explore.models.Place.findOne({
            destinationId,
            category: 'food',
          }))!.toObject();
          await product.explore.models.Place.insertMany(
            Array.from({ length: 31 }, (_, n) => ({
              ...template,
              _id: new Types.ObjectId(
                (1000 + n).toString(16).padStart(24, '0'),
              ),
              name: `Coffee fixture ${n}`,
              description: 'Drinks-only fixture',
            })),
          );
        },
      );
      await t.test(
        'generation works independently in every area, using only its published catalog and resolved destination name',
        async () => {
          for (const target of targets) {
            const trip = input(target.id),
              key = randomUUID();
            const proposal = await read<PlannerProposal>(
              await call(
                '/trips/ai-proposal',
                'POST',
                { trip, consent: true },
                key,
              ),
            );
            assert.ok(proposal.trip.days[0]!.activities.length >= 4);
            const ownIds = (
              await product.explore.models.Place.find({
                destinationId: target.id,
              })
            ).map((p) => String(p._id));
            assert.ok(
              proposal.trip.days
                .flatMap((d) => d.activities)
                .every((a) => ownIds.includes(a.placeId!)),
            );
            assert.equal(calls.at(-1)!.destination, target.name);
            assert.equal(calls.at(-1)!.countryCode, 'VN');
            const count = calls.length;
            const replay = await read<PlannerProposal>(
              await call(
                '/trips/ai-proposal',
                'POST',
                { trip, consent: true },
                key,
              ),
            );
            assert.equal(replay.runId, proposal.runId);
            assert.equal(calls.length, count);
          }
          const west = await read<{ items: { destinationId: string }[] }>(
            await call(
              '/places?region=south&tourismRegion=mekong-delta&limit=30',
            ),
          );
          assert.equal(west.items.length, 6);
          assert.ok(
            west.items.every((p) => p.destinationId === targets.at(-1)!.id),
          );
          assert.equal(
            (await call('/places?region=north&tourismRegion=mekong-delta'))
              .status,
            400,
          );
        },
      );
      await t.test(
        'a non-Hoi-An trip saves, reloads, adjusts one owned day, applies and reschedules without losing other days',
        async () => {
          const trip = input(targets.at(-1)!.id, 2);
          const proposal = await read<PlannerProposal>(
            await call('/trips/ai-proposal', 'POST', { trip, consent: true }),
          );
          const saved = await read<{ trip: TripDto }>(
            await call('/trips', 'POST', { trip: proposal.trip }),
          );
          const stored = (
            await read<{ trip: TripDto }>(await call(`/trips/${saved.trip.id}`))
          ).trip;
          assert.equal(
            stored.destinations[0]!.destinationId,
            trip.destinations[0]!.destinationId,
          );
          const adjust = await read<PlannerProposal>(
            await call(`/trips/${stored.id}/goe-proposal`, 'POST', {
              dayId: stored.days[0]!.dayId,
              message: 'Giữ nhịp đi vừa phải',
              expectedRevision: stored.revision,
              consent: true,
            }),
          );
          assert.deepEqual(adjust.trip.days[1], proposal.trip.days[1]);
          const applied = await read<{ trip: TripDto }>(
            await call(`/trips/${stored.id}/goe-apply`, 'POST', {
              runId: adjust.runId,
              expectedRevision: stored.revision,
            }),
          );
          assert.ok(applied.trip.revision > stored.revision);
          const stranger = await call('/auth/register', 'POST', {
            email: 'national-stranger@example.invalid',
            password: 'National-fixture-password-2026',
            displayName: 'Fixture stranger',
          });
          const cookie = stranger.headers.get('set-cookie')!.split(';')[0]!;
          assert.equal(
            (
              await call(
                `/trips/${stored.id}/goe-apply`,
                'POST',
                { runId: adjust.runId, expectedRevision: stored.revision },
                randomUUID(),
                cookie,
              )
            ).status,
            409,
          );
          const manual = structuredClone(proposal.trip);
          manual.generationMode = 'manual';
          delete manual.aiRunId;
          manual.days.forEach((d) =>
            d.activities.forEach((a) => {
              a.source = 'manual';
            }),
          );
          const shifted = await read<{ trip: TripInput }>(
            await call('/trips/reschedule-dates', 'POST', {
              trip: manual,
              startDate: '2026-11-14',
              endDate: '2026-11-15',
            }),
          );
          assert.equal(
            shifted.trip.days[0]!.destinationId,
            manual.destinations[0]!.destinationId,
          );
        },
      );
      await t.test(
        'unknown/archived destinations and provider IDs from another catalog fail safely',
        async () => {
          assert.equal(
            await errorCode(
              await call('/trips/ai-proposal', 'POST', {
                trip: input('ffffffffffffffffffffffff'),
                consent: true,
              }),
              400,
            ),
            'INVALID_DESTINATION',
          );
          foreignOutput = true;
          assert.equal(
            await errorCode(
              await call('/trips/ai-proposal', 'POST', {
                trip: input(targets[0]!.id),
                consent: true,
              }),
              502,
            ),
            'AI_UNKNOWN_SELECTION',
          );
          foreignOutput = false;
          const current = (await product.trips.models.Destination.findById(
            targets[0]!.id,
          ))!;
          const tripBefore = await product.trips.models.Trip.find({
            'destinations.destinationId': current._id,
          }).lean();
          const placesBefore = await product.explore.models.Place.find({
            destinationId: current._id,
          }).lean();
          assert.equal(
            (
              await call(`/admin/destinations/${current._id}`, 'PATCH', {
                enabled: false,
                expectedRevision: current.revision,
              })
            ).status,
            200,
          );
          assert.deepEqual(
            await product.trips.models.Trip.find({
              'destinations.destinationId': current._id,
            }).lean(),
            tripBefore,
          );
          assert.deepEqual(
            await product.explore.models.Place.find({
              destinationId: current._id,
            }).lean(),
            placesBefore,
          );
          const hiddenPlace = await product.explore.models.Place.findOne({
            destinationId: targets[0]!.id,
          });
          assert.equal((await call(`/places/${hiddenPlace!._id}`)).status, 404);
          assert.equal(
            (
              await read<{ items: unknown[] }>(
                await call(`/places?destinationId=${targets[0]!.id}`),
              )
            ).items.length,
            0,
          );
          assert.equal(
            await errorCode(
              await call('/trips/ai-proposal', 'POST', {
                trip: input(targets[0]!.id),
                consent: true,
              }),
              400,
            ),
            'INVALID_DESTINATION',
          );
        },
      );
      await t.test(
        'destination audit failure rolls back toggle and idempotency receipt',
        async () => {
          const Audit = harness.connection.models.AuditLog!;
          const stub = t.mock.method(Audit.prototype, 'save', async () => {
            throw new Error('Injected audit failure');
          });
          const key = randomUUID();
          const current = (await product.trips.models.Destination.findById(
            targets[0]!.id,
          ))!;
          const response = await call(
            `/admin/destinations/${current._id}`,
            'PATCH',
            { enabled: true, expectedRevision: current.revision },
            key,
          );
          stub.mock.restore();
          assert.equal(response.status, 500);
          const unchanged = (await product.trips.models.Destination.findById(
            current._id,
          ))!;
          assert.equal(unchanged.revision, current.revision);
          assert.equal(unchanged.publicationStatus, current.publicationStatus);
          assert.equal(
            await product.trips.models.Key.countDocuments({ key }),
            0,
          );
        },
      );
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await harness.stop();
    }
  },
);
