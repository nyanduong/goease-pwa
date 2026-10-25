import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { createProduct } from '../src/product.js';
import { parseConfig } from '../src/config.js';
import { startTestReplicaSet } from './support/replica-set.js';
import { storedFixtureCandidate } from './support/photo.js';
import { PhotoSourceCooldown } from '../src/features/explore/place-photo-storage.js';
import { placeImages } from '../src/features/explore/place-images.js';

test(
  'photo pool overlaps bounded jobs, prioritizes the selected province, drains stop and never claims a place twice',
  { timeout: 60000 },
  async () => {
    const h = await startTestReplicaSet();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let active = 0,
      peak = 0;
    const seen: string[] = [];
    let limited = false,
      limitedCalls = 0;
    const p = createProduct(
      h.connection,
      parseConfig({
        NODE_ENV: 'test',
        CLIENT_ORIGIN: 'http://localhost:5180',
        MONGODB_URI: `mongodb://127.0.0.1:27021/${h.connection.name}?replicaSet=${h.setName}`,
        PHOTO_WORKER_CONCURRENCY: '3',
        PHOTO_PRIORITY_PROVINCE_CODE: '48',
      }),
      {
        findImages: async (query) => {
          if (limited) {
            limitedCalls++;
            throw new PhotoSourceCooldown(600000);
          }
          seen.push(query.name);
          active++;
          peak = Math.max(peak, active);
          try {
            await gate;
            return [storedFixtureCandidate];
          } finally {
            active--;
          }
        },
      },
    );
    try {
      await p.initialize(true);
      const actor = (
        await p.auth.models.User.create({
          emailNormalized: 'pool@example.invalid',
          displayName: 'Pool fixture',
          roles: ['admin'],
          status: 'active',
        })
      )._id;
      const dn = (await p.trips.models.Destination.findOne({
        provinceCode: '48',
      }))!;
      const other = (await p.trips.models.Destination.findOne({
        provinceCode: '01',
      }))!;
      for (const [destinationId, name] of [
        [String(other._id), 'Other province fixture'],
        ...Array.from({ length: 5 }, (_, i) => [
          String(dn._id),
          `Priority fixture ${i}`,
        ]),
      ]) {
        await p.catalog.write(
          actor,
          {
            destinationId: destinationId!,
            name: name!,
            description: '',
            category: 'culture',
            venueType: 'place',
            locationQuery: 'Fixture',
            durationMinutes: 60,
            openingHoursNote: '',
            sourceUrl: 'https://example.com/fixture',
            referencePrice: null,
            publicationStatus: 'draft',
            images: [],
          },
          randomUUID(),
        );
      }
      const urgent = (await p.explore.models.Place.findOne({
        name: 'Priority fixture 4',
      }))!;
      await p.imageSearch.enqueue(actor, String(urgent._id));
      p.imageSearch.start();
      for (let i = 0; i < 100 && seen.length < 3; i++) await delay(20);
      assert.equal(seen.length, 3);
      assert.equal(peak, 3);
      assert.equal(new Set(seen).size, 3);
      assert.ok(
        seen.includes('Priority fixture 4'),
        'explicit admin lookup moves ahead within the preferred province',
      );
      assert.ok(seen.every((name) => name.startsWith('Priority fixture')));
      let stopped = false;
      const stop = p.imageSearch.stop().then(() => {
        stopped = true;
      });
      await delay(30);
      assert.equal(stopped, false, 'stop drains active jobs');
      release();
      await stop;
      assert.equal(active, 0);
      assert.equal(seen.length, 3, 'no new claims after stop');
      assert.equal(
        await p.explore.models.Place.countDocuments({
          name: { $in: seen },
          'imageSearch.state': 'ready',
        }),
        3,
      );
      const locked = await p.explore.models.Place.findOne({ name: seen[0]! });
      await p.explore.models.Place.updateOne(
        { _id: locked!._id },
        { $set: { fieldLocks: ['images'] } },
      );
      await p.imageSearch.prepareStorage();
      assert.equal(
        (await p.explore.models.Place.findById(locked!._id))?.imageSearch
          ?.state,
        'ready',
        'locked observations are preserved',
      );
      assert.equal(
        await p.explore.models.Place.countDocuments({
          name: { $in: seen.slice(1) },
          'imageSearch.state': 'empty',
          'imageSearch.defaultCover': null,
        }),
        2,
        'unmatched automatic draft suggestions are withdrawn',
      );
      limited = true;
      const stale = (await p.explore.models.Place.findOne({
        name: 'Priority fixture 1',
      }))!;
      await p.explore.models.Place.updateOne(
        { _id: stale._id },
        {
          $set: {
            'imageSearch.state': 'failed',
            'imageSearch.defaultCover': {
              ...storedFixtureCandidate.image,
              selection: 'automatic',
            },
            'imageSearch.candidates': [storedFixtureCandidate],
          },
        },
      );
      await p.imageSearch.prepareStorage();
      assert.equal(
        (await p.explore.models.Place.findById(stale._id))?.imageSearch
          ?.defaultCover,
        null,
        'a failed lookup cannot keep an unrelated legacy cover',
      );
      const beforeCooldown = Date.now();
      await p.imageSearch.tick();
      await p.imageSearch.tick();
      assert.equal(
        limitedCalls,
        1,
        'the whole pool pauses new claims during provider cooldown',
      );
      const deferred = await p.explore.models.Place.findOne({
        'imageSearch.nextAttemptAt': {
          $gte: new Date(beforeCooldown + 590000),
        },
      });
      assert.ok(deferred);
      assert.equal(deferred.imageSearch?.state, 'pending');
      assert.equal(
        deferred.imageSearch?.attempts,
        0,
        'rate limits do not consume the ordinary retry budget',
      );
      const resumed = placeImages(p.explore, p.catalog, async () => {
        limitedCalls++;
        throw new PhotoSourceCooldown(600000);
      });
      await resumed.prepareStorage();
      await resumed.tick();
      assert.equal(
        limitedCalls,
        1,
        'a restarted worker restores the persisted provider cooldown',
      );
    } finally {
      release();
      await p.imageSearch.stop();
      await h.stop();
    }
  },
);
