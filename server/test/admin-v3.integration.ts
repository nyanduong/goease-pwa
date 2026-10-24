import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { test } from 'node:test';
import { Types } from 'mongoose';
import {
  adminPlaceQuerySchema,
  adminMapQuerySchema,
  type BulkPreviewInput,
} from '@goease/contracts';
import { createProduct } from '../src/product.js';
import { parseConfig } from '../src/config.js';
import { seedDestinations } from '../src/features/trips/destination-seed.js';
import { adminOperationsModels } from '../src/features/explore/admin-operations.models.js';
import type { GeoapifyCandidate } from '../src/features/explore/geoapify.js';
import { HttpError } from '../src/http-error.js';
import { startTestReplicaSet } from './support/replica-set.js';

test(
  'Admin V3 snapshots, worker fencing, resumable frozen bulk and 13200 server query/map/queue',
  // Full 13,200-item completion intentionally uses real bounded transactions.
  { timeout: 900000 },
  async (t) => {
    const harness = await startTestReplicaSet();
    const { connection } = harness;
    const destinationId = '000000000000000000000004';
    let beforeFetch: (() => Promise<void>) | undefined;
    let failure = false;
    let calls = 0;
    const source: GeoapifyCandidate = {
      externalId: 'osm:node:100000001',
      name: 'Nguồn fixture V3',
      address: 'Địa chỉ fixture V3',
      latitude: 15.88,
      longitude: 108.328,
      category: 'culture',
      venueType: 'place',
      categories: ['tourism.attraction'],
      openingHoursNote: '08:00-18:00',
      sourceUrl: 'https://www.openstreetmap.org/node/100000001',
      flags: [],
      closed: null,
    };
    const product = createProduct(
      connection,
      parseConfig({
        NODE_ENV: 'test',
        CLIENT_ORIGIN: 'http://localhost:5180',
        MONGODB_URI: `mongodb://127.0.0.1:27021/${connection.name}?replicaSet=${harness.setName}`,
      }),
      {
        geoapify: async (group) => {
          calls++;
          await beforeFetch?.();
          if (failure)
            throw new HttpError(
              502,
              'FIXTURE_TIMEOUT',
              'Lỗi nguồn kiểm thử có nhãn.',
            );
          return { group, received: 1, rejected: 0, items: [{ ...source }] };
        },
      },
    );
    try {
      await product.initialize();
      await seedDestinations(product.trips.models.Destination);
      const actor = (
        await product.auth.models.User.create({
          emailNormalized: 'admin-v3@example.invalid',
          displayName: 'Admin V3 fixture',
          roles: ['admin'],
          status: 'active',
        })
      )._id;
      const { Settings } = adminOperationsModels(connection);
      const { Place } = product.explore.models;
      const { Schedule, Run, Review } = product.operations.models;
      const { v3 } = product;
      await t.test(
        'read status does not create configuration and missing scope never calls provider',
        async () => {
          await product.operations.status(actor);
          assert.equal(await Schedule.countDocuments(), 0);
          await assert.rejects(
            product.operations.enqueue(actor, randomUUID()),
            /Chọn điểm đến/,
          );
          assert.equal(calls, 0);
        },
      );
      await Settings.create({
        scope: 'global',
        regions: [
          {
            destinationId,
            latitude: 15.88,
            longitude: 108.328,
            radiusMeters: 5000,
            enabled: true,
          },
        ],
      });
      let campaignId = '';
      await t.test(
        'campaign scope and rule snapshots are immutable; paused in-flight worker loses fence',
        async () => {
          const policyInput = {
            name: 'Giờ nháp fixture',
            autoApplyDraftHours: true,
          };
          const policyKey = randomUUID();
          const [policy, policyReplay] = await Promise.all([
            v3.createPolicy(actor, policyInput, policyKey),
            v3.createPolicy(actor, policyInput, policyKey),
          ]);
          assert.equal(policy.id, policyReplay.id);
          const input = {
            destinationIds: [destinationId],
            group: 'sights' as const,
            policyId: policy.id,
          };
          const key = randomUUID();
          const [campaign, concurrentReplay] = await Promise.all([
            v3.createCampaign(actor, input, key),
            v3.createCampaign(actor, input, key),
          ]);
          assert.equal(campaign.campaign.id, concurrentReplay.campaign.id);
          campaignId = campaign.campaign.id;
          assert.equal(
            (await v3.createCampaign(actor, input, key)).campaign.id,
            campaignId,
          );
          await v3.createPolicy(actor, {
            name: 'Bản mới đang tắt',
            autoApplyDraftHours: false,
          });
          await Settings.updateOne(
            { scope: 'global' },
            { $set: { 'regions.0.radiusMeters': 10000 } },
          );
          const run = (await Run.findById(campaign.tasks[0]!.id))!;
          assert.equal(run.scopeSnapshot!.radiusMeters, 5000);
          assert.equal(run.policySnapshot!.autoApplyDraftHours, true);
          beforeFetch = async () => {
            beforeFetch = undefined;
            await v3.controlCampaign(actor, campaignId, 'pause');
          };
          await product.operations.tick();
          assert.equal((await Run.findById(run._id))!.state, 'paused');
          assert.equal(await Place.countDocuments(), 0);
          await v3.controlCampaign(actor, campaignId, 'resume');
          await product.operations.tick();
          assert.equal(
            (await v3.campaignDetail(actor, campaignId)).campaign.state,
            'succeeded',
          );
          assert.equal(await Place.countDocuments(), 1);
          assert.equal((await v3.sources(actor)).usage24h.requests, 2);
          assert.equal((await v3.sources(actor)).providerBalance, null);
        },
      );
      await t.test(
        'retry uses the same durable task and does not duplicate source IDs or revisions',
        async () => {
          const campaign = await v3.createCampaign(
            actor,
            { destinationIds: [destinationId], group: 'sights' },
            randomUUID(),
          );
          failure = true;
          await product.operations.tick();
          failure = false;
          const runId = campaign.tasks[0]!.id;
          assert.equal((await Run.findById(runId))!.state, 'retry');
          await Run.updateOne(
            { _id: runId },
            { $set: { nextAttemptAt: new Date(0) } },
          );
          await product.operations.tick();
          assert.equal((await Run.findById(runId))!.state, 'succeeded');
          assert.equal(await Place.countDocuments(), 1);
          assert.equal((await Place.findOne())!.revision, 1);
        },
      );
      await t.test(
        'low-risk rule stages draft hours and preserves locks; dry-run has no writes',
        async () => {
          const policy = (await v3.policies(actor)).items.find(
            (p) => p.autoApplyDraftHours,
          )!;
          source.openingHoursNote = '09:00-18:00';
          await v3.createCampaign(
            actor,
            {
              destinationIds: [destinationId],
              group: 'sights',
              policyId: policy.id,
            },
            randomUUID(),
          );
          await product.operations.tick();
          const place = (await Place.findOne())!;
          assert.equal(place.openingHoursNote, '08:00-18:00');
          assert.equal(
            (await connection.collection('catalog_versions').findOne({
              placeId: place._id,
              revision: place.proposalRevision,
            }))!.snapshot.openingHoursNote,
            source.openingHoursNote,
          );
          await Place.updateOne(
            { _id: place._id },
            { $set: { fieldLocks: ['openingHoursNote'] } },
          );
          source.openingHoursNote = '10:00-18:00';
          await v3.createCampaign(
            actor,
            {
              destinationIds: [destinationId],
              group: 'sights',
              policyId: policy.id,
            },
            randomUUID(),
          );
          await product.operations.tick();
          const before = await Place.findById(place._id);
          const simulation = await v3.dryRun(actor, policy.id, destinationId);
          assert.equal(simulation.items[0]!.eligible, false);
          assert.equal(
            (await Place.findById(place._id))!.revision,
            before!.revision,
          );
          assert.deepEqual((await Place.findById(place._id))!.fieldLocks, [
            'openingHoursNote',
          ]);
          assert.equal(
            await Review.countDocuments({
              placeId: place._id,
              kind: 'source',
              state: 'open',
            }),
            1,
          );
        },
      );
      await t.test(
        'frozen page batch rejects newer revision, persists partial results and rechecks roles',
        async () => {
          const place = (await Place.findOne())!;
          const input: BulkPreviewInput = {
            action: 'archive',
            selection: {
              mode: 'page',
              items: [
                { id: String(place._id), expectedRevision: place.revision },
              ],
            },
          };
          const previewKey = randomUUID();
          const [preview, replay] = await Promise.all([
            v3.previewBulk(actor, input, previewKey),
            v3.previewBulk(actor, input, previewKey),
          ]);
          assert.equal(preview.id, replay.id);
          await Place.updateOne({ _id: place._id }, { $inc: { revision: 1 } });
          const result = await v3.executeBulk(actor, preview.id);
          assert.equal(result.state, 'partial');
          assert.equal(result.blocked, 1);
          assert.equal(
            (await Place.findById(place._id))!.publicationStatus,
            'draft',
          );
          const fresh = await v3.previewBulk(
            actor,
            {
              ...input,
              selection: {
                mode: 'page',
                items: [
                  {
                    id: String(place._id),
                    expectedRevision: place.revision + 1,
                  },
                ],
              },
            },
            randomUUID(),
          );
          await product.auth.models.User.updateOne(
            { _id: actor },
            { $set: { roles: ['traveler'] } },
          );
          await assert.rejects(
            v3.executeBulk(actor, fresh.id),
            /không có quyền/,
          );
          await product.auth.models.User.updateOne(
            { _id: actor },
            { $set: { roles: ['admin'] } },
          );
          const done = await v3.executeBulk(actor, fresh.id);
          assert.equal(done.succeeded, 1);
          const revision = (await Place.findById(place._id))!.revision;
          await v3.executeBulk(actor, fresh.id);
          assert.equal((await Place.findById(place._id))!.revision, revision);
          const archivedPreview = await v3.previewBulk(
            actor,
            {
              action: 'archive',
              selection: {
                mode: 'page',
                items: [{ id: String(place._id), expectedRevision: revision }],
              },
            },
            randomUUID(),
          );
          assert.equal(archivedPreview.eligible, 0);
          assert.equal(archivedPreview.blocked, 1);
          // A later state-only change must not expand the frozen impact.
          await Place.collection.updateOne(
            { _id: place._id },
            { $set: { publicationStatus: 'draft' } },
          );
          const blockedReplay = await v3.executeBulk(actor, archivedPreview.id);
          assert.equal(blockedReplay.succeeded, 0);
          assert.equal(
            (await Place.findById(place._id))!.publicationStatus,
            'draft',
          );
          await Place.collection.updateOne(
            { _id: place._id },
            { $set: { publicationStatus: 'archived' } },
          );
        },
      );
      await t.test(
        'server counts, filtered map, queue pagination and select-all exceed 5000 without truncation',
        async () => {
          const template = (await Place.findOne())!.toObject();
          const fixtures = Array.from({ length: 13200 }, (_, i) => ({
            ...template,
            _id: new Types.ObjectId(),
            revision: 1,
            publicRevision: null,
            proposalRevision: null,
            source: undefined,
            sourceSnapshot: null,
            publicationStatus: 'draft',
            name: `Scale fixture ${i}`,
            description: 'Dữ liệu scale fixture có nhãn',
            searchText: `scale fixture ${i}`,
            mapLocation:
              i % 3 === 0
                ? null
                : {
                    latitude: 15.8 + (i % 100) / 1000,
                    longitude: 108.3 + (i % 50) / 1000,
                    precision: 'area',
                    label: 'Fixture area',
                    sourceUrl: 'https://example.invalid/fixture',
                    checkedAt: '2026-10-24',
                  },
          }));
          // Controlled records only in the owned integration DB, never the app DB.
          for (let start = 0; start < fixtures.length; start += 1000)
            await Place.collection.insertMany(
              fixtures.slice(start, start + 1000),
            );
          const started = performance.now();
          const map = await v3.map(
            actor,
            adminMapQuerySchema.parse({
              q: 'scale fixture',
              destinationId,
              west: 108,
              east: 109,
              south: 15,
              north: 16,
              zoom: 12,
            }),
          );
          assert.equal(map.total, 13200);
          assert.equal(map.missingCoordinates, 4400);
          assert.equal(map.inViewport, 8800);
          assert.equal(
            map.clusters.reduce((n, p) => n + p.count, 0),
            8800,
          );
          const queryMs = Math.round(performance.now() - started);
          const freezeStart = performance.now();
          const selection = {
            action: 'archive' as const,
            selection: {
              mode: 'filter' as const,
              filter: adminPlaceQuerySchema.parse({
                q: 'scale fixture',
                destinationId,
              }),
            },
          };
          const frozen = await v3.previewBulk(actor, selection, randomUUID());
          assert.equal(frozen.total, 13200);
          assert.equal(frozen.items.length, 50);
          assert.equal(frozen.hasMore, true);
          assert.equal(
            await v3.models.Item.countDocuments({ jobId: frozen.id }),
            13200,
          );
          const freezeMs = Math.round(performance.now() - freezeStart);
          const first = await v3.executeBulk(actor, frozen.id);
          assert.equal(first.succeeded, 50);
          assert.equal(first.pending, 13150);
          const next = await v3.executeBulk(actor, frozen.id);
          assert.equal(next.succeeded, 100);
          assert.equal(next.pending, 13100);
          const queueStart = performance.now();
          const queue = await product.operations.reviews(
            actor,
            6000,
            destinationId,
            'draft',
            'scale fixture',
          );
          assert.equal(queue.total, 13100);
          assert.equal(queue.items.length, 20);
          assert.equal(queue.hasMore, true);
          const nextPageStart = performance.now();
          const nextQueuePage = await product.operations.reviews(
            actor,
            6020,
            destinationId,
            'draft',
            'scale fixture',
          );
          assert.equal(nextQueuePage.total, 13100);
          assert.equal(nextQueuePage.items.length, 20);
          assert.notEqual(nextQueuePage.items[0]!.id, queue.items[0]!.id);
          t.diagnostic(
            `Fixture13200 observed map/count ${queryMs}ms, freeze ${freezeMs}ms, queue initial reconciliation+2queries ${Math.round(performance.now() - queueStart)}ms, nextpage ${Math.round(performance.now() - nextPageStart)}ms; own loopback MongoDB27021.`,
          );
          const completionStart = performance.now();
          let completion = next;
          while (completion.pending > 0) {
            const before = completion.succeeded;
            completion = await v3.executeBulk(actor, frozen.id);
            assert.ok(
              completion.succeeded > before,
              'each bounded page advances the frozen job',
            );
          }
          assert.equal(completion.total, 13200);
          assert.equal(completion.succeeded, 13200);
          assert.equal(completion.blocked + completion.failed, 0);
          assert.equal(completion.state, 'completed');
          assert.equal(
            await Place.countDocuments({
              searchText: /^scale fixture /,
              publicationStatus: 'archived',
            }),
            13200,
          );
          const replay = await v3.executeBulk(actor, frozen.id);
          assert.equal(replay.succeeded, 13200);
          assert.equal(
            await v3.models.Item.countDocuments({
              jobId: frozen.id,
              state: 'succeeded',
            }),
            13200,
          );
          t.diagnostic(
            `Fixture13200 full frozen selection completed without duplicates in ${Math.round(performance.now() - completionStart)}ms after the first100 items; all13200 canonical records archived.`,
          );
        },
      );
      await t.test(
        'destination archive pauses dependencies, archives children first and fences source resume',
        async () => {
          const parent = (await product.trips.models.Destination.findById(
            destinationId,
          ))!.toObject();
          const destination = await product.trips.models.Destination.create({
            ...parent,
            _id: new Types.ObjectId(),
            slug: 'archive-fixture-v3',
            name: 'Phạm vi lưu trữ fixture',
            revision: 1,
            publicationStatus: 'draft',
          });
          const destId = String(destination._id);
          const template = (await Place.findOne())!.toObject();
          const child = await new Place({
            ...template,
            _id: new Types.ObjectId(),
            destinationId: destination._id,
            destinationName: destination.name,
            name: 'Địa điểm lưu trữ fixture',
            revision: 1,
            publicRevision: null,
            proposalRevision: null,
            source: undefined,
            sourceSnapshot: null,
            publicationStatus: 'draft',
          }).save();
          await Settings.updateOne(
            { scope: 'global' },
            {
              $push: {
                regions: {
                  destinationId: destId,
                  latitude: 15.88,
                  longitude: 108.328,
                  radiusMeters: 5000,
                  enabled: true,
                },
              },
            },
          );
          const campaign = await v3.createCampaign(
            actor,
            { destinationIds: [destId], group: 'sights' },
            randomUUID(),
          );
          const input: BulkPreviewInput = {
            action: 'archive_destination',
            destinationId: destId,
            selection: {
              mode: 'filter',
              filter: adminPlaceQuerySchema.parse({ destinationId: destId }),
            },
          };
          await assert.rejects(
            v3.previewBulk(actor, input, randomUUID()),
            /Tạm dừng hoặc hoàn tất/,
          );
          await v3.controlCampaign(actor, campaign.campaign.id, 'pause');
          const schedule = await Schedule.create({
            scope: destId,
            enabled: true,
          });
          await assert.rejects(
            v3.previewBulk(actor, input, randomUUID()),
            /Tắt lịch/,
          );
          await Schedule.updateOne(
            { _id: schedule._id },
            { $set: { enabled: false } },
          );
          const stalePlan = await v3.previewBulk(actor, input, randomUUID());
          await product.trips.models.Destination.updateOne(
            { _id: destination._id },
            { $inc: { revision: 1 } },
          );
          await assert.rejects(
            v3.executeBulk(actor, stalePlan.id),
            /Dữ liệu đã thay đổi/,
          );
          assert.equal(
            (await Place.findById(child._id))!.publicationStatus,
            'draft',
          );
          // Resume after interruption and a destination edit must release the
          // running archive guard, allowing a fresh reviewed plan.
          await v3.models.Bulk.updateOne(
            { _id: stalePlan.id },
            { $set: { state: 'running' } },
          );
          await assert.rejects(
            v3.executeBulk(actor, stalePlan.id),
            /Dữ liệu đã thay đổi/,
          );
          assert.equal(
            (await v3.models.Bulk.findById(stalePlan.id))!.state,
            'partial',
          );
          const plan = await v3.previewBulk(actor, input, randomUUID());
          assert.equal(plan.total, 1);
          const done = await v3.executeBulk(actor, plan.id);
          assert.equal(done.state, 'completed');
          assert.equal(
            (await Place.findById(child._id))!.publicationStatus,
            'archived',
          );
          assert.equal(
            (await product.trips.models.Destination.findById(destId))!
              .publicationStatus,
            'archived',
          );
          await assert.rejects(
            v3.controlCampaign(actor, campaign.campaign.id, 'resume'),
            /Mở lại/,
          );
          await assert.rejects(
            product.operations.enqueue(actor, randomUUID(), destId),
            /Mở lại/,
          );
          await assert.rejects(
            v3.createCampaign(
              actor,
              { destinationIds: [destId], group: 'sights' },
              randomUUID(),
            ),
            /Mở lại/,
          );
          assert.equal(
            await Place.countDocuments({
              destinationId: destination._id,
              publicationStatus: { $ne: 'archived' },
            }),
            0,
          );
          assert.ok(
            (await product.trips.models.Destination.findById(destId))!
              .catalogWriteFence > 0,
          );
        },
      );
    } finally {
      await product.operations.stop();
      await harness.stop();
    }
  },
);
