import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { createProduct } from '../src/product.js';
import { parseConfig } from '../src/config.js';
import { startTestReplicaSet } from './support/replica-set.js';
import { SourceRateLimit } from '../src/features/explore/source-rate-limit.js';
import { placeVisitInfo } from '../src/features/explore/place-visit-info.js';
test(
  'description and visit pools use distinct leases, overlap bounded work, drain and preserve persisted cooldown',
  { timeout: 60000 },
  async () => {
    const h = await startTestReplicaSet();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const seen = { description: [] as string[], visit: [] as string[] },
      active = { description: 0, visit: 0 },
      peak = { description: 0, visit: 0 };
    const query = async (kind: 'description' | 'visit', name: string) => {
      seen[kind].push(name);
      active[kind]++;
      peak[kind] = Math.max(peak[kind], active[kind]);
      try {
        await gate;
      } finally {
        active[kind]--;
      }
    };
    let limited = false,
      limitedCalls = 0;
    const p = createProduct(
      h.connection,
      parseConfig({
        NODE_ENV: 'test',
        CLIENT_ORIGIN: 'http://localhost:5180',
        MONGODB_URI: `mongodb://127.0.0.1:27021/${h.connection.name}?replicaSet=${h.setName}`,
        DESCRIPTION_WORKER_CONCURRENCY: '3',
        VISIT_WORKER_CONCURRENCY: '4',
      }),
      {
        findDescription: async (q) => {
          await query('description', q.name);
          return null;
        },
        findVisitInfo: async (q) => {
          if (limited) {
            limitedCalls++;
            throw new SourceRateLimit(600000);
          }
          await query('visit', q.name);
          return null;
        },
      },
    );
    try {
      await p.initialize(true);
      const actor = (
        await p.auth.models.User.create({
          emailNormalized: 'source-pool@example.invalid',
          displayName: 'Pool fixture',
          roles: ['admin'],
          status: 'active',
        })
      )._id;
      const destination = (await p.trips.models.Destination.findOne({
        provinceCode: '48',
      }))!;
      for (let i = 0; i < 6; i++)
        await p.catalog.write(
          actor,
          {
            destinationId: String(destination._id),
            name: `Source pool fixture ${i}`,
            description: '',
            category: 'culture',
            venueType: 'place',
            locationQuery: 'Fixture only',
            durationMinutes: 60,
            openingHoursNote: '',
            sourceUrl: 'https://example.com/fixture',
            referencePrice: null,
            publicationStatus: 'draft',
            images: [],
          },
          randomUUID(),
        );
      await p.explore.models.Place.updateMany(
        {},
        {
          $set: {
            descriptionSearch: {
              state: 'pending',
              nextAttemptAt: new Date(0),
              attempts: 0,
            },
            visitSearch: {
              state: 'pending',
              providerVersion: 3,
              nextAttemptAt: new Date(0),
              attempts: 0,
            },
          },
        },
      );
      p.descriptionSearch.start();
      p.visitSearch.start();
      for (
        let i = 0;
        i < 150 && (seen.description.length < 3 || seen.visit.length < 4);
        i++
      )
        await delay(20);
      assert.equal(peak.description, 3);
      assert.equal(peak.visit, 4);
      assert.equal(new Set(seen.description).size, 3);
      assert.equal(new Set(seen.visit).size, 4);
      let drained = false;
      const stopping = Promise.all([
        p.descriptionSearch.stop(),
        p.visitSearch.stop(),
      ]).then(() => {
        drained = true;
      });
      await delay(20);
      assert.equal(drained, false);
      release();
      await stopping;
      assert.equal(active.description + active.visit, 0);
      assert.equal(seen.description.length, 3);
      assert.equal(seen.visit.length, 4);
      assert.equal(
        await p.explore.models.Place.countDocuments({
          publicationStatus: 'draft',
          revision: 1,
        }),
        6,
      );
      limited = true;
      await Promise.all(Array.from({ length: 4 }, () => p.visitSearch.tick()));
      const afterLimit = limitedCalls;
      assert.ok(
        afterLimit >= 1 && afterLimit <= 2,
        'only pending visits that were already claimed can reach this fixture',
      );
      await p.visitSearch.tick();
      assert.equal(limitedCalls, afterLimit);
      const paused = await p.explore.models.Place.findOne({
        'visitSearch.nextAttemptAt': { $gt: new Date() },
      });
      assert.equal(paused?.visitSearch?.attempts, 0);
      let restartCalls = 0;
      const restarted = placeVisitInfo(
        p.explore,
        p.catalog,
        async () => {
          restartCalls++;
          return null;
        },
        4,
      );
      await restarted.prepare();
      await Promise.all(Array.from({ length: 4 }, () => restarted.tick()));
      assert.equal(restartCalls, 0);
    } finally {
      release();
      await Promise.all([p.descriptionSearch.stop(), p.visitSearch.stop()]);
      await h.stop();
    }
  },
);
