import { visitContext } from '../src/features/explore/visit-info-provider.js';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import {
  catalogCost,
  catalogToday,
  visitPriceLabel,
  type AdminPlaceInput,
  type TripInput,
  type VisitInfo,
} from '@goease/contracts';
import { createProduct } from '../src/product.js';
import { parseConfig } from '../src/config.js';
import { calculateBudget } from '../src/features/trips/budget.js';
import { startTestReplicaSet } from './support/replica-set.js';
import { fixturePhoto } from './support/photo.js';
test(
  'one price: derived server projection, public revision isolation, real trip budget and stale/unknown protections',
  { timeout: 90000 },
  async () => {
    const h = await startTestReplicaSet();
    try {
      const p = createProduct(
        h.connection,
        parseConfig({
          NODE_ENV: 'test',
          CLIENT_ORIGIN: 'http://localhost:5180',
          MONGODB_URI: `mongodb://127.0.0.1:27021/${h.connection.name}?replicaSet=${h.setName}`,
        }),
      );
      await p.initialize(true);
      const actor = (
        await p.auth.models.User.create({
          emailNormalized: 'single-price-admin@example.invalid',
          displayName: 'Admin',
          roles: ['admin'],
          status: 'active',
        })
      )._id;
      const user = (
        await p.auth.models.User.create({
          emailNormalized: 'single-price-user@example.invalid',
          displayName: 'User',
          roles: ['traveler'],
          status: 'active',
        })
      )._id;
      const dest = (await p.trips.models.Destination.findOne({
        provinceCode: '48',
      }))!;
      await p.trips.models.Destination.updateOne(
        { _id: dest._id },
        { $set: { publicationStatus: 'published' } },
      );
      const price: NonNullable<VisitInfo['price']> = {
        amount: 40000,
        currency: 'VND',
        unit: 'person',
        conditions: 'Vé tham quan người lớn',
        sourceUrl: 'https://example.com/ticket',
        observedAt: new Date().toISOString(),
        reviewed: true,
        terms: {
          audience: 'standard',
          inclusions: 'Vé vào cửa',
          exclusions: 'Hướng dẫn viên',
          checkedAt: catalogToday(),
          reviewAfter: '2099-12-31',
        },
      };
      const input: AdminPlaceInput = {
        destinationId: String(dest._id),
        name: 'Unified price fixture',
        category: 'culture',
        venueType: 'place',
        description: 'Fixture về giá có nguồn',
        locationQuery: 'Địa chỉ fixture',
        durationMinutes: 60,
        openingHoursNote: '08:00–17:00',
        sourceUrl: 'https://example.com/place',
        publicationStatus: 'draft',
        referencePrice: null,
        visitInfo: { pricingVersion: 1, hours: null, price },
        images: [fixturePhoto],
      };
      await assert.rejects(p.catalog.write(user, input, randomUUID()), {
        code: 'ADMIN_REQUIRED',
      });
      const created = (await p.catalog.write(actor, input, randomUUID())).place;
      assert.equal(created.referencePrice?.amountMinor, 40000);
      const forged = {
        ...input,
        publicationStatus: 'published' as const,
        referencePrice: { ...created.referencePrice!, amountMinor: 1 },
      };
      const published = (
        await p.catalog.write(
          actor,
          forged,
          randomUUID(),
          created.id,
          created.revision,
          undefined,
          'publish',
        )
      ).place;
      const publicPlace = (await p.explore.read(created.id)).place;
      assert.equal(publicPlace.referencePrice?.amountMinor, 40000);
      assert.equal(publicPlace.visitInfo?.pricingVersion, 1);
      assert.equal(
        visitPriceLabel(publicPlace.visitInfo!.price!),
        'Từ 40.000đ/người',
      );
      const trip: TripInput = {
        title: 'Single price fixture',
        destinations: [{ destinationId: String(dest._id), order: 0 }],
        startDate: catalogToday(),
        endDate: catalogToday(),
        timezone: 'Asia/Ho_Chi_Minh',
        travelers: { totalCount: 2 },
        budget: {
          amountMinor: null,
          currency: 'VND',
          scope: 'group_total',
          includedCategories: [],
        },
        preferences: {
          interestCodes: [],
          pace: 'balanced',
          transportModes: [],
        },
        generationMode: 'manual',
        notes: '',
        days: [
          {
            dayId: randomUUID(),
            date: catalogToday(),
            destinationId: String(dest._id),
            activities: [
              {
                activityId: randomUUID(),
                placeId: created.id,
                title: input.name,
                kind: 'visit',
                timezone: 'Asia/Ho_Chi_Minh',
                order: 0,
                notes: '',
                source: 'manual',
                estimatedCost: catalogCost(publicPlace),
              },
            ],
          },
        ],
      };
      assert.equal(calculateBudget(trip).knownEstimatedMinor, 80000);
      const saved = (await p.trips.save(user, trip, undefined, randomUUID()))
        .trip;
      assert.equal(saved.budgetSummary?.knownEstimatedMinor, 80000);
      const dirty = {
        ...input,
        visitInfo: {
          ...input.visitInfo!,
          price: { ...price, amount: 90000, reviewed: false },
        },
      };
      const proposal = (
        await p.catalog.write(
          actor,
          dirty,
          randomUUID(),
          created.id,
          published.revision,
        )
      ).place;
      assert.equal(proposal.referencePrice, null);
      assert.equal(
        (await p.explore.read(created.id)).place.referencePrice?.amountMinor,
        40000,
      );
      assert.equal(
        (await p.trips.read(saved.id, user)).trip.budgetSummary
          ?.knownEstimatedMinor,
        80000,
      );
      await assert.rejects(
        p.catalog.write(
          actor,
          { ...dirty, publicationStatus: 'published' },
          randomUUID(),
          created.id,
          proposal.revision,
          undefined,
          'publish',
        ),
      );
      const displayOnly = {
        ...input,
        publicationStatus: 'published' as const,
        visitInfo: {
          ...input.visitInfo!,
          price: { ...price, unit: 'item' as const, reviewed: true },
        },
      };
      const item = (
        await p.catalog.write(
          actor,
          displayOnly,
          randomUUID(),
          created.id,
          proposal.revision,
          undefined,
          'publish',
        )
      ).place;
      assert.equal(item.referencePrice, null);
      assert.equal(item.visitInfo?.price?.amount, 40000);
      assert.equal(
        catalogCost((await p.explore.read(created.id)).place).amountMinor,
        null,
      );
      await assert.rejects(
        p.trips.save(
          user,
          { ...trip, title: 'Stale new trip' },
          undefined,
          randomUUID(),
        ),
        { code: 'CATALOG_PRICE_CHANGED' },
      );
      assert.equal(
        (await p.trips.read(saved.id, user)).trip.budgetSummary
          ?.knownEstimatedMinor,
        80000,
      );
      const group = {
        ...input,
        publicationStatus: 'published' as const,
        visitInfo: {
          ...input.visitInfo!,
          price: {
            ...price,
            amount: 300000,
            unit: 'group' as const,
            terms: { ...price.terms, minTravelers: 2, maxTravelers: 4 },
          },
        },
      };
      await p.catalog.write(
        actor,
        group,
        randomUUID(),
        created.id,
        item.revision,
        undefined,
        'publish',
      );
      const groupCost = catalogCost((await p.explore.read(created.id)).place);
      trip.days[0]!.activities[0]!.estimatedCost = groupCost;
      assert.equal(calculateBudget(trip).knownEstimatedMinor, 300000);
      trip.travelers.totalCount = 5;
      assert.equal(calculateBudget(trip).missingCostCount, 1);
      const locked = (
        await p.catalog.write(
          actor,
          {
            ...input,
            name: 'Locked source price fixture',
            visitInfo: null,
            referencePrice: null,
            fieldLocks: ['referencePrice'],
          },
          randomUUID(),
        )
      ).place;
      await p.explore.models.Place.updateOne(
        { _id: locked.id },
        {
          $set: {
            visitSearch: {
              state: 'ready',
              context: visitContext({
                name: 'Locked source price fixture',
                sourceUrl: input.sourceUrl,
                destinationName: dest.name,
              }),
              result: {
                hours: null,
                price: { ...price, reviewed: false, terms: undefined },
              },
            },
          },
        },
      );
      const lockedRead = (await p.catalog.read(actor, locked.id)).place;
      assert.equal(
        lockedRead.visitInfo?.price,
        null,
        'locked price cannot be filled from source defaults',
      );
      assert.equal(lockedRead.referencePrice, null);
    } finally {
      await h.stop();
    }
  },
);
