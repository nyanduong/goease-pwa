import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import type { AdminPlaceInput } from '@goease/contracts';
import { createProduct } from '../src/product.js';
import { parseConfig } from '../src/config.js';
import { startTestReplicaSet } from './support/replica-set.js';
import { fixturePhoto } from './support/photo.js';
import { HttpError } from '../src/http-error.js';
test(
  'AI illustration survives publication/read/restore metadata; a later real-photo observation replaces draft fallback only',
  { timeout: 90000 },
  async () => {
    const h = await startTestReplicaSet();
    try {
      let coverUploads = 0;
      let failCover = false;
      const p = createProduct(
        h.connection,
        parseConfig({
          NODE_ENV: 'test',
          CLIENT_ORIGIN: 'http://localhost:5180',
          MONGODB_URI: `mongodb://127.0.0.1:27021/${h.connection.name}?replicaSet=${h.setName}`,
        }),
        {
          preparePlaceCover: async (image) => {
            coverUploads++;
            if (failCover)
              throw new HttpError(
                502,
                'PLACE_PHOTO_STORAGE_FAILED',
                'Fixture storage failed',
              );
            return {
              ...image,
              originalUrl: image.url,
              storage: 'cloudinary',
              url: 'https://res.cloudinary.com/fixture/image/upload/backed-cover.webp',
            };
          },
        },
      );
      await p.initialize(true);
      const actor = (
        await p.auth.models.User.create({
          emailNormalized: 'image-policy@example.invalid',
          displayName: 'Fixture',
          roles: ['admin'],
          status: 'active',
        })
      )._id;
      const d = (await p.trips.models.Destination.findOne({
        provinceCode: '48',
      }))!;
      await p.trips.models.Destination.updateOne(
        { _id: d._id },
        { $set: { publicationStatus: 'published' } },
      );
      const input: AdminPlaceInput = {
        destinationId: String(d._id),
        name: 'Gallery fixture',
        category: 'culture',
        venueType: 'place',
        description: 'Giới thiệu đủ nội dung có nguồn.',
        locationQuery: 'Đà Nẵng',
        durationMinutes: 60,
        openingHoursNote: '',
        sourceUrl: 'https://example.com/place',
        referencePrice: null,
        publicationStatus: 'draft',
        images: [
          {
            url: 'https://example.com/ai.webp',
            sourceUrl: 'https://example.com/generated',
            credit: 'GoEase AI fixture',
            license: 'owned',
            reviewed: true,
            kind: 'ai_illustration',
          },
        ],
      };
      const draft = (await p.catalog.write(actor, input, randomUUID())).place;
      assert.equal(draft.images?.[0]?.kind, 'ai_illustration');
      const pub = (
        await p.catalog.write(
          actor,
          { ...input, publicationStatus: 'published' },
          randomUUID(),
          draft.id,
          draft.revision,
          undefined,
          'publish',
        )
      ).place;
      const publicBefore = (await p.explore.read(pub.id)).place;
      assert.equal(publicBefore.images?.[0]?.kind, 'ai_illustration');
      assert.equal(publicBefore.imageUrl, input.images![0]!.url);
      const photos = Array.from({ length: 5 }, (_, i) => ({
        id: String(i),
        title: `Photo ${i}`,
        match: 'name' as const,
        image: {
          ...fixturePhoto,
          url: `https://example.com/real-${i}.webp`,
          sourceUrl: `https://example.com/source-${i}`,
          selection: 'automatic' as const,
        },
      }));
      const observation = {
        storageVersion: 2,
        state: 'ready',
        defaultCover: photos[0]!.image,
        candidates: photos,
      };
      await p.explore.models.Place.updateOne(
        { _id: pub.id },
        { $set: { imageSearch: observation } },
      );
      assert.equal(
        (await p.explore.read(pub.id)).place.images?.[0]?.kind,
        'ai_illustration',
        'published content is frozen',
      );
      const next = (
        await p.catalog.write(
          actor,
          { ...input, name: 'Draft fixture' },
          randomUUID(),
        )
      ).place;
      await p.explore.models.Place.updateOne(
        { _id: next.id },
        { $set: { imageSearch: observation } },
      );
      const effective = (await p.catalog.read(actor, next.id)).place;
      assert.equal(effective.images?.length, 5);
      assert.equal(effective.images?.[0]?.kind, undefined);
      await assert.rejects(
        p.catalog.write(
          actor,
          input,
          randomUUID(),
          next.id,
          effective.revision,
        ),
        { code: 'REAL_PHOTO_AVAILABLE' },
      );
      await p.explore.models.Place.updateOne(
        { _id: next.id },
        { $set: { fieldLocks: ['images'] } },
      );
      assert.equal(
        (await p.catalog.read(actor, next.id)).place.images?.[0]?.kind,
        'ai_illustration',
        'locked draft is preserved',
      );
      const version = await h.connection
        .collection('catalog_versions')
        .findOne({
          placeId: new (await import('mongoose')).Types.ObjectId(pub.id),
          revision: pub.revision,
        });
      assert.equal(version?.snapshot.images[0].kind, 'ai_illustration');
      const sourceInput: AdminPlaceInput = {
        ...input,
        name: 'Source cover fixture',
        images: [
          { ...fixturePhoto, storage: 'source' },
          {
            ...fixturePhoto,
            storage: 'source',
            url: 'https://upload.wikimedia.org/wikipedia/commons/b/bb/extra.png',
          },
        ],
      };
      const key = randomUUID();
      const cached = await p.catalog.write(actor, sourceInput, key);
      assert.equal(cached.place.images?.[0]?.storage, 'cloudinary');
      assert.equal(cached.place.images?.[1]?.storage, 'source');
      assert.equal(cached.place.images?.[0]?.originalUrl, fixturePhoto.url);
      await p.catalog.write(actor, sourceInput, key);
      assert.equal(
        coverUploads,
        1,
        'an idempotent retry returns the existing receipt without upload',
      );
      const raw = await p.explore.models.Place.findById(cached.place.id);
      assert.equal(raw?.images[0]?.storage, 'cloudinary');
      failCover = true;
      await assert.rejects(
        p.catalog.write(
          actor,
          { ...sourceInput, name: 'Failed cover fixture' },
          randomUUID(),
        ),
        { code: 'PLACE_PHOTO_STORAGE_FAILED' },
      );
      assert.equal(
        await p.explore.models.Place.countDocuments({
          name: 'Failed cover fixture',
        }),
        0,
        'provider failure must not persist the place',
      );
    } finally {
      await h.stop();
    }
  },
);
