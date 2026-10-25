import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { Types } from 'mongoose';
import { createProduct } from '../src/product.js';
import { parseConfig } from '../src/config.js';
import { startTestReplicaSet } from './support/replica-set.js';
import { SourceRateLimit } from '../src/features/explore/source-rate-limit.js';
import { visitContext } from '../src/features/explore/visit-info-provider.js';

test(
  'national enrichment is admin-only, resumable, idempotent and keeps editorial data and publication',
  { timeout: 60000 },
  async () => {
    const h = await startTestReplicaSet();
    let limited = false;
    const p = createProduct(
      h.connection,
      parseConfig({
        NODE_ENV: 'test',
        CLIENT_ORIGIN: 'http://localhost:5180',
        MONGODB_URI: `mongodb://127.0.0.1:27021/${h.connection.name}?replicaSet=${h.setName}`,
      }),
      {
        findImages: async () => [],
        findDescription: async () => null,
        findVisitInfo: async () => {
          if (limited) throw new SourceRateLimit(600000);
          return {
            hours: null,
            price: {
              amount: 40000,
              currency: 'VND',
              unit: 'person',
              conditions: 'Integration fixture only',
              sourceUrl: 'https://example.com/fixture',
              observedAt: new Date().toISOString(),
              reviewed: false,
            },
          };
        },
      },
    );
    try {
      await p.initialize(true);
      const actor = (
        await p.auth.models.User.create({
          emailNormalized: 'enrichment@example.invalid',
          displayName: 'Enrichment fixture',
          roles: ['admin'],
          status: 'active',
        })
      )._id;
      const user = (
        await p.auth.models.User.create({
          emailNormalized: 'viewer@example.invalid',
          displayName: 'Viewer fixture',
          roles: [],
          status: 'active',
        })
      )._id;
      const destination = (await p.trips.models.Destination.findOne({
        provinceCode: '48',
      }))!;
      for (const name of ['Fixture one', 'Fixture two', 'Fixture protected'])
        await p.catalog.write(
          actor,
          {
            destinationId: String(destination._id),
            name,
            description: '',
            category: 'culture',
            venueType: 'place',
            locationQuery: 'Integration fixture',
            durationMinutes: 60,
            openingHoursNote: '',
            sourceUrl: 'https://example.com/fixture',
            referencePrice: null,
            publicationStatus: 'draft',
            images: [],
          },
          randomUUID(),
        );
      const raw = (await p.explore.models.Place.findOne({
        name: 'Fixture one',
      }))!;
      await p.explore.models.Place.updateOne(
        { _id: raw._id },
        {
          $set: {
            visitSearch: {
              state: 'ready',
              providerVersion: 3,
              context: visitContext(raw),
              attempts: 0,
              result: {
                hours: {
                  text: 'Mo-Su 09:00-17:00',
                  sourceUrl: 'https://example.com/original',
                  observedAt: new Date().toISOString(),
                  reviewed: false,
                },
                price: null,
              },
            },
            descriptionSearch: { state: 'empty' },
            imageSearch: { state: 'empty', storageVersion: 3 },
          },
        },
      );
      await p.explore.models.Place.updateOne(
        { name: 'Fixture protected' },
        { $set: { publicationStatus: 'published' } },
      );
      const key = randomUUID();
      await assert.rejects(p.enrichment.start(user, key));
      const id = await p.enrichment.start(actor, key);
      assert.equal(await p.enrichment.start(actor, key), id);
      await assert.rejects(p.enrichment.start(actor, randomUUID()));
      await p.enrichment.tick();
      let state = await p.enrichment.read(actor, { offset: 0, state: 'all' });
      assert.equal(state.job?.registered, 3);
      await p.enrichment.control(actor, id, {
        action: 'pause',
        expectedRevision: 1,
      });
      await p.enrichment.tick();
      assert.equal(
        (await p.enrichment.read(actor, { offset: 0, state: 'all' })).job
          ?.state,
        'paused',
      );
      await assert.rejects(
        p.enrichment.control(actor, id, {
          action: 'resume',
          expectedRevision: 1,
        }),
      );
      await p.enrichment.control(actor, id, {
        action: 'resume',
        expectedRevision: 2,
      });
      await p.enrichment.tick(); // finish population, resuming from durable cursor
      await p.enrichment.models.Item.insertMany(
        Array.from({ length: 150 }, () => ({
          jobId: id,
          placeId: new Types.ObjectId(),
          name: 'Capacity fixture',
          destinationName: 'Owned test only',
          state: 'waiting',
          message: 'capacity fixture',
          nextCheckAt: new Date(Date.now() + 600000),
        })),
      );
      await p.enrichment.tick();
      assert.equal(
        await p.enrichment.models.Item.countDocuments({
          jobId: id,
          state: 'queued',
        }),
        3,
        'a full pool must not become an unlimited MongoDB limit(0) dispatch',
      );
      // Explicit owned integration namespace; these synthetic rows are not application data.
      await p.enrichment.models.Item.deleteMany({
        jobId: id,
        message: 'capacity fixture',
      });
      await p.enrichment.tick(); // dispatch and first reconciliation
      await p.imageSearch.tick();
      await p.imageSearch.tick();
      await p.imageSearch.tick();
      await p.descriptionSearch.tick();
      await p.descriptionSearch.tick();
      await p.visitSearch.tick();
      await p.visitSearch.tick();
      const after = (await p.explore.models.Place.findById(raw._id))!;
      assert.equal(after.revision, raw.revision);
      assert.equal(after.publicationStatus, 'draft');
      assert.equal(after.description, '');
      assert.equal(
        after.visitSearch?.result?.hours?.sourceUrl,
        'https://example.com/original',
      );
      assert.equal(after.visitSearch?.result?.price?.reviewed, false);
      assert.equal(after.visitSearch?.result?.price?.amount, 40000);
      await p.enrichment.models.Item.updateMany(
        {},
        { $set: { nextCheckAt: new Date(0) } },
      );
      await p.enrichment.tick();
      state = await p.enrichment.read(actor, { offset: 0, state: 'all' });
      assert.equal(
        state.job?.state,
        'completed',
        JSON.stringify(
          await p.explore.models.Place.find().select(
            'name imageSearch.state descriptionSearch.state visitSearch.state',
          ),
        ),
      );
      assert.equal(state.job?.counts.review, 2);
      assert.equal(state.job?.counts.skipped, 1);
      assert.equal(
        await p.enrichment.models.Item.countDocuments({ jobId: id }),
        3,
      );
      assert.equal(
        await h.connection
          .collection('audit_logs')
          .countDocuments({ action: 'catalog.enrichment_started' }),
        1,
      );
      // A rate limit keeps a pending search and survives initialization, without consuming attempts.
      limited = true;
      await p.explore.models.Place.updateMany(
        { publicationStatus: 'draft' },
        {
          $set: {
            'visitSearch.state': 'pending',
            'visitSearch.nextAttemptAt': new Date(0),
            'visitSearch.attempts': 0,
          },
        },
      );
      await p.visitSearch.tick();
      const paused = await p.explore.models.Place.findOne({
        'visitSearch.state': 'pending',
        'visitSearch.nextAttemptAt': { $gt: new Date() },
      });
      assert.equal(paused?.visitSearch?.attempts, 0);
      await p.visitSearch.prepare();
      const beforeCalls = await p.explore.models.Place.countDocuments({
        'visitSearch.state': 'pending',
      });
      await p.visitSearch.tick();
      assert.equal(
        await p.explore.models.Place.countDocuments({
          'visitSearch.state': 'pending',
        }),
        beforeCalls,
      );
    } finally {
      await h.stop();
    }
  },
);
