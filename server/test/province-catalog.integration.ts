import assert from 'node:assert/strict';
import { test } from 'node:test';
import { tripModels } from '../src/features/trips/trip.models.js';
import { businessAudit } from '../src/features/audit/business-audit.js';
import { syncProvinceCatalog } from '../src/features/trips/province-catalog.js';
import { provinces } from '../src/features/trips/province-data.js';
import { listDestinations } from '../src/features/trips/destination-catalog.js';
import { startTestReplicaSet } from './support/replica-set.js';

test(
  'fresh concurrent bootstraps converge and ambiguous legacy slugs are never overwritten',
  { timeout: 60000 },
  async () => {
    const h = await startTestReplicaSet();
    try {
      const { Destination } = tripModels(h.connection);
      await Destination.createCollection();
      await Destination.createIndexes();
      const audit = businessAudit(h.connection, 'test');
      await audit.initialize();
      const conflict = await Destination.create({
        name: 'Different meaning',
        slug: 'ha-noi',
        publicationStatus: 'draft',
        source: { provider: 'fixture', rights: { policyRef: 'fixture' } },
      });
      await assert.rejects(
        syncProvinceCatalog(h.connection, Destination, audit),
      );
      assert.equal(await Destination.countDocuments(), 1);
      assert.equal(
        (await Destination.findById(conflict._id))!.name,
        'Different meaning',
      );
      await Destination.deleteOne({ _id: conflict._id }); // Only this isolated fixture.
      await Promise.all([
        syncProvinceCatalog(h.connection, Destination, audit),
        syncProvinceCatalog(h.connection, Destination, audit),
      ]);
      assert.equal(await Destination.countDocuments(), 34);
      assert.equal(await h.connection.models.AuditLog!.countDocuments(), 34);
    } finally {
      await h.stop();
    }
  },
);

test(
  'province bootstrap preserves existing identities, rolls back on audit failure and is repeatable',
  { timeout: 60000 },
  async (t) => {
    const h = await startTestReplicaSet();
    try {
      const { Destination } = tripModels(h.connection);
      await Destination.createCollection();
      await Destination.createIndexes();
      const audit = businessAudit(h.connection, 'test');
      await audit.initialize();
      const source = { provider: 'fixture', rights: { policyRef: 'fixture' } };
      const hanoi = await Destination.create({
        name: 'Hà Nội',
        slug: 'ha-noi',
        summary: 'Existing editorial text',
        publicationStatus: 'published',
        source,
      });
      const hoian = await Destination.create({
        name: 'Hội An',
        slug: 'hoi-an',
        publicationStatus: 'published',
        source,
      });
      const Audit = h.connection.models.AuditLog!;
      const fail = t.mock.method(Audit.prototype, 'save', async () => {
        throw new Error('Injected audit failure');
      });
      await assert.rejects(
        syncProvinceCatalog(h.connection, Destination, audit),
        /Injected/,
      );
      fail.mock.restore();
      assert.equal(await Destination.countDocuments(), 2);
      assert.equal((await Destination.findById(hanoi._id))!.provinceCode, null);
      const result = await syncProvinceCatalog(
        h.connection,
        Destination,
        audit,
      );
      assert.equal(result.inserted, 33);
      assert.equal(result.adopted, 1);
      assert.equal(result.legacyRetained, 1);
      const adopted = (await Destination.findOne({ provinceCode: '01' }))!;
      assert.equal(String(adopted._id), String(hanoi._id));
      assert.equal(adopted.summary, 'Existing editorial text');
      assert.equal(adopted.publicationStatus, 'published');
      assert.equal(
        (await Destination.findById(hoian._id))!.catalogKind,
        'legacy',
      );
      assert.deepEqual(
        (await listDestinations(Destination)).items.map((d) => d.name),
        ['Hà Nội'],
      );
      assert.equal(
        (await listDestinations(Destination, {}, true)).items.length,
        34,
      );
      assert.deepEqual(
        (await listDestinations(Destination, { q: 'Sa Pa' }, true)).items.map(
          (d) => d.provinceCode,
        ),
        ['15'],
      );
      assert.deepEqual(
        (await listDestinations(Destination, { q: 'Hoi An' }, true)).items.map(
          (d) => d.provinceCode,
        ),
        ['48'],
      );
      assert.equal(
        await Destination.countDocuments({
          provinceCode: { $type: 'string' },
          publicationStatus: 'draft',
        }),
        33,
      );
      const before = await Destination.find().sort({ _id: 1 }).lean();
      const audits = await Audit.countDocuments();
      await Promise.all([
        syncProvinceCatalog(h.connection, Destination, audit),
        syncProvinceCatalog(h.connection, Destination, audit),
      ]);
      assert.deepEqual(
        await Destination.find().sort({ _id: 1 }).lean(),
        before,
      );
      assert.equal(await Audit.countDocuments(), audits);
      assert.equal(provinces.length, 34);
      assert.equal(new Set(provinces.map((p) => p.code)).size, 34);
      assert.equal(new Set(provinces.map((p) => p.slug)).size, 34);
      // A deleted administrative identity must not be re-created or silently enabled.
      await Destination.updateOne(
        { _id: hanoi._id },
        { $set: { deletedAt: new Date() } },
      );
      await syncProvinceCatalog(h.connection, Destination, audit);
      assert.equal(await Destination.countDocuments({ provinceCode: '01' }), 1);
      assert.ok((await Destination.findById(hanoi._id))!.deletedAt);
    } finally {
      await h.stop();
    }
  },
);
