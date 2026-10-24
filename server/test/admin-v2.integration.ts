import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import {
  catalogToday,
  type AdminPlaceInput,
  type AdminPlaceDto,
  type AdminOverview,
  type AdminSettings,
} from '@goease/contracts';
import { createProduct } from '../src/product.js';
import { createApp } from '../src/app.js';
import { parseConfig } from '../src/config.js';
import { createLogger } from '../src/observability/logger.js';
import { seedDestinations } from '../src/features/trips/destination-seed.js';
import { startTestReplicaSet } from './support/replica-set.js';
import type { GeoapifyCandidate } from '../src/features/explore/geoapify.js';
import type { IngestionArea } from '../src/features/explore/ingestion-scope.js';

test(
  'Admin V2: database KPIs, settings, scoped ingestion, review, versions and public isolation',
  { timeout: 90000 },
  async (t) => {
    const harness = await startTestReplicaSet();
    const config = parseConfig({
      NODE_ENV: 'test',
      CLIENT_ORIGIN: 'http://localhost:5180',
      MONGODB_URI: `mongodb://127.0.0.1:27021/${harness.connection.name}?replicaSet=${harness.setName}`,
      AUTH_MAX_ATTEMPTS: '100',
    });
    let hours = '08:00–17:00',
      sourceName = 'Địa điểm nguồn kiểm thử',
      requestedArea: IngestionArea | undefined;
    const product = createProduct(harness.connection, config, {
      geoapify: async (group, _limit, area) => {
        requestedArea = area;
        const candidate: GeoapifyCandidate = {
          externalId: `osm:node:${area?.latitude === 21 ? 912 : 911}`,
          name: sourceName,
          address: 'Địa chỉ fixture',
          latitude: area?.latitude ?? 15.88,
          longitude: area?.longitude ?? 108.328,
          category: 'culture',
          venueType: 'place',
          categories: ['tourism.attraction'],
          sourceUrl: 'https://www.openstreetmap.org/node/911',
          openingHoursNote: hours,
          flags: [],
        };
        return { group, received: 1, rejected: 0, items: [candidate] };
      },
    });
    await product.initialize();
    await seedDestinations(product.trips.models.Destination);
    const server = createApp(
      config,
      async () => {},
      createLogger('test', () => {}),
      product.router,
    ).listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
    let cookie = '';
    const call = (
      path: string,
      method = 'GET',
      body?: unknown,
      key = randomUUID(),
      sessionCookie = cookie,
    ) =>
      fetch(base + path, {
        method,
        headers: {
          Origin: config.CLIENT_ORIGIN,
          'X-GoEase-Client': 'web',
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
          'Idempotency-Key': key,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    const read = async <T>(response: Response): Promise<T> => {
      const body = (await response.json()) as { data: T };
      assert.ok(response.ok, JSON.stringify(body));
      return body.data as T;
    };
    try {
      const registration = await call('/auth/register', 'POST', {
        email: 'v2@example.invalid',
        password: 'Fixture-admin-V2-2026!',
        displayName: 'Admin fixture',
      });
      assert.equal(registration.status, 201);
      cookie = registration.headers.get('set-cookie')!.split(';')[0]!;
      for (const path of [
        '/admin/catalog/overview',
        '/admin/catalog/settings',
        '/admin/places/000000000000000000000004/versions',
      ])
        assert.equal((await call(path)).status, 403);
      const actor = (await product.auth.models.User.findOne({
        emailNormalized: 'v2@example.invalid',
      }))!._id;
      await product.auth.models.User.updateOne(
        { _id: actor },
        { $set: { roles: ['traveler', 'admin'] } },
      );
      let input: AdminPlaceInput = {
        destinationId: '000000000000000000000004',
        name: 'Điểm kiểm thử V2',
        category: 'culture',
        venueType: 'place',
        description: 'Mô tả fixture',
        locationQuery: 'Địa chỉ fixture Hội An',
        durationMinutes: 60,
        openingHoursNote: '08:00–17:00',
        sourceUrl: 'https://example.com/fixture',
        referencePrice: null,
        publicationStatus: 'draft',
        internalNote: 'Ghi chú riêng không công khai',
      };
      let place: AdminPlaceDto;
      await t.test(
        'KPIs and filters come from stored places; secrets and internal notes stay private',
        async () => {
          assert.equal(
            (await read<AdminOverview>(await call('/admin/catalog/overview')))
              .total,
            0,
          );
          place = (
            await read<{ place: AdminPlaceDto }>(
              await call('/admin/places', 'POST', { place: input }),
            )
          ).place;
          const stats = await read<AdminOverview>(
            await call('/admin/catalog/overview'),
          );
          assert.equal(stats.total, 1);
          assert.equal(stats.draft, 1);
          assert.equal(stats.published, 0);
          assert.equal(stats.needsAttention, 1);
          assert.equal(
            (
              await read<{ total: number }>(
                await call('/admin/places?quality=price'),
              )
            ).total,
            1,
          );
          assert.equal(
            (
              await read<{ total: number }>(
                await call('/admin/places?category=nature'),
              )
            ).total,
            0,
          );
          assert.equal(
            (
              await read<AdminOverview>(
                await call(
                  '/admin/catalog/overview?destinationId=000000000000000000000003',
                ),
              )
            ).total,
            0,
          );
          assert.equal(
            (await call('/admin/catalog/overview?destinationId=invalid'))
              .status,
            400,
          );
          assert.equal(
            (
              await call(
                '/admin/catalog/overview',
                'GET',
                undefined,
                randomUUID(),
                '',
              )
            ).status,
            401,
          );
        },
      );
      await t.test(
        'quality drill-down excludes archived records consistently with dashboard',
        async () => {
          await read(
            await call('/admin/places', 'POST', {
              place: {
                ...input,
                name: 'Bản lưu trữ fixture',
                publicationStatus: 'archived',
              },
            }),
          );
          const list = await read<{ items: AdminPlaceDto[]; total: number }>(
            await call('/admin/places?quality=price'),
          );
          assert.equal(list.total, 1);
          assert.equal(list.items[0]?.id, place.id);
        },
      );
      await t.test(
        'publish, version snapshots, restore to draft and stale restore conflict',
        async () => {
          input = {
            ...input,
            referencePrice: {
              label: 'Vé fixture',
              amountMinor: 10000,
              basis: 'per_person',
              maxTravelers: 10,
              conditions: 'Fixture',
              inclusions: 'Vào cửa',
              exclusions: 'Dịch vụ thêm',
              sourceUrl: 'https://example.com/fixture',
              checkedAt: catalogToday(),
              reviewAfter: '2099-01-01',
            },
            publicationStatus: 'published',
          };
          place = (
            await read<{ place: AdminPlaceDto }>(
              await call(`/admin/places/${place.id}`, 'PATCH', {
                place: input,
                expectedRevision: place.revision,
              }),
            )
          ).place;
          const publicResponse = await call(`/places/${place.id}`);
          assert.equal(publicResponse.status, 200);
          assert.ok(!(await publicResponse.text()).includes('Ghi chú riêng'));
          const versions = await read<{ items: { revision: number }[] }>(
            await call(`/admin/places/${place.id}/versions`),
          );
          assert.deepEqual(
            versions.items.map((v) => v.revision),
            [2, 1],
          );
          const key = randomUUID(),
            body = { revision: 1, expectedRevision: 2 };
          place = (
            await read<{ place: AdminPlaceDto }>(
              await call(
                `/admin/places/${place.id}/restore`,
                'POST',
                body,
                key,
              ),
            )
          ).place;
          assert.equal(place.revision, 3);
          assert.equal(place.publicationStatus, 'draft');
          assert.equal(place.referencePrice, null);
          assert.equal((await call(`/places/${place.id}`)).status, 404);
          assert.equal(
            (
              await read<{ place: AdminPlaceDto }>(
                await call(
                  `/admin/places/${place.id}/restore`,
                  'POST',
                  body,
                  key,
                ),
              )
            ).place.revision,
            3,
          );
          assert.equal(
            (await call(`/admin/places/${place.id}/restore`, 'POST', body))
              .status,
            409,
          );
          assert.equal(
            await harness.connection
              .collection('catalog_versions')
              .countDocuments({
                placeId: new (await import('mongoose')).Types.ObjectId(
                  place.id,
                ),
              }),
            3,
          );
        },
      );
      await t.test(
        'restore audit, gallery attribution and address changes protect stale coordinates',
        async () => {
          assert.equal(
            await harness.connection.collection('audit_logs').countDocuments({
              entityId: place.id,
              action: 'catalog.restored',
            }),
            1,
          );
          input = {
            ...input,
            publicationStatus: 'published',
            mapLocation: {
              latitude: 15.88,
              longitude: 108.328,
              label: 'Vị trí fixture',
              precision: 'area',
              sourceUrl: 'https://example.com/fixture',
              checkedAt: catalogToday(),
            },
            images: [
              {
                url: 'https://example.com/photo.jpg',
                credit: 'Ảnh fixture có phép',
                license: 'permission',
                sourceUrl: 'https://example.com/permission',
              },
            ],
          };
          place = (
            await read<{ place: AdminPlaceDto }>(
              await call(`/admin/places/${place.id}`, 'PATCH', {
                place: input,
                expectedRevision: place.revision,
              }),
            )
          ).place;
          const publicPlace = await (await call(`/places/${place.id}`)).text();
          assert.ok(publicPlace.includes('Ảnh fixture có phép'));
          assert.ok(!publicPlace.includes('Ghi chú riêng'));
          input = {
            ...input,
            locationQuery: 'Địa chỉ đã đổi, cần chọn lại vị trí',
          };
          place = (
            await read<{ place: AdminPlaceDto }>(
              await call(`/admin/places/${place.id}`, 'PATCH', {
                place: input,
                expectedRevision: place.revision,
              }),
            )
          ).place;
          assert.equal(place.mapLocation, null);
        },
      );
      await t.test(
        'ignore requires reason and preserves published place; revise stays open until approval',
        async () => {
          const work = (await product.operations.reviews(actor)).items.find(
            (r) => r.place.id === place.id && r.kind === 'quality',
          )!;
          assert.ok(work);
          await assert.rejects(
            product.operations.decide(
              actor,
              work.id,
              {
                expectedRevision: work.revision,
                expectedPlaceRevision: work.place.revision,
                decision: 'ignore',
              },
              randomUUID(),
            ),
          );
          await product.operations.decide(
            actor,
            work.id,
            {
              expectedRevision: work.revision,
              expectedPlaceRevision: work.place.revision,
              decision: 'revise',
              note: 'Cần đối chiếu vị trí',
            },
            randomUUID(),
          );
          const revised = (await product.operations.reviews(actor)).items.find(
            (r) => r.id === work.id,
          )!;
          assert.ok(revised);
          await product.operations.decide(
            actor,
            revised.id,
            {
              expectedRevision: revised.revision,
              expectedPlaceRevision: revised.place.revision,
              decision: 'ignore',
              note: 'Giữ địa chỉ biên tập, chưa dùng tọa độ',
            },
            randomUUID(),
          );
          const current = await product.explore.models.Place.findById(place.id);
          assert.equal(current?.publicationStatus, 'published');
          assert.equal(current?.name, place.name);
          assert.equal(
            (await product.operations.reviews(actor)).items.some(
              (r) => r.id === work.id,
            ),
            false,
          );
          assert.equal(
            await harness.connection
              .collection('catalog_decisions')
              .countDocuments({
                reviewId: new (await import('mongoose')).Types.ObjectId(
                  work.id,
                ),
              }),
            2,
          );
        },
      );
      await t.test(
        'approval can publish a complete draft and persists decision and version',
        async () => {
          const draft = (
            await read<{ place: AdminPlaceDto }>(
              await call('/admin/places', 'POST', {
                place: {
                  ...input,
                  name: 'Địa điểm chấp thuận fixture',
                  mapLocation: null,
                  publicationStatus: 'draft',
                },
              }),
            )
          ).place;
          const review = (await product.operations.reviews(actor)).items.find(
            (r) => r.place.id === draft.id && r.kind === 'draft',
          )!;
          await product.operations.decide(
            actor,
            review.id,
            {
              expectedRevision: review.revision,
              expectedPlaceRevision: review.place.revision,
              decision: 'keep',
              publish: true,
              note: 'Đã đối chiếu fixture',
            },
            randomUUID(),
          );
          assert.equal((await call(`/places/${draft.id}`)).status, 200);
          assert.equal(
            await harness.connection
              .collection('catalog_decisions')
              .countDocuments({
                reviewId: new (await import('mongoose')).Types.ObjectId(
                  review.id,
                ),
                published: true,
              }),
            1,
          );
        },
      );
      let settings: AdminSettings;
      await t.test(
        'operational settings persist with revision protection and unconfigured areas cannot run',
        async () => {
          settings = await read<AdminSettings>(
            await call('/admin/catalog/settings'),
          );
          assert.equal(
            (
              await call('/admin/catalog/run', 'POST', {
                destinationId: '000000000000000000000003',
              })
            ).status,
            400,
          );
          const { revision, ...fields } = settings;
          const body = {
            ...fields,
            expectedRevision: revision,
            freshnessDays: 45,
            autoApplyDraftHours: true,
            defaultDestinationId: '000000000000000000000003',
            regions: [
              {
                destinationId: '000000000000000000000003',
                latitude: 21,
                longitude: 105.8,
                radiusMeters: 1000,
                enabled: true,
              },
            ],
          };
          settings = await read<AdminSettings>(
            await call('/admin/catalog/settings', 'PUT', body),
          );
          assert.equal(settings.revision, 1);
          assert.equal(
            (await call('/admin/catalog/settings', 'PUT', body)).status,
            409,
          );
          assert.equal(
            (await read<AdminSettings>(await call('/admin/catalog/settings')))
              .freshnessDays,
            45,
          );
          assert.equal(
            (
              await call('/admin/catalog/settings', 'PUT', {
                ...body,
                expectedRevision: 1,
                freshnessDays: 0,
              })
            ).status,
            400,
          );
        },
      );
      await t.test(
        'configured region passes its bounded area to source; imports use its destination',
        async () => {
          await read(
            await call('/admin/catalog/run', 'POST', {
              destinationId: '000000000000000000000003',
            }),
          );
          await product.operations.tick();
          assert.deepEqual(requestedArea, {
            latitude: 21,
            longitude: 105.8,
            radiusMeters: 1000,
          });
          const p = await product.explore.models.Place.findOne({
            'source.externalId': 'osm:node:912',
          });
          assert.equal(String(p?.destinationId), '000000000000000000000003');
          const stats = await read<AdminOverview>(
            await call(
              '/admin/catalog/overview?destinationId=000000000000000000000003',
            ),
          );
          assert.equal(stats.total, 1);
          assert.equal(stats.jobs.succeeded, 1);
        },
      );
      await t.test(
        'low risk hours auto-apply only on unedited drafts; identity conflict goes to review and reject preserves data',
        async () => {
          const run = async () => {
            await product.operations.enqueue(actor, randomUUID());
            await product.operations.tick();
          };
          await run();
          const p = (await product.explore.models.Place.findOne({
            'source.externalId': 'osm:node:911',
          }))!;
          hours = '09:00–18:00';
          await run();
          assert.equal(
            (await product.explore.models.Place.findById(p._id))
              ?.openingHoursNote,
            hours,
          );
          assert.equal(
            await product.operations.models.Review.countDocuments({
              placeId: p._id,
              kind: 'source',
              state: 'open',
            }),
            0,
          );
          sourceName = 'Tên mới từ nguồn';
          await run();
          const work = (await product.operations.reviews(actor)).items.find(
            (r) => r.place.id === String(p._id) && r.kind === 'source',
          )!;
          assert.ok(work);
          assert.equal(work.place.name, 'Địa điểm nguồn kiểm thử');
          await assert.rejects(
            product.operations.decide(
              actor,
              work.id,
              {
                expectedRevision: work.revision,
                expectedPlaceRevision: work.place.revision,
                decision: 'reject',
              },
              randomUUID(),
            ),
          );
          await product.operations.decide(
            actor,
            work.id,
            {
              expectedRevision: work.revision,
              expectedPlaceRevision: work.place.revision,
              decision: 'reject',
              note: 'Nguồn chưa đủ bằng chứng',
            },
            randomUUID(),
          );
          assert.equal(
            (await product.explore.models.Place.findById(p._id))?.name,
            'Địa điểm nguồn kiểm thử',
          );
          await run();
          assert.equal(
            (await product.operations.reviews(actor)).items.filter(
              (r) => r.id === work.id,
            ).length,
            0,
          );
          const savedDecision = await product.operations.models.Review.findById(
            work.id,
          );
          assert.equal(String(savedDecision?.decidedBy), String(actor));
          assert.equal(savedDecision?.decisionNote, 'Nguồn chưa đủ bằng chứng');
        },
      );
    } finally {
      await product.operations.stop();
      await new Promise<void>((resolve, reject) =>
        server.close((e) => (e ? reject(e) : resolve())),
      );
      await harness.stop();
    }
  },
);
