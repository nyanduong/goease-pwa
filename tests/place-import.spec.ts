import { test, expect } from '@playwright/test';
import type {
  AdminPlaceDto,
  PlaceImportCandidate,
  PlaceImportPreview,
} from '@goease/contracts';
// Explicit UI fixtures. Live provider and MongoDB evidence is documented separately.
const candidate = (id: string, name: string): PlaceImportCandidate => ({
  externalId: id,
  name,
  address: `${name}, Hội An`,
  latitude: 15.88,
  longitude: 108.328,
  category: 'food',
  venueType: 'restaurant',
  categories: ['catering.cafe'],
  sourceUrl: 'https://www.openstreetmap.org/node/123',
  openingHoursNote: '',
  flags: ['missing_hours', 'unknown_price'],
  possibleDuplicates: [],
});
test('admin import UI: failure/retry, duplicate review, same-key lost response, source-safe editor and desktop layout', async ({
  page,
}) => {
  const placeId = '100000000000000000000099';
  const current: AdminPlaceDto = {
    id: placeId,
    revision: 1,
    updatedAt: '2026-10-23T10:00:00.000Z',
    destinationId: '000000000000000000000004',
    name: 'Quán mới fixture',
    category: 'food',
    venueType: 'restaurant',
    description: 'Dữ liệu UI fixture, không phải cơ sở thật.',
    locationQuery: 'Địa chỉ fixture Hội An',
    durationMinutes: 60,
    openingHoursNote: '',
    sourceUrl: 'https://www.openstreetmap.org/node/123',
    referencePrice: null,
    publicationStatus: 'draft',
    source: {
      provider: 'geoapify',
      externalId: 'osm:node:123',
      fetchedAt: '2026-10-23T10:00:00.000Z',
      attribution: 'Powered by Geoapify · © OpenStreetMap contributors',
      license: 'ODbL-1.0',
    },
  };
  const preview: PlaceImportPreview = {
    previewId: '3b7fd1e5-76f4-4a96-b7c8-888888888888',
    fetchedAt: '2026-10-23T10:00:00.000Z',
    expiresAt: '2099-12-31T10:15:00.000Z',
    received: 3,
    rejected: 0,
    duplicateExternalIds: 0,
    items: [
      candidate('osm:node:123', 'Quán mới fixture'),
      {
        ...candidate('osm:node:456', 'Quán nghi trùng fixture'),
        possibleDuplicates: ['Tên giống trong catalog'],
      },
      {
        ...candidate('osm:node:789', 'Quán đã có fixture'),
        existingPlaceId: placeId,
      },
    ],
  };
  let searches = 0;
  const commits: { key: string | undefined; body: string | null }[] = [];
  let patch: unknown;
  await page.route('**/api/v1/**', async (r) => {
    const path = new URL(r.request().url()).pathname.replace('/api/v1', '');
    const ok = (data: unknown) => r.fulfill({ json: { ok: true, data } });
    if (path === '/auth/me')
      return ok({
        user: {
          id: '300000000000000000000001',
          displayName: 'Admin fixture',
          email: 'admin@example.invalid',
          emailVerified: false,
          avatarUrl: null,
          isAdmin: true,
        },
      });
    if (path === '/admin/catalog/overview')
      return ok({
        total: 0,
        draft: 0,
        published: 0,
        archived: 0,
        complete: 0,
        needsAttention: 0,
        issues: [],
        places: [],
        mapTruncated: false,
        sources: {
          manual: 0,
          geoapify: 0,
          lastAttempt: null,
          lastSuccess: null,
          lastError: null,
        },
        jobs: { active: 0, succeeded: 0, failed: 0 },
      });
    if (path === '/admin/catalog/settings')
      return ok({
        revision: 0,
        defaultDestinationId: null,
        freshnessDays: 90,
        showQualityAlerts: true,
        autoApplyDraftHours: false,
        regions: [],
      });
    if (path === '/destinations' || path === '/admin/destinations')
      return ok({
        items: [
          {
            id: current.destinationId,
            name: 'Hội An',
            timezone: 'Asia/Ho_Chi_Minh',
          },
        ],
      });
    if (path === '/admin/places') return ok({ items: [], hasMore: false });
    if (path === '/admin/catalog/operations')
      return ok({
        connected: true,
        schedule: {
          enabled: false,
          frequency: 'weekly',
          hour: 8,
          minute: 0,
          weekday: 1,
          group: 'mixed',
          revision: 0,
          nextRunAt: null,
        },
        runs: [],
      });
    if (path === '/admin/catalog/reviews')
      return ok({ items: [], total: 0, hasMore: false });
    if (path === '/admin/place-import/preview') {
      searches++;
      expect(r.request().postDataJSON()).toEqual({
        group: 'mixed',
        limit: 50,
        destinationId: current.destinationId,
      });
      return searches === 1
        ? r.fulfill({
            status: 502,
            json: {
              ok: false,
              error: {
                code: 'GEOAPIFY_UNAVAILABLE',
                message: 'Geoapify fixture chưa phản hồi',
              },
            },
          })
        : ok(preview);
    }
    if (path === '/admin/place-import/commit') {
      commits.push({
        key: r.request().headers()['idempotency-key'],
        body: r.request().postData(),
      });
      if (commits.length === 1) return r.abort('failed');
      return ok({ placeIds: [placeId], created: 1, existing: 0 });
    }
    if (path === '/admin/places/' + placeId) {
      if (r.request().method() === 'PATCH') {
        patch = r.request().postDataJSON();
        return ok({ place: { ...current, revision: 2 } });
      }
      return ok({ place: current, history: [] });
    }
    return ok({ items: [], user: null });
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/admin');
  await page.getByRole('link', { name: 'Địa điểm', exact: true }).click();
  await page.getByLabel('Khu vực quản lý').selectOption(current.destinationId);
  await page
    .getByRole('button', { name: 'Nhập địa điểm từ Geoapify', exact: true })
    .click();
  await page.getByRole('button', { name: 'Tìm địa điểm', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText(
    'Geoapify fixture chưa phản hồi',
  );
  await page.getByRole('button', { name: 'Tìm địa điểm', exact: true }).click();
  await expect(
    page.getByRole('checkbox', { name: 'Chọn Quán mới fixture', exact: true }),
  ).toBeChecked();
  await expect(
    page.getByRole('checkbox', {
      name: 'Chọn Quán đã có fixture',
      exact: true,
    }),
  ).toBeDisabled();
  await page
    .getByRole('checkbox', {
      name: 'Chọn Quán nghi trùng fixture',
      exact: true,
    })
    .check();
  await expect(
    page.getByRole('button', { name: 'Nhập 2 bản nháp', exact: true }),
  ).toBeDisabled();
  await page
    .getByRole('checkbox', {
      name: 'Tôi đã kiểm tra các mục nghi trùng',
      exact: false,
    })
    .check();
  await expect(
    page.getByRole('button', { name: 'Nhập 2 bản nháp', exact: true }),
  ).toBeEnabled();
  await page
    .getByRole('checkbox', {
      name: 'Chọn Quán nghi trùng fixture',
      exact: true,
    })
    .uncheck();
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page
    .getByRole('button', { name: 'Nhập 1 bản nháp', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText(
    'Không kết nối được máy chủ',
  );
  await expect(
    page.getByRole('checkbox', { name: 'Chọn Quán mới fixture', exact: true }),
  ).toBeChecked();
  await page
    .getByRole('button', { name: 'Nhập 1 bản nháp', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Đã tạo 1 bản nháp' }),
  ).toBeVisible();
  expect(commits).toHaveLength(2);
  expect(commits[0]).toEqual(commits[1]);
  expect(JSON.parse(commits[0]!.body!)).toEqual({
    previewId: preview.previewId,
    externalIds: ['osm:node:123'],
    acknowledgeDuplicates: false,
  });
  await page
    .getByRole('button', { name: 'Mở bản nháp đầu tiên', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Chỉnh sửa địa điểm', exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('Tên địa điểm / quán ăn')).toHaveValue(
    current.name,
  );
  await expect(
    page.getByText('Nhập từ nguồn lúc', { exact: false }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Lưu đề xuất', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Đã lưu đề xuất' }),
  ).toContainText('Đã lưu đề xuất');
  expect(patch).toMatchObject({
    expectedRevision: 1,
    intent: 'save',
    place: { name: current.name, publicationStatus: 'draft' },
  });
  expect((patch as { place: unknown }).place).not.toHaveProperty('source');
  await page.screenshot({
    path: '.local/geoapify-ui-fixture-editor.png',
    fullPage: true,
  });
});
