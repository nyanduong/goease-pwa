import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import mongoose from 'mongoose';
import { adminPlaceQuerySchema, provinceImportSchema } from '@goease/contracts';
import { createProduct } from '../src/product.js';
import { parseConfig } from '../src/config.js';
import { HttpError } from '../src/http-error.js';
import { startTestReplicaSet } from './support/replica-set.js';
import { storedFixtureCandidate as fixtureCandidate } from './support/photo.js';

test(
  'province enable → source draft → reviewed bulk publication, retries and boundaries',
  { timeout: 90000 },
  async (t) => {
    const harness = await startTestReplicaSet();
    let lookups = 0,
      failLookup = false,
      failPlaces = false;
    let lookupHook: (() => Promise<void>) | undefined;
    let imageMode: 'ready' | 'empty' | 'failed' = 'ready';
    let imageHook: (() => Promise<void>) | undefined;
    let imageCalls = 0;
    let descriptionCalls = 0;
    let descriptionHook: (() => Promise<void>) | undefined;
    const product = createProduct(
      harness.connection,
      parseConfig({
        NODE_ENV: 'test',
        CLIENT_ORIGIN: 'http://localhost:5180',
        MONGODB_URI: `mongodb://127.0.0.1:27021/${harness.connection.name}?replicaSet=${harness.setName}`,
      }),
      {
        findDescription: async () => {
          descriptionCalls++;
          await descriptionHook?.();
          return {
            text: 'Giới thiệu địa điểm dùng cho kiểm thử có nguồn.',
            originalText: 'Giới thiệu địa điểm dùng cho kiểm thử có nguồn.',
            title: 'Địa điểm kiểm thử',
            sourceUrl:
              'https://vi.wikipedia.org/w/index.php?title=Fixture&oldid=123',
            language: 'vi',
            translated: false,
            revisionId: 123,
            license: 'CC-BY-SA-4.0',
            match: 'linked',
          };
        },
        findImages: async () => {
          imageCalls++;
          await imageHook?.();
          if (imageMode === 'failed')
            throw new Error('Fixture provider failure');
          return imageMode === 'empty' ? [] : [fixtureCandidate];
        },
        resolveProvinceArea: async () => {
          lookups++;
          await lookupHook?.();
          if (failLookup)
            throw new HttpError(
              502,
              'AREA_LOOKUP_FAILED',
              'Fixture lookup failure',
            );
          return { latitude: 16.06, longitude: 108.22, radiusMeters: 10000 };
        },
        geoapify: async (group, limit, area) => {
          assert.equal(group, 'sights');
          assert.equal(limit, 50);
          assert.equal(area?.radiusMeters, 10000);
          if (failPlaces)
            throw new HttpError(
              503,
              'GEOAPIFY_AUTH',
              'Fixture permission failure',
            );
          return {
            group,
            received: 1,
            rejected: 0,
            items: [
              {
                externalId: 'osm:node:987654',
                name: 'Địa điểm thử tỉnh',
                address: 'Địa chỉ fixture Đà Nẵng',
                latitude: 16.06,
                longitude: 108.22,
                category: 'culture',
                venueType: 'place',
                categories: ['tourism.attraction'],
                sourceUrl: 'https://www.openstreetmap.org/node/987654',
                openingHoursNote: '',
                flags: [],
              },
            ],
          };
        },
      },
    );
    try {
      await product.initialize(true);
      const actor = (
        await product.auth.models.User.create({
          emailNormalized: 'province-import@example.invalid',
          displayName: 'Admin fixture',
          roles: ['admin'],
          status: 'active',
        })
      )._id;
      const traveler = (
        await product.auth.models.User.create({
          emailNormalized: 'province-customer@example.invalid',
          displayName: 'Customer fixture',
          roles: ['traveler'],
          status: 'active',
        })
      )._id;
      const province = (await product.trips.models.Destination.findOne({
        provinceCode: '48',
      }))!;
      const input = { destinationId: String(province._id) },
        key = randomUUID();
      await t.test(
        'authorization, strict input and disabled province fail before provider',
        async () => {
          assert.equal(
            provinceImportSchema.safeParse({ ...input, autoPublish: true })
              .success,
            false,
          );
          await assert.rejects(
            product.v3.startProvinceImport(traveler, input, key),
          );
          await assert.rejects(
            product.v3.startProvinceImport(actor, input, key),
            { code: 'PROVINCE_DISABLED' },
          );
          assert.equal(lookups, 0);
        },
      );
      await product.trips.models.Destination.updateOne(
        { _id: province._id },
        { $set: { publicationStatus: 'published' }, $inc: { revision: 1 } },
      );
      await t.test(
        'lookup failure never queues a run; province stays on',
        async () => {
          failLookup = true;
          await assert.rejects(
            product.v3.startProvinceImport(actor, input, key),
            { code: 'AREA_LOOKUP_FAILED' },
          );
          assert.equal(await product.operations.models.Run.countDocuments(), 0);
          assert.equal(
            (await product.trips.models.Destination.findById(province._id))!
              .publicationStatus,
            'published',
          );
          failLookup = false;
        },
      );
      const campaign = await product.v3.startProvinceImport(actor, input, key);
      await t.test(
        'durable snapshot, replay and active run prevent duplicate imports',
        async () => {
          const before = lookups;
          assert.equal(
            (await product.v3.startProvinceImport(actor, input, key)).campaign
              .id,
            campaign.campaign.id,
          );
          assert.equal(lookups, before);
          await assert.rejects(
            product.v3.startProvinceImport(
              actor,
              { ...input, areaName: 'Hội An' },
              key,
            ),
            { code: 'CATALOG_CONFLICT' },
          );
          await assert.rejects(
            product.v3.startProvinceImport(actor, input, randomUUID()),
            { code: 'SCOPE_RUN_ACTIVE' },
          );
          await assert.rejects(
            product.v3.startProvinceImport(
              actor,
              { ...input, areaName: 'Sa Pa' },
              randomUUID(),
            ),
            { code: 'INVALID_AREA' },
          );
          assert.equal(campaign.tasks[0]!.scope?.areaLabel, 'Đà Nẵng');
          assert.equal(campaign.campaign.policy.autoPublish, false);
          assert.equal(
            await harness.connection
              .collection('catalog_settings')
              .countDocuments(),
            0,
          );
        },
      );
      await product.operations.tick();
      const place = (await product.explore.models.Place.findOne({
        destinationId: province._id,
      }))!;
      const catalog = product.catalog;
      await t.test(
        'worker writes drafts with unknown prices; no automatic publication',
        async () => {
          assert.equal(place.publicationStatus, 'draft');
          assert.equal(place.description, '');
          assert.match(place.internalNote, /Geoapify/);
          assert.equal(place.referencePrice, null);
          assert.equal(place.source?.provider, 'geoapify');
          assert.equal(
            (await product.v3.campaignDetail(actor, campaign.campaign.id))
              .campaign.state,
            'succeeded',
          );
          assert.equal(
            await product.operations.models.Review.countDocuments({
              placeId: place._id,
              kind: 'draft',
            }),
            1,
          );
        },
      );
      await t.test(
        'missing photos block publication; first candidate becomes a stable automatic draft cover',
        async () => {
          const bulk = {
            action: 'publish' as const,
            selection: {
              mode: 'filter' as const,
              filter: adminPlaceQuerySchema.parse({
                destinationId: input.destinationId,
                status: 'draft',
              }),
            },
          };
          assert.equal(
            (await product.v3.previewBulk(actor, bulk, randomUUID())).eligible,
            0,
          );
          await assert.rejects(
            product.imageSearch.read(traveler, String(place._id)),
          );
          await product.descriptionSearch.tick();
          const described = await product.catalog.proposal(
            (await product.explore.models.Place.findById(place._id))!,
          );
          assert.match(described.description, /kiểm thử có nguồn/);
          assert.equal(described.descriptionSource?.revisionId, 123);
          await product.imageSearch.tick();
          const suggestions = await product.imageSearch.read(
            actor,
            String(place._id),
          );
          assert.equal(suggestions.state, 'ready');
          assert.ok(
            suggestions.candidates[0]?.image.url.startsWith(
              'https://res.cloudinary.com/',
            ),
          );
          assert.equal(suggestions.candidates[0]?.image.reviewed, false);
          const observed = (await product.explore.models.Place.findById(
            place._id,
          ))!;
          assert.equal(observed.revision, place.revision);
          assert.equal(observed.images.length, 0);
          const effective = await catalog.proposal(observed);
          assert.equal(
            effective.images[0]?.url,
            suggestions.candidates[0]?.image.url,
          );
          assert.equal(effective.images[0]?.selection, 'automatic');
          assert.equal(effective.images[0]?.reviewed, false);
          assert.equal(effective.publicationStatus, 'draft');
          const locked = product.explore.models.Place.hydrate({
            ...observed.toObject(),
            fieldLocks: ['images'],
          });
          assert.equal(catalog.withSourceDefaults(locked).images.length, 0);
          const chosen = product.explore.models.Place.hydrate({
            ...observed.toObject(),
            images: [
              {
                ...fixtureCandidate.image,
                url: 'https://res.cloudinary.com/fixture/image/upload/other.webp',
                sourceUrl:
                  'https://commons.wikimedia.org/wiki/File:Different-photo.jpg',
                selection: 'admin',
              },
            ],
          });
          assert.equal(
            catalog.withSourceDefaults(chosen).images[0]?.url,
            'https://res.cloudinary.com/fixture/image/upload/other.webp',
          );
          assert.equal(suggestions.defaultCover?.selection, 'automatic');
          assert.equal(
            (await product.v3.previewBulk(actor, bulk, randomUUID())).eligible,
            1,
          );
          const form = {
            ...catalog.input(observed),
            publicationStatus: 'published' as const,
          };
          await assert.rejects(
            catalog.write(
              actor,
              form,
              randomUUID(),
              String(place._id),
              observed.revision,
              undefined,
              'publish',
            ),
          );
          await catalog.write(
            actor,
            {
              ...form,
              publicationStatus: 'draft',
              description: described.description,
              images: [
                {
                  ...suggestions.candidates[0]!.image,
                  credit: 'Tác giả và tổ chức ghi công fixture; '.repeat(6),
                  reviewed: true,
                },
              ],
            },
            randomUUID(),
            String(place._id),
            observed.revision,
          );
          assert.equal(
            (await product.imageSearch.read(actor, String(place._id))).state,
            'ready',
          );
          await product.imageSearch.enqueue(actor, String(place._id));
          await product.imageSearch.tick();
          assert.equal(imageCalls, 1, 'recent lookup is not repeated');
          assert.equal(
            (await product.explore.models.Place.findById(place._id))!
              .publicationStatus,
            'draft',
          );
        },
      );
      await t.test(
        'explicit bulk preview and execute publish eligible drafts',
        async () => {
          const preview = await product.v3.previewBulk(
            actor,
            {
              action: 'publish',
              selection: {
                mode: 'filter',
                filter: adminPlaceQuerySchema.parse({
                  destinationId: input.destinationId,
                  status: 'draft',
                }),
              },
            },
            randomUUID(),
          );
          assert.equal(preview.total, 1);
          assert.equal(preview.eligible, 1);
          const result = await product.v3.executeBulk(actor, preview.id, false);
          assert.equal(result.succeeded, 1);
          assert.equal(
            (await product.explore.models.Place.findById(place._id))!
              .descriptionSource?.revisionId,
            123,
          );
          assert.equal(
            (await product.explore.models.Place.findById(place._id))!
              .publicationStatus,
            'published',
          );
        },
      );
      await t.test(
        'repeat fetch preserves published content and deduplicates OSM identity',
        async () => {
          await product.v3.startProvinceImport(actor, input, randomUUID());
          await product.operations.tick();
          assert.equal(await product.explore.models.Place.countDocuments(), 1);
          const current = (await product.explore.models.Place.findById(
            place._id,
          ))!;
          assert.equal(current.publicationStatus, 'published');
          assert.equal(current.referencePrice, null);
        },
      );
      await t.test(
        'place provider failure is a failed run with no new draft',
        async () => {
          failPlaces = true;
          const failed = await product.v3.startProvinceImport(
            actor,
            input,
            randomUUID(),
          );
          await product.operations.tick();
          assert.equal(
            (await product.v3.campaignDetail(actor, failed.campaign.id))
              .campaign.state,
            'failed',
          );
          assert.equal(await product.explore.models.Place.countDocuments(), 1);
        },
      );
      await t.test(
        'concurrent replay creates exactly one campaign and run',
        async () => {
          failPlaces = false;
          const key = randomUUID();
          let arrivals = 0;
          let release!: () => void;
          const barrier = new Promise<void>((resolve) => {
            release = resolve;
          });
          lookupHook = async () => {
            if (++arrivals === 2) release();
            await barrier;
          };
          const [a, b] = await Promise.all([
            product.v3.startProvinceImport(actor, input, key),
            product.v3.startProvinceImport(actor, input, key),
          ]);
          lookupHook = undefined;
          assert.equal(a.campaign.id, b.campaign.id);
          assert.equal(
            await product.operations.models.Run.countDocuments({
              campaignId: a.campaign.id,
            }),
            1,
          );
          await product.operations.tick();
        },
      );
      await t.test(
        'province switched off during lookup cannot queue a new run',
        async () => {
          // This scenario starts a fresh test quota window after repeated lookup/worker runs.
          await product.operations.models.Schedule.updateOne(
            { scope: 'provider-quota' },
            { $set: { quotaHour: 0 } },
          );
          const before = await product.operations.models.Run.countDocuments();
          lookupHook = async () => {
            await product.trips.models.Destination.updateOne(
              { _id: province._id },
              { $set: { publicationStatus: 'draft' } },
            );
          };
          await assert.rejects(
            product.v3.startProvinceImport(actor, input, randomUUID()),
            { code: 'PROVINCE_DISABLED' },
          );
          lookupHook = undefined;
          assert.equal(
            await product.operations.models.Run.countDocuments(),
            before,
          );
        },
      );
      await t.test(
        'image failures, empty results and stale revisions never change editorial content',
        async () => {
          const reset = () =>
            product.explore.models.Place.updateOne(
              { _id: place._id },
              {
                $set: {
                  'imageSearch.state': 'pending',
                  'imageSearch.attempts': 0,
                  'imageSearch.nextAttemptAt': new Date(0),
                },
              },
            );
          imageMode = 'empty';
          await reset();
          await product.imageSearch.tick();
          assert.equal(
            (await product.imageSearch.read(actor, String(place._id))).state,
            'empty',
          );
          imageMode = 'failed';
          await reset();
          for (let attempt = 0; attempt < 3; attempt++) {
            await product.explore.models.Place.updateOne(
              { _id: place._id },
              { $set: { 'imageSearch.nextAttemptAt': new Date(0) } },
            );
            await product.imageSearch.tick();
          }
          assert.equal(
            (await product.imageSearch.read(actor, String(place._id))).state,
            'failed',
          );
          imageMode = 'ready';
          await reset();
          imageHook = async () => {
            await product.explore.models.Place.updateOne(
              { _id: place._id },
              { $inc: { revision: 1 } },
            );
          };
          await product.imageSearch.tick();
          imageHook = undefined;
          assert.equal(
            (await product.imageSearch.read(actor, String(place._id))).state,
            'pending',
          );
          assert.deepEqual(
            (await product.imageSearch.read(actor, String(place._id)))
              .candidates,
            [],
          );
          const current = (await product.explore.models.Place.findById(
            place._id,
          ))!;
          assert.equal(current.publicationStatus, 'published');
          assert.equal(current.images[0]?.reviewed, true);
          await product.explore.models.Place.collection.updateOne(
            { _id: place._id },
            {
              $unset: { 'imageSearch.storageVersion': '' },
              $set: { 'imageSearch.state': 'ready' },
            },
          );
          await product.imageSearch.prepareStorage();
          const requeued = (await product.explore.models.Place.findById(
            place._id,
          ))!;
          assert.equal(requeued.imageSearch?.storageVersion, 2);
          assert.equal(requeued.imageSearch?.state, 'pending');
          assert.equal(requeued.revision, current.revision);
          assert.equal(requeued.images[0]?.url, current.images[0]?.url);
          await product.imageSearch.tick();
          await product.imageSearch.prepareStorage();
          assert.equal(
            (await product.imageSearch.read(actor, String(place._id)))
              .defaultCover?.url,
            current.imageSearch?.defaultCover?.url,
          );
          assert.equal(
            (await product.imageSearch.read(actor, String(place._id))).state,
            'ready',
            'storage preparation is idempotent',
          );
        },
      );
      await t.test(
        'description lookup respects locks, authorization and stale revisions without overwriting drafts',
        async () => {
          const { Place } = product.explore.models;
          const current = (await Place.findById(place._id))!;
          const draft = await Place.create({
            ...current.toObject(),
            _id: new mongoose.Types.ObjectId(),
            name: 'Địa điểm giới thiệu kiểm thử',
            publicationStatus: 'draft',
            proposalRevision: null,
            publicRevision: null,
            description: '',
            descriptionSource: null,
            fieldLocks: ['description'],
            source: {
              ...current.toObject().source,
              externalId: 'osm:node:77777777',
            },
            descriptionSearch: { state: 'pending', nextAttemptAt: new Date(0) },
          });
          await assert.rejects(
            product.descriptionSearch.read(traveler, String(draft._id)),
          );
          const before = descriptionCalls;
          await product.descriptionSearch.tick();
          assert.equal(descriptionCalls, before);
          assert.equal((await Place.findById(draft._id))!.description, '');
          await Place.updateOne(
            { _id: draft._id },
            {
              $set: {
                fieldLocks: [],
                'descriptionSearch.state': 'pending',
                'descriptionSearch.nextAttemptAt': new Date(0),
              },
            },
          );
          descriptionHook = async () => {
            await Place.updateOne(
              { _id: draft._id },
              {
                $inc: { revision: 1 },
                $set: { description: 'Admin đang biên tập nội dung.' },
              },
            );
          };
          await product.descriptionSearch.tick();
          descriptionHook = undefined;
          const after = (await Place.findById(draft._id))!;
          assert.equal(after.description, 'Admin đang biên tập nội dung.');
          assert.equal(after.descriptionSearch?.state, 'pending');
          assert.equal(after.descriptionSearch?.result, null);
          await Place.updateOne(
            { _id: draft._id },
            { $set: { 'descriptionSearch.nextAttemptAt': new Date(0) } },
          );
          await product.descriptionSearch.tick();
          assert.equal(
            (await Place.findById(draft._id))!.description,
            'Admin đang biên tập nội dung.',
          );
        },
      );
    } finally {
      await product.operations.stop();
      await harness.stop();
    }
  },
);
