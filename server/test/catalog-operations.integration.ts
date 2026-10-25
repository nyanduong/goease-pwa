import { fixturePhoto } from './support/photo.js';
import {
  configureFixtureScope,
  fixtureDestinationId,
} from './support/catalog-scope.js';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';
import mongoose from 'mongoose';
import type { AdminPlaceDto, CatalogReviewDto } from '@goease/contracts';
import { createProduct } from '../src/product.js';
import { createApp } from '../src/app.js';
import { parseConfig } from '../src/config.js';
import { createLogger } from '../src/observability/logger.js';
import { seedDestinations } from '../src/features/trips/destination-seed.js';
import { startTestReplicaSet } from './support/replica-set.js';
import { HttpError } from '../src/http-error.js';
import { nextCatalogRun } from '../src/features/explore/catalog-operations.js';
import type { GeoapifyCandidate } from '../src/features/explore/geoapify.js';

test(
  'catalog automation: durable runs, fencing, review decisions, batch receipts and authorization',
  { timeout: 120000 },
  async (t) => {
    const harness = await startTestReplicaSet();
    const uri = `mongodb://127.0.0.1:27021/${harness.connection.name}?replicaSet=${harness.setName}`;
    const config = parseConfig({
      NODE_ENV: 'test',
      CLIENT_ORIGIN: 'http://localhost:5180',
      MONGODB_URI: uri,
      AUTH_MAX_ATTEMPTS: '100',
    });
    const candidate = (
      id: number,
      name: string,
      latitude: number,
    ): GeoapifyCandidate => ({
      externalId: `osm:node:${id}`,
      name,
      address: `Địa chỉ fixture ${id}, Hội An`,
      longitude: 108.328,
      latitude,
      category: 'food',
      venueType: 'restaurant',
      categories: ['catering.restaurant'],
      sourceUrl: `https://www.openstreetmap.org/node/${id}`,
      openingHoursNote: '',
      flags: [],
    });
    let source = [
      candidate(901, 'Quán kiểm thử A', 15.88),
      candidate(902, 'Quán kiểm thử B', 15.89),
      candidate(903, 'Quán kiểm thử B', 15.89001),
    ];
    let failure: HttpError | undefined;
    let beforeFetch: (() => Promise<void>) | undefined;
    let calls = 0;
    const provider = async (group: 'sights' | 'restaurant' | 'cafe') => {
      calls++;
      await beforeFetch?.();
      if (failure) throw failure;
      return { group, received: source.length, rejected: 0, items: source };
    };
    const product = createProduct(harness.connection, config, {
      geoapify: provider,
    });
    await product.initialize();
    await seedDestinations(product.trips.models.Destination);
    await configureFixtureScope(harness.connection);
    const app = createApp(
      config,
      async () => {},
      createLogger('test', () => {}),
      product.router,
    );
    const server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
    const call = (
      path: string,
      method = 'GET',
      body?: unknown,
      cookie = '',
      key = randomUUID(),
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
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    const read = async <T>(r: Response): Promise<T> => {
      const v = (await r.json()) as { data: T };
      assert.ok(r.ok, JSON.stringify(v));
      return v.data;
    };
    const otherConnection = await mongoose
      .createConnection(uri, { autoIndex: false, autoCreate: false })
      .asPromise();
    const other = createProduct(otherConnection, config, {
      geoapify: provider,
    });
    const { Schedule, Run, Review } = product.operations.models;
    const { Place } = product.explore.models;
    t.beforeEach(async () => {
      await Schedule.updateOne(
        { scope: 'provider-quota' },
        {
          $set: {
            quotaHour: Math.floor(Date.now() / 3600000),
            searches: 0,
            actorSearches: [],
            slots: [],
          },
        },
      );
    });
    try {
      await other.initialize();
      const register = async (email: string) => {
        const r = await call('/auth/register', 'POST', {
          email,
          password: 'Only-fixture-2026!',
          displayName: 'Kiểm thử vận hành',
        });
        assert.equal(r.status, 201);
        return r.headers.get('set-cookie')!.split(';')[0]!;
      };
      const cookie = await register('operations@example.invalid');
      const customer = await register('customer@example.invalid');
      const actor = (await product.auth.models.User.findOne({
        emailNormalized: 'operations@example.invalid',
      }))!._id;
      await product.auth.models.User.updateOne(
        { _id: actor },
        { $set: { roles: ['traveler', 'admin'] } },
      );
      const work = () => product.operations.reviews(actor);
      const run = async () => {
        await product.operations.enqueue(
          actor,
          randomUUID(),
          fixtureDestinationId,
        );
        await product.operations.tick();
      };
      const decision = (
        r: CatalogReviewDto,
        value: 'keep' | 'apply' | 'distinct' | 'ignore' | 'later',
        key = randomUUID(),
      ) =>
        product.operations.decide(
          actor,
          r.id,
          {
            expectedRevision: r.revision,
            expectedPlaceRevision: r.place.revision,
            decision: value,
            ...(value === 'later'
              ? { revisitAt: new Date(Date.now() + 86400000).toISOString() }
              : {}),
          },
          key,
        );

      await t.test(
        'all new routes reject customers; schedule disabled by default and Vietnam next-run calculation',
        async () => {
          for (const path of [
            '/admin/catalog/operations',
            '/admin/catalog/reviews',
            '/admin/catalog/history',
          ])
            assert.equal(
              (await call(path, 'GET', undefined, customer)).status,
              403,
            );
          assert.equal(
            (await call('/admin/catalog/run', 'POST', {}, customer)).status,
            403,
          );
          assert.equal(
            (await product.operations.status(actor, fixtureDestinationId))
              .schedule.enabled,
            false,
          );
          assert.equal(
            nextCatalogRun(
              { frequency: 'daily', weekday: 1, hour: 8, minute: 0 },
              new Date('2026-10-23T02:00:00Z'),
            ).toISOString(),
            '2026-10-24T01:00:00.000Z',
          );
          assert.equal(
            nextCatalogRun(
              { frequency: 'weekly', weekday: 1, hour: 8, minute: 0 },
              new Date('2026-10-23T02:00:00Z'),
            ).toISOString(),
            '2026-10-26T01:00:00.000Z',
          );
          await product.operations.tick();
          assert.equal(calls, 0);
          const schedule = {
            destinationId: fixtureDestinationId,
            enabled: true,
            frequency: 'weekly' as const,
            hour: 8,
            minute: 0,
            weekday: 1,
            group: 'restaurant' as const,
            expectedRevision: 0,
          };
          const key = randomUUID();
          await Promise.all([
            product.operations.saveSchedule(actor, schedule, key),
            product.operations.saveSchedule(actor, schedule, key),
          ]);
          assert.equal(
            (await other.operations.status(actor, fixtureDestinationId))
              .schedule.revision,
            1,
          );
          assert.equal(
            await harness.connection
              .collection('audit_logs')
              .countDocuments({ action: 'catalog.schedule_saved' }),
            1,
          );
        },
      );
      await t.test(
        'two independent workers claim one run; repeated sync creates no duplicate places/audits/tasks',
        async () => {
          const key = randomUUID();
          const [a, b] = await Promise.all([
            product.operations.enqueue(actor, key, fixtureDestinationId),
            other.operations.enqueue(actor, key, fixtureDestinationId),
          ]);
          assert.equal(a.runId, b.runId);
          await Promise.all([
            product.operations.tick(),
            other.operations.tick(),
          ]);
          assert.equal(calls, 1);
          assert.equal(await Place.countDocuments(), 3);
          assert.equal(
            await harness.connection
              .collection('audit_logs')
              .countDocuments({ action: 'catalog.imported' }),
            3,
          );
          assert.equal((await Run.findById(a.runId))!.state, 'succeeded');
          await run();
          await work();
          const count = await Review.countDocuments();
          await work();
          assert.equal(await Review.countDocuments(), count);
          assert.equal(
            await Place.countDocuments({
              publicationStatus: 'draft',
              referencePrice: null,
            }),
            3,
          );
          assert.equal(
            (await call(`/places/${(await Place.findOne())!._id}`)).status,
            404,
          );
          assert.equal(
            (await Run.findOne().sort({ createdAt: -1 }))!.counts!.unchanged,
            3,
          );
        },
      );
      await t.test(
        'source change preserves hand edits, keeps one open review, and same-key decision audits once',
        async () => {
          const place = (await Place.findOne({
            'source.externalId': 'osm:node:901',
          }))!;
          const current = (
            await read<{ place: AdminPlaceDto }>(
              await call(
                `/admin/places/${place._id}`,
                'GET',
                undefined,
                cookie,
              ),
            )
          ).place;
          const {
            id,
            revision,
            updatedAt,
            source: provenance,
            imageUrl,
            imageCredit,
            proposalRevision,
            publicRevision,
            fieldProvenance,
            capabilities,
            photoSearch,
            ...input
          } = current;
          void proposalRevision;
          void publicRevision;
          void fieldProvenance;
          void capabilities;
          void photoSearch;
          void updatedAt;
          void provenance;
          void imageUrl;
          void imageCredit;
          await read(
            await call(
              `/admin/places/${id}`,
              'PATCH',
              {
                place: {
                  ...input,
                  name: 'Tên đã biên tập',
                  referencePrice: {
                    label: 'Vé fixture',
                    amountMinor: 20000,
                    basis: 'per_person',
                    maxTravelers: 10,
                    conditions: 'Kiểm thử',
                    inclusions: 'Vào cửa',
                    exclusions: 'Không có',
                    sourceUrl: 'https://example.invalid/price',
                    checkedAt: '2020-01-01',
                    reviewAfter: '2099-12-31',
                  },
                  publicationStatus: 'published',
                  images: [fixturePhoto],
                },
                expectedRevision: revision,
                intent: 'publish',
              },
              cookie,
            ),
          );
          source = source.map((p) =>
            p.externalId === 'osm:node:901'
              ? { ...p, address: 'Địa chỉ nguồn mới fixture' }
              : p,
          );
          await run();
          await run();
          const rows = (await work()).items.filter(
            (r) => r.kind === 'source' && r.place.id === id,
          );
          assert.equal(rows.length, 1);
          const observed = await harness.connection
            .collection('audit_logs')
            .findOne({ action: 'catalog.source_changed', entityId: id });
          assert.ok(observed);
          assert.ok(
            await harness.connection.collection('audit_logs').findOne({
              action: 'catalog.run_succeeded',
              operationId: observed.operationId,
            }),
          );
          assert.equal(rows[0]!.place.name, 'Tên đã biên tập');
          assert.equal(rows[0]!.place.publicationStatus, 'published');
          const key = randomUUID();
          await decision(rows[0]!, 'keep', key);
          await decision(rows[0]!, 'keep', key);
          assert.equal(
            await harness.connection
              .collection('audit_logs')
              .countDocuments({ action: 'catalog.review_keep' }),
            1,
          );
          await run();
          assert.equal(
            (await work()).items.some(
              (r) => r.kind === 'source' && r.place.id === id,
            ),
            false,
          );
          source = source.map((p) =>
            p.externalId === 'osm:node:901'
              ? { ...p, address: 'Địa chỉ thay đổi lần hai fixture' }
              : p,
          );
          await run();
          const review = (await work()).items.find(
            (r) => r.kind === 'source' && r.place.id === id,
          )!;
          await decision(review, 'apply');
          const edited = (await Place.findById(id))!;
          assert.equal(edited.name, 'Tên đã biên tập');
          assert.notEqual(
            edited.planning!.locationQuery,
            'Địa chỉ thay đổi lần hai fixture',
          );
          const proposal = await harness.connection
            .collection('catalog_versions')
            .findOne({
              placeId: edited._id,
              revision: edited.proposalRevision,
            });
          assert.equal(
            proposal!.snapshot.planning.locationQuery,
            'Địa chỉ thay đổi lần hai fixture',
          );
          assert.equal(edited.publicationStatus, 'published');
        },
      );
      await t.test(
        'duplicates block publication, defer hides until due, stale selections remain blocked after distinct; partial batch replay stable',
        async () => {
          const rows = (await work()).items.filter(
            (r) => r.kind === 'duplicate',
          );
          assert.equal(rows.length, 2);
          await decision(rows[0]!, 'later');
          assert.equal(
            (await work()).items.some((r) => r.id === rows[0]!.id),
            false,
          );
          await Review.updateOne(
            { _id: rows[0]!.id },
            { $set: { revisitAt: new Date(0) } },
          );
          const reopened = (await work()).items.find(
            (r) => r.id === rows[0]!.id,
          )!;
          assert.ok(reopened);
          const selected = rows.map((r) => ({
            id: r.place.id,
            expectedRevision: r.place.revision,
          }));
          assert.equal(
            (
              await product.operations.batch(actor, {
                items: selected,
                status: 'published',
              })
            ).items.every((p) => !p.eligible),
            true,
          );
          await decision(reopened, 'distinct');
          const currentSecond = (await work()).items.find(
            (r) => r.id === rows[1]!.id,
          )!;
          await decision(currentSecond, 'distinct');
          const blockedPrice = await product.operations.batch(actor, {
            items: selected.map((item) => ({
              ...item,
              expectedRevision: rows.find((r) => r.place.id === item.id)!.place
                .revision,
            })),
            status: 'published',
          });
          assert.ok(blockedPrice.items.every((item) => !item.eligible));
          await Place.updateMany(
            { _id: { $in: selected.map((item) => item.id) } },
            { $set: { images: [fixturePhoto] } },
          );
          await Place.updateOne(
            { _id: selected[0]!.id },
            {
              $set: {
                referencePrice: {
                  label: 'Vé fixture',
                  amountMinor: 20000,
                  basis: 'per_person',
                  maxTravelers: 10,
                  conditions: 'Kiểm thử',
                  inclusions: 'Vào cửa',
                  exclusions: 'Không có',
                  sourceUrl: 'https://example.invalid/price',
                  checkedAt: '2020-01-01',
                  reviewAfter: '2099-12-31',
                },
              },
            },
          );
          for (const item of selected)
            item.expectedRevision = (await Place.findById(item.id))!.revision;
          await Place.updateOne(
            { _id: selected[1]!.id },
            { $inc: { revision: 1 } },
          );
          const key = randomUUID();
          const input = { items: selected, status: 'published' as const };
          const result = await product.operations.batch(actor, input, key);
          assert.equal(result.items[0]!.applied, true);
          assert.equal(result.items[1]!.applied, false);
          assert.match(result.items[1]!.reason, /sửa ở nơi khác/);
          assert.deepEqual(
            await product.operations.batch(actor, input, key),
            result,
          );
          assert.equal((await call(`/places/${selected[0]!.id}`)).status, 200);
          assert.equal((await call(`/places/${selected[1]!.id}`)).status, 404);
          const conflictRow = (await work()).items.find(
            (r) => r.place.id === selected[1]!.id,
          )!;
          await Place.updateOne(
            { _id: conflictRow.place.id },
            { $inc: { revision: 1 } },
          );
          await assert.rejects(
            decision(conflictRow, 'ignore'),
            (e: unknown) =>
              e instanceof HttpError && e.code === 'CATALOG_CONFLICT',
          );
        },
      );
      await t.test(
        'restart resumes expired work and pause prevents new automatic runs',
        async () => {
          await Schedule.updateOne(
            { scope: 'hoi-an' },
            {
              $set: {
                enabled: false,
                nextRunAt: new Date(0),
                searches: 0,
                actorSearches: [],
              },
            },
          );
          const before = await Run.countDocuments();
          await other.operations.tick();
          assert.equal(await Run.countDocuments(), before);
          const queued = await product.operations.enqueue(
            actor,
            randomUUID(),
            fixtureDestinationId,
          );
          await Run.updateOne(
            { _id: queued.runId },
            {
              $set: {
                state: 'running',
                leaseToken: 'dead-worker',
                leaseUntil: new Date(0),
                attempts: 1,
              },
            },
          );
          await other.operations.tick();
          assert.equal((await Run.findById(queued.runId))!.state, 'succeeded');
          assert.equal((await Run.findById(queued.runId))!.attempts, 2);
        },
      );
      await t.test(
        'worker that loses its fence cannot commit; successor commits once',
        async () => {
          source = [candidate(904, 'Chỉ worker mới được ghi', 15.9)];
          const queued = await product.operations.enqueue(
            actor,
            randomUUID(),
            fixtureDestinationId,
          );
          beforeFetch = async () => {
            beforeFetch = undefined;
            await Run.updateOne(
              { _id: queued.runId },
              { $set: { leaseToken: 'replacement', leaseUntil: new Date(0) } },
            );
          };
          await product.operations.tick();
          assert.equal(
            await Place.countDocuments({ 'source.externalId': 'osm:node:904' }),
            0,
          );
          await other.operations.tick();
          assert.equal(
            await Place.countDocuments({ 'source.externalId': 'osm:node:904' }),
            1,
          );
        },
      );
      await t.test(
        '429/timeouts retry finitely and quota persists across workers',
        async () => {
          await Schedule.updateOne(
            { scope: 'provider-quota' },
            { $set: { searches: 0, actorSearches: [] } },
          );
          failure = new HttpError(429, 'GEOAPIFY_REJECTED', 'Fixture 429');
          const queued = await product.operations.enqueue(
            actor,
            randomUUID(),
            fixtureDestinationId,
          );
          await product.operations.tick();
          const retry = (await Run.findById(queued.runId))!;
          assert.equal(retry.state, 'retry');
          assert.ok(retry.nextAttemptAt.getTime() > Date.now());
          assert.equal(
            (await product.operations.status(actor, fixtureDestinationId))
              .runs[0]!.counts.errors,
            0,
          );
          failure = new HttpError(
            502,
            'GEOAPIFY_UNAVAILABLE',
            'Fixture timeout',
          );
          await Run.updateOne(
            { _id: queued.runId },
            { $set: { nextAttemptAt: new Date(0) } },
          );
          await other.operations.tick();
          await Run.updateOne(
            { _id: queued.runId },
            { $set: { nextAttemptAt: new Date(0) } },
          );
          await product.operations.tick();
          assert.equal((await Run.findById(queued.runId))!.state, 'failed');
          assert.equal((await Run.findById(queued.runId))!.attempts, 3);
          failure = undefined;
          await Schedule.updateOne(
            { scope: 'provider-quota' },
            {
              $set: {
                quotaHour: Math.floor(Date.now() / 3600000),
                searches: 20,
              },
            },
          );
          await assert.rejects(
            other.operations.reserveSearch('new-actor'),
            (e: unknown) =>
              e instanceof HttpError && e.code === 'IMPORT_SEARCH_LIMIT',
          );
          await Schedule.updateOne(
            { scope: 'provider-quota' },
            { $set: { searches: 0, actorSearches: [], slots: [] } },
          );
          const a = await product.operations.reserveSearch('actor-a');
          const b = await other.operations.reserveSearch('actor-b');
          await assert.rejects(product.operations.reserveSearch('actor-c'));
          await a();
          await b();
        },
      );
      await t.test(
        'failure midway through fetching and audit failure roll back all domain writes; missed search is not closure',
        async () => {
          await Schedule.updateOne(
            { scope: 'hoi-an' },
            { $set: { group: 'mixed', searches: 0, actorSearches: [] } },
          );
          source = [candidate(905, 'Không được nhập nửa lượt', 15.9)];
          let requests = 0;
          beforeFetch = async () => {
            if (++requests === 2)
              throw new HttpError(
                502,
                'GEOAPIFY_UNAVAILABLE',
                'Fixture second query timeout',
              );
          };
          const queued = await product.operations.enqueue(
            actor,
            randomUUID(),
            fixtureDestinationId,
          );
          await product.operations.tick();
          beforeFetch = undefined;
          assert.equal(
            await Place.countDocuments({ 'source.externalId': 'osm:node:905' }),
            0,
          );
          assert.equal((await Run.findById(queued.runId))!.state, 'retry');
          await harness.connection.db!.command({
            collMod: 'audit_logs',
            validator: { action: { $ne: 'catalog.imported' } },
            validationLevel: 'strict',
            validationAction: 'error',
          });
          try {
            await Run.updateOne(
              { _id: queued.runId },
              { $set: { nextAttemptAt: new Date(0) } },
            );
            await product.operations.tick();
            assert.equal(
              await Place.countDocuments({
                'source.externalId': 'osm:node:905',
              }),
              0,
            );
          } finally {
            await harness.connection.db!.command({
              collMod: 'audit_logs',
              validator: {},
            });
          }
          await Run.updateOne(
            { _id: queued.runId },
            { $set: { nextAttemptAt: new Date(0) } },
          );
          await other.operations.tick();
          assert.equal(
            await Place.countDocuments({ 'source.externalId': 'osm:node:905' }),
            1,
          );
          const p = (await Place.findOne({
            'source.externalId': 'osm:node:905',
          }))!;
          assert.equal(
            await harness.connection.collection('audit_logs').countDocuments({
              action: 'catalog.imported',
              entityId: String(p._id),
            }),
            1,
          );
          const before = await Place.countDocuments({
            publicationStatus: 'published',
            images: [fixturePhoto],
          });
          source = [];
          await run();
          assert.equal(
            await Place.countDocuments({ publicationStatus: 'published' }),
            before,
          );
        },
      );
      await t.test(
        'separate OS workers exclude each other; killed worker is recovered by a new process with saved schedule intact',
        async () => {
          await Schedule.updateOne(
            { scope: 'hoi-an' },
            {
              $set: {
                enabled: true,
                nextRunAt: new Date('2099-01-01'),
                searches: 0,
                actorSearches: [],
                slots: [],
              },
            },
          );
          const queued = await product.operations.enqueue(
            actor,
            randomUUID(),
            fixtureDestinationId,
          );
          const spawnWorker = (hold: boolean) =>
            fork(
              fileURLToPath(
                new URL('./support/catalog-worker-process.ts', import.meta.url),
              ),
              [],
              {
                execArgv: ['--import', 'tsx'],
                stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
                windowsHide: true,
                env: {
                  ...process.env,
                  CATALOG_WORKER_TEST_URI: uri,
                  CATALOG_WORKER_TEST_HOLD: hold ? 'yes' : 'no',
                },
              },
            );
          const first = spawnWorker(true);
          try {
            assert.deepEqual(await once(first, 'message'), [
              'fetching',
              undefined,
            ]);
            const second = spawnWorker(false);
            assert.equal((await once(second, 'exit'))[0], 0);
            assert.equal(
              await Place.countDocuments({
                'source.externalId': 'osm:node:906',
              }),
              0,
            );
            const exited = once(first, 'exit');
            first.kill();
            await exited;
            assert.equal((await Schedule.findOne())!.enabled, true);
            assert.equal((await Run.findById(queued.runId))!.state, 'running');
            // Advance only this test run's persisted clock instead of waiting 120 seconds.
            await Run.updateOne(
              { _id: queued.runId },
              { $set: { leaseUntil: new Date(0) } },
            );
            const replacement = spawnWorker(false);
            assert.equal((await once(replacement, 'exit'))[0], 0);
            assert.equal(
              (await Run.findById(queued.runId))!.state,
              'succeeded',
            );
            assert.equal(
              await Place.countDocuments({
                'source.externalId': 'osm:node:906',
              }),
              1,
            );
            const p = (await Place.findOne({
              'source.externalId': 'osm:node:906',
            }))!;
            assert.equal(
              await harness.connection.collection('audit_logs').countDocuments({
                action: 'catalog.imported',
                entityId: String(p._id),
              }),
              1,
            );
          } finally {
            if (first.exitCode === null && first.signalCode === null)
              first.kill();
          }
        },
      );
      await t.test(
        'missing key is actionable and does not report a successful run',
        async () => {
          const noKeyConnection = await mongoose
            .createConnection(uri, { autoIndex: false, autoCreate: false })
            .asPromise();
          try {
            const noKey = createProduct(noKeyConnection, config);
            assert.equal(
              (await noKey.operations.status(actor, fixtureDestinationId))
                .connected,
              false,
            );
            await assert.rejects(
              noKey.operations.enqueue(
                actor,
                randomUUID(),
                fixtureDestinationId,
              ),
              (e: unknown) =>
                e instanceof HttpError && e.code === 'GEOAPIFY_NOT_CONFIGURED',
            );
            await Schedule.updateOne(
              {},
              { $set: { enabled: true, nextRunAt: new Date(0) } },
            );
            await noKey.operations.tick();
            assert.equal(
              (await Run.findOne().sort({ createdAt: -1 }))!.state,
              'failed',
            );
            assert.match(
              (await Run.findOne().sort({ createdAt: -1 }))!.message,
              /Chưa kết nối/,
            );
          } finally {
            await noKeyConnection.close();
          }
        },
      );
    } finally {
      await product.operations.stop();
      await other.operations.stop();
      server.close();
      await otherConnection.close();
      await harness.stop();
    }
  },
);
