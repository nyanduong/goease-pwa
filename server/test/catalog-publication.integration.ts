import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { test } from 'node:test';
import { Types } from 'mongoose';
import { type AdminPlaceInput } from '@goease/contracts';
import { fixturePhoto } from './support/photo.js';
import { startTestReplicaSet } from './support/replica-set.js';
import { authModels } from '../src/features/auth/auth.models.js';
import { businessAudit } from '../src/features/audit/business-audit.js';
import { tripService } from '../src/features/trips/trip.service.js';
import { seedDestinations } from '../src/features/trips/destination-seed.js';
import { exploreService } from '../src/features/explore/explore.service.js';
import { adminCatalog } from '../src/features/explore/admin-catalog.js';
import { adminInsights } from '../src/features/explore/admin-insights.js';
import { adminOperationsModels } from '../src/features/explore/admin-operations.models.js';
import {
  planPublicationMigration,
  applyPublicationMigration,
} from '../src/features/explore/catalog-publication-migration.js';

test(
  'publication proposals isolate public content, preserve locks, reject stale revisions and backfill safely beyond 5000',
  { timeout: 120000 },
  async (t) => {
    const harness = await startTestReplicaSet();
    const { connection } = harness;
    try {
      const audit = businessAudit(connection, 'test');
      let failAudit = false;
      const wrappedAudit = {
        ...audit,
        async append(...args: Parameters<typeof audit.append>) {
          if (failAudit) throw new Error('fixture audit failure');
          return audit.append(...args);
        },
      };
      const auth = authModels(connection);
      const trips = tripService(connection, audit);
      const explore = exploreService(connection);
      for (const model of [
        ...Object.values(auth),
        ...Object.values(trips.models),
        ...Object.values(explore.models),
      ]) {
        await model.createCollection();
        await model.createIndexes();
      }
      await audit.initialize();
      await seedDestinations(trips.models.Destination);
      const user = await auth.User.create({
        emailNormalized: 'publication@example.invalid',
        displayName: 'Publication fixture',
        roles: ['admin'],
        status: 'active',
      });
      const catalog = adminCatalog(
        connection,
        explore,
        trips,
        wrappedAudit,
        auth.User,
      );
      const insights = adminInsights(
        connection,
        catalog,
        explore,
        wrappedAudit,
      );
      const input: AdminPlaceInput = {
        destinationId: '000000000000000000000004',
        name: 'Tên công khai fixture',
        description: 'Dữ liệu kiểm thử có nguồn',
        category: 'culture',
        venueType: 'place',
        locationQuery: 'Địa chỉ fixture',
        durationMinutes: 60,
        openingHoursNote: '',
        sourceUrl: 'https://example.invalid/place',
        referencePrice: null,
        publicationStatus: 'published',
        images: [fixturePhoto],
        fieldLocks: ['name'],
      };
      const created = (await catalog.write(user._id, input, randomUUID()))
        .place;
      const id = created.id;
      assert.equal(
        (await explore.models.Place.findById(id))!.publicationStatus,
        'draft',
      );
      assert.equal(created.proposalRevision, 1);
      const published = (
        await catalog.write(
          user._id,
          input,
          randomUUID(),
          id,
          created.revision,
          undefined,
          'publish',
        )
      ).place;
      assert.equal(published.referencePrice, null);
      assert.deepEqual(published.capabilities, {
        discovery: true,
        scheduling: false,
        budgeting: false,
      });
      const archivePlanId = new Types.ObjectId();
      await connection.collection('catalog_bulk_jobs').insertOne({
        _id: archivePlanId,
        destinationId: new Types.ObjectId(input.destinationId),
        action: 'archive_destination',
        state: 'running',
      });
      await assert.rejects(
        catalog.write(
          user._id,
          input,
          randomUUID(),
          id,
          published.revision,
          undefined,
          'publish',
        ),
        /đang được lưu trữ/,
      );
      assert.equal(
        (await explore.models.Place.findById(id))!.revision,
        published.revision,
        'blocked scope publication rolls its staged proposal back',
      );
      await connection
        .collection('catalog_bulk_jobs')
        .deleteOne({ _id: archivePlanId });
      const publicBefore = (await explore.models.Place.findById(
        id,
      ))!.toObject();
      const key = randomUUID();
      const observed = {
        name: 'Nguồn cũ fixture',
        address: 'Địa chỉ fixture',
        latitude: 15.88,
        longitude: 108.328,
        category: 'culture',
        venueType: 'place',
        categories: [],
        openingHoursNote: '',
        closed: null,
        sourceUrl: input.sourceUrl,
      };
      await explore.models.Place.updateOne(
        { _id: id },
        {
          $set: {
            sourceSnapshot: observed,
            sourceCheckedAt: new Date('2026-01-01T00:00:00.000Z'),
          },
        },
        { timestamps: false },
      );
      const edit = {
        ...input,
        name: 'Tên đề xuất fixture',
        publicationStatus: 'draft' as const,
      };
      const staged = (
        await catalog.write(user._id, edit, key, id, published.revision)
      ).place;
      const latestObservedAt = new Date('2026-10-24T00:00:00.000Z');
      await explore.models.Place.updateOne(
        { _id: id },
        {
          $set: {
            sourceSnapshot: { ...observed, name: 'Nguồn mới fixture' },
            sourceCheckedAt: latestObservedAt,
          },
        },
        { timestamps: false },
      );
      const active = (await explore.models.Place.findById(id))!;
      assert.equal(active.name, input.name);
      assert.equal(active.publicationStatus, 'published');
      assert.equal(active.publicRevision, publicBefore.publicRevision);
      assert.equal((await catalog.read(user._id, id)).place.name, edit.name);
      assert.equal(
        (await catalog.read(user._id, id)).publicPlace!.name,
        input.name,
      );
      assert.equal((await explore.read(id)).place.name, input.name);
      assert.equal(
        (await explore.read(id)).place.revision,
        published.publicRevision,
      );
      assert.equal(
        (
          await explore.list({
            q: edit.name,
            destinationId: input.destinationId,
          })
        ).items.length,
        0,
        'customer search never indexes a pending proposal',
      );
      await assert.rejects(
        catalog.write(user._id, edit, randomUUID(), id, published.revision),
        /sửa ở nơi khác/,
      );
      assert.deepEqual(
        (await catalog.write(user._id, edit, key, id, published.revision))
          .place,
        staged,
      );
      const afterSaveCount = await adminOperationsModels(
        connection,
      ).Version.countDocuments({ placeId: id });
      failAudit = true;
      await assert.rejects(
        catalog.write(
          user._id,
          { ...edit, description: 'Rollback fixture' },
          randomUUID(),
          id,
          staged.revision,
        ),
        /fixture audit failure/,
      );
      failAudit = false;
      assert.equal(
        (await explore.models.Place.findById(id))!.revision,
        staged.revision,
      );
      assert.equal(
        await adminOperationsModels(connection).Version.countDocuments({
          placeId: id,
        }),
        afterSaveCount,
      );
      const restored = (
        await insights.restore(
          user._id,
          id,
          published.revision,
          staged.revision,
          randomUUID(),
        )
      ).place;
      assert.equal((await explore.models.Place.findById(id))!.name, input.name);
      assert.equal(
        restored.name,
        edit.name,
        'restoration preserves the current locked name',
      );
      assert.deepEqual(restored.fieldLocks, ['name']);
      await connection.transaction(async (session) => {
        const current =
          (await explore.models.Place.findById(id).session(session))!;
        const result = await catalog.stageInSession(
          current,
          { name: 'Tên nguồn khác', openingHoursNote: '08:00–17:00' },
          session,
          {
            origin: 'geoapify',
            reason: 'source',
            receivedAt: new Date().toISOString(),
          },
        );
        const proposal = await catalog.proposal(result, session);
        assert.equal(proposal.name, edit.name);
        assert.equal(proposal.openingHoursNote, '08:00–17:00');
        assert.ok(proposal.fieldProvenance.every((p) => p.verifiedAt === null));
      });
      const current = (await explore.models.Place.findById(id))!;
      const effective = catalog.input(await catalog.proposal(current));
      const applied = (
        await catalog.write(
          user._id,
          effective,
          randomUUID(),
          id,
          current.revision,
          undefined,
          'publish',
        )
      ).place;
      assert.equal(applied.name, edit.name);
      assert.equal(applied.proposalRevision, null);
      const appliedDoc = (await explore.models.Place.findById(id))!;
      assert.equal(appliedDoc.sourceSnapshot!.name, 'Nguồn mới fixture');
      assert.equal(
        appliedDoc.sourceCheckedAt!.toISOString(),
        latestObservedAt.toISOString(),
        'content publish does not rewind source observations received after proposal save',
      );
      assert.equal((await explore.models.Place.findById(id))!.name, edit.name);
      assert.deepEqual(
        (await catalog.write(user._id, edit, key, id, published.revision))
          .place,
        staged,
        'receipt remains original after later publish',
      );

      await t.test(
        'migration preserves public fields, reruns idempotently and rolls metadata back',
        async () => {
          const original = (await connection
            .collection('places')
            .findOne({ _id: new Types.ObjectId(id) }))!;
          const legacyId = new Types.ObjectId();
          const legacy: Record<string, unknown> & { _id: Types.ObjectId } = {
            ...original,
            _id: legacyId,
            name: 'Legacy migration fixture',
            source: {
              provider: 'geoapify',
              externalId: 'fixture:legacy',
              fetchedAt: new Date(),
              attribution: 'Powered by Geoapify · © OpenStreetMap contributors',
              license: 'ODbL-1.0',
            },
          };
          for (const field of [
            'publicationModelVersion',
            'publicRevision',
            'proposalRevision',
            'fieldLocks',
            'fieldProvenance',
          ])
            delete legacy[field];
          await connection.collection('places').insertOne(legacy);
          const plan = await planPublicationMigration(connection);
          assert.equal(plan.items.length, 1);
          assert.equal(
            (await applyPublicationMigration(connection, plan)).applied,
            1,
          );
          assert.equal(
            (await applyPublicationMigration(connection, plan)).skipped,
            1,
          );
          const migrated = (await connection
            .collection('places')
            .findOne({ _id: legacyId }))!;
          assert.equal(migrated.name, legacy.name);
          assert.deepEqual(migrated.source, legacy.source);
          assert.ok(
            migrated.fieldProvenance.every(
              (p: { verifiedAt: unknown }) => p.verifiedAt === null,
            ),
          );
          assert.equal(
            (await applyPublicationMigration(connection, plan, true)).applied,
            1,
          );
          assert.deepEqual(
            await connection.collection('places').findOne({ _id: legacyId }),
            legacy,
          );
          await connection.collection('places').deleteOne({ _id: legacyId });
        },
      );
      await t.test(
        '13200 fixture places are counted with whole-scope issue aggregation',
        async () => {
          const template = (await connection
            .collection('places')
            .findOne({ _id: new Types.ObjectId(id) }))!;
          const fixtures = Array.from({ length: 13199 }, (_, index) => ({
            ...template,
            _id: new Types.ObjectId(),
            name: `Scale fixture ${index}`,
            publicationStatus: index % 2 ? 'draft' : 'published',
          }));
          await connection.collection('places').insertMany(fixtures);
          const started = performance.now();
          const overview = await insights.overview(
            user._id,
            input.destinationId,
          );
          t.diagnostic(
            `13200-fixture overview ${Math.round(performance.now() - started)} ms on owned local MongoDB`,
          );
          assert.equal(overview.total, 13200);
          assert.equal(
            overview.issues.find((p) => p.code === 'price')?.count,
            13200,
          );
          assert.equal(overview.needsAttention, 13200);
          assert.equal(overview.sources.manual, 13200);
          assert.equal(overview.places.length, 500);
          assert.equal(overview.mapTruncated, true);
        },
      );
    } finally {
      await harness.stop();
    }
  },
);
