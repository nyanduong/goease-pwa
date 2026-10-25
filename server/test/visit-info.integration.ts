import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import {
  adminPlaceQuerySchema,
  adminPlaceInputSchema,
  type AdminPlaceInput,
} from '@goease/contracts';
import { startTestReplicaSet } from './support/replica-set.js';
import { fixturePhoto } from './support/photo.js';
import { createProduct } from '../src/product.js';
import { parseConfig } from '../src/config.js';
import { osmVisitInfo } from '../src/features/explore/visit-info-provider.js';
test(
  'visit observations: durable draft, authorization, review gate, public isolation, locks and retry fences',
  { timeout: 90000 },
  async () => {
    const h = await startTestReplicaSet();
    let fail = false;
    let hook: (() => Promise<void>) | undefined;
    const p = createProduct(
      h.connection,
      parseConfig({
        NODE_ENV: 'test',
        CLIENT_ORIGIN: 'http://localhost:5180',
        MONGODB_URI: `mongodb://127.0.0.1:27021/${h.connection.name}?replicaSet=${h.setName}`,
      }),
      {
        findVisitInfo: async () => {
          await hook?.();
          if (fail) throw Error('provider failure');
          return osmVisitInfo(
            { opening_hours: 'Mo-Su 08:00-17:00', charge: '30000 VND/person' },
            'https://www.openstreetmap.org/node/123',
          );
        },
      },
    );
    try {
      await p.initialize(true);
      const actor = (
        await p.auth.models.User.create({
          emailNormalized: 'visit-admin@example.invalid',
          displayName: 'Admin',
          roles: ['admin'],
          status: 'active',
        })
      )._id;
      const customer = (
        await p.auth.models.User.create({
          emailNormalized: 'visit-user@example.invalid',
          displayName: 'User',
          roles: ['traveler'],
          status: 'active',
        })
      )._id;
      const destination = (await p.trips.models.Destination.findOne({
        provinceCode: '48',
      }))!;
      await p.trips.models.Destination.updateOne(
        { _id: destination._id },
        { $set: { publicationStatus: 'published' } },
      );
      const input: AdminPlaceInput = {
        destinationId: String(destination._id),
        name: 'Visit fixture',
        category: 'culture',
        venueType: 'place',
        description: 'Nội dung fixture có nguồn',
        locationQuery: 'Địa chỉ fixture',
        durationMinutes: 60,
        openingHoursNote: '',
        sourceUrl: 'https://www.openstreetmap.org/node/123',
        referencePrice: null,
        publicationStatus: 'draft',
        images: [fixturePhoto],
      };
      const created = (await p.catalog.write(actor, input, randomUUID())).place;
      await assert.rejects(p.visitSearch.read(customer, created.id));
      await assert.rejects(p.visitSearch.enqueue(customer, created.id));
      await p.visitSearch.enqueue(actor, created.id);
      await p.visitSearch.tick();
      assert.equal(
        (await p.visitSearch.read(actor, created.id)).state,
        'ready',
      );
      const current = (await p.catalog.read(actor, created.id)).place;
      assert.equal(current.visitInfo?.price?.amount, 30000);
      assert.equal(current.visitInfo?.price?.reviewed, false);
      assert.equal(current.referencePrice, null);
      await p.explore.models.Place.updateOne(
        { _id: created.id },
        {
          $set: {
            'source.provider': 'geoapify',
            'source.externalId': 'osm:node:123',
            'source.fetchedAt': new Date(),
            'source.attribution':
              'Powered by Geoapify · © OpenStreetMap contributors',
            'source.license': 'ODbL-1.0',
            'visitSearch.providerVersion': 1,
          },
        },
      );
      await p.visitSearch.prepare();
      assert.equal(
        (await p.visitSearch.read(actor, created.id)).state,
        'pending',
      );
      assert.equal(
        (await p.visitSearch.read(actor, created.id)).result?.price?.amount,
        30000,
      );
      await p.visitSearch.tick();
      await p.visitSearch.prepare();
      assert.equal(
        (await p.visitSearch.read(actor, created.id)).state,
        'ready',
        'upgrade queues once',
      );

      assert.equal(current.revision, created.revision);
      assert.equal(
        adminPlaceInputSchema.safeParse({
          ...input,
          visitInfo: current.visitInfo,
          publicationStatus: 'published',
        }).success,
        false,
      );
      const bulk = await p.v3.previewBulk(
        actor,
        {
          action: 'publish',
          selection: {
            mode: 'filter',
            filter: adminPlaceQuerySchema.parse({
              destinationId: String(destination._id),
              status: 'draft',
            }),
          },
        },
        randomUUID(),
      );
      assert.equal(
        bulk.eligible,
        0,
        'bulk also blocks unreviewed source facts',
      );
      const draft = { ...input, visitInfo: current.visitInfo! };
      await assert.rejects(
        p.catalog.write(
          actor,
          { ...draft, publicationStatus: 'published' },
          randomUUID(),
          created.id,
          current.revision,
          undefined,
          'publish',
        ),
      );
      const reviewed = {
        ...draft,
        visitInfo: {
          hours: { ...draft.visitInfo.hours!, reviewed: true },
          price: { ...draft.visitInfo.price!, reviewed: true },
        },
        openingHoursNote: draft.visitInfo.hours!.text,
      };
      const saved = (
        await p.catalog.write(
          actor,
          reviewed,
          randomUUID(),
          created.id,
          current.revision,
        )
      ).place;
      await p.catalog.write(
        actor,
        { ...reviewed, publicationStatus: 'published' },
        randomUUID(),
        created.id,
        saved.revision,
        undefined,
        'publish',
      );
      const publicDoc = (await p.explore.models.Place.findById(created.id))!;
      assert.equal(publicDoc.publicationStatus, 'published');
      assert.equal(publicDoc.visitInfo?.price?.reviewed, true);
      assert.equal(publicDoc.referencePrice, null);
      const publicDto = (await p.explore.read(created.id)).place;
      assert.equal(publicDto.visitInfo?.price?.amount, 30000);
      assert.equal(publicDto.referencePrice, null);

      const changed = (
        await p.catalog.write(
          actor,
          {
            ...reviewed,
            visitInfo: {
              ...reviewed.visitInfo,
              price: { ...reviewed.visitInfo.price, amount: 50000 },
            },
          },
          randomUUID(),
          created.id,
          publicDoc.revision,
        )
      ).place;
      assert.equal(
        (await p.explore.models.Place.findById(created.id))!.visitInfo!.price!
          .amount,
        30000,
      );
      assert.equal(changed.visitInfo!.price!.amount, 50000);
      const second = (
        await p.catalog.write(actor, { ...input, name: 'Second' }, randomUUID())
      ).place;
      await p.visitSearch.enqueue(actor, second.id);
      fail = true;
      await p.visitSearch.tick();
      assert.equal(
        (await p.visitSearch.read(actor, second.id)).state,
        'pending',
      );
      assert.equal(
        (await p.catalog.read(actor, second.id)).place.visitInfo,
        null,
      );
      fail = false;
      await p.explore.models.Place.updateOne(
        { _id: second.id },
        { $set: { 'visitSearch.nextAttemptAt': new Date(0) } },
      );
      hook = async () => {
        await p.explore.models.Place.updateOne(
          { _id: second.id },
          { $inc: { revision: 1 }, $set: { name: 'Changed during lookup' } },
        );
      };
      await p.visitSearch.tick();
      assert.equal((await p.visitSearch.read(actor, second.id)).result, null);
      hook = undefined;
      await p.explore.models.Place.updateOne(
        { _id: second.id },
        {
          $set: {
            fieldLocks: ['visitInfo'],
            'visitSearch.nextAttemptAt': new Date(0),
          },
        },
      );
      await p.visitSearch.tick();
      assert.equal((await p.visitSearch.read(actor, second.id)).state, 'empty');
      assert.equal(
        (await p.catalog.read(actor, second.id)).place.visitInfo,
        null,
      );
    } finally {
      await h.stop();
    }
  },
);
