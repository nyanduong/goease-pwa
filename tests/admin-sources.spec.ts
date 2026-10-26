import { test, expect } from '@playwright/test';
import type { AdminOverview, AdminSourceStatus } from '@goease/contracts';
import { mkdir } from 'node:fs/promises';

test('sources distinguish provider status from saved places, expose details and recover from errors', async ({
  page,
}) => {
  const source: AdminSourceStatus = {
    provider: 'geoapify',
    configured: true,
    checkedAt: '2026-10-25T10:05:00Z',
    lastFetchAt: '2026-10-25T10:05:00Z',
    connectionState: 'fetched',
    lastErrorCode: null,
    usage24h: { requests: 8, fetched: 8, failed: 0, received: 122 },
    providerCredits: null,
    providerBalance: null,
    maxResultsPerRun: 50,
    quota: {
      requestsPerHour: 20,
      requestsPerActorHour: 10,
      concurrentSearches: 2,
      meaning: 'fixture',
    },
    rights: { facts: 'ODbL-1.0', photos: 'separate', rawPayloadStored: false },
  };
  const overview: AdminOverview = {
    total: 40,
    draft: 39,
    published: 1,
    archived: 0,
    needsAttention: 40,
    complete: 0,
    located: 40,
    categories: [],
    issues: [
      { code: 'hours', label: 'Thiếu giờ mở cửa · dữ liệu thử', count: 12 },
    ],
    places: [],
    mapTruncated: false,
    sources: {
      manual: 0,
      geoapify: 40,
      lastAttempt: null,
      lastSuccess: null,
      lastError: null,
    },
    jobs: { active: 0, succeeded: 0, failed: 0 },
  };
  let sourceError = false;
  let overviewError = false;
  await page.route('**/api/v1/admin/v3/sources', (route) =>
    route.fulfill(
      sourceError
        ? {
            status: 503,
            json: {
              ok: false,
              error: {
                code: 'FIXTURE_UNAVAILABLE',
                message: 'Không đọc được nguồn · lỗi kiểm thử.',
              },
            },
          }
        : { json: { ok: true, data: source } },
    ),
  );
  await page.route('**/api/v1/admin/catalog/overview**', (route) =>
    route.fulfill(
      overviewError
        ? {
            status: 503,
            json: {
              ok: false,
              error: {
                code: 'FIXTURE_UNAVAILABLE',
                message: 'Không đọc được kho · lỗi kiểm thử.',
              },
            },
          }
        : { json: { ok: true, data: overview } },
    ),
  );
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/login');
  await page
    .getByLabel('Email', { exact: true })
    .fill('catalog-browser@example.invalid');
  await page
    .getByLabel('Mật khẩu', { exact: true })
    .fill('Browser-fixture-2026!');
  await page.getByRole('button', { name: /^Đăng nhập/ }).click();
  await page.getByRole('link', { name: 'Nguồn dữ liệu', exact: true }).click();
  const card = page.locator('.sources-provider-card');
  const store = page.getByRole('region', { name: 'Dữ liệu đã lưu vào GoEase' });
  await expect(card).toContainText('Đã nhận dữ liệu thành công');
  await expect(
    store.getByRole('link', { name: '40 địa điểm', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Nguồn B', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Giới hạn nội bộ', { exact: true })).toHaveCount(
    0,
  );
  await mkdir('test-results/sources-evidence', { recursive: true });
  await page.screenshot({
    path: 'test-results/sources-evidence/desktop.png',
    fullPage: true,
  });
  const detailsButton = card.getByRole('button', { name: 'Xem chi tiết' });
  await detailsButton.click();
  const dialog = page.getByRole('dialog', { name: 'Chi tiết nguồn Geoapify' });
  await expect(dialog).toContainText('122');
  await expect(dialog).toContainText('Nguồn này dùng để làm gì?');
  await expect(dialog).toContainText(
    '122 kết quả không có nghĩa là 122 địa điểm mới',
  );
  await expect(dialog).toContainText('không phải lượt khách tìm kiếm');
  await expect(
    dialog.getByRole('link', { name: 'Xem các đợt thu thập' }),
  ).toHaveAttribute('href', '#automatic');
  await expect(
    dialog.getByText('Tất cả khu vực và người dùng cộng lại'),
  ).not.toBeVisible();
  await dialog
    .getByText('GoEase được phép lấy bao nhiêu dữ liệu?', { exact: true })
    .click();
  await expect(
    dialog.getByText('Tất cả khu vực và người dùng cộng lại'),
  ).toBeVisible();
  await expect(dialog).toContainText('Không thể suy ra chi phí');
  await dialog
    .getByText('GoEase được phép lấy bao nhiêu dữ liệu?', { exact: true })
    .click();
  await page.screenshot({
    path: 'test-results/sources-evidence/details.png',
    fullPage: true,
  });
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(detailsButton).toBeFocused();
  await page
    .getByRole('button', { name: 'Kết nối nguồn', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toContainText(
    'chưa có thao tác thêm nhà cung cấp trực tiếp',
  );
  await page.getByRole('button', { name: 'Đóng', exact: true }).click();
  await page.getByRole('tab', { name: 'Các nguồn' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(
    page.getByRole('tab', { name: /Chất lượng địa điểm/ }),
  ).toHaveAttribute('aria-selected', 'true');
  await expect(
    page.getByRole('link', { name: /Thiếu giờ mở cửa/ }),
  ).toHaveAttribute('href', /quality=hours/);
  await page.getByRole('tab', { name: 'Các nguồn' }).click();

  for (const [state, label] of [
    ['not_configured', 'Chưa kết nối'],
    ['not_checked', 'Chưa kiểm chứng kết nối'],
    ['checking', 'Đang lấy dữ liệu'],
    ['permission_denied', 'Nguồn chưa cho phép truy cập'],
    ['failed', 'Lần lấy gần nhất bị lỗi'],
  ] as const) {
    source.connectionState = state;
    source.configured = state !== 'not_configured';
    await page.getByRole('button', { name: 'Làm mới', exact: true }).click();
    await expect(card).toContainText(label);
    await expect(card).not.toContainText('Đã nhận dữ liệu thành công');
  }
  sourceError = true;
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Không đọc được nguồn');
  await expect(card).toHaveCount(0);
  await expect(store).toBeVisible();
  sourceError = false;
  source.connectionState = 'fetched';
  await page.getByRole('button', { name: 'Thử tải lại nguồn' }).click();
  await expect(card).toContainText('Đã nhận dữ liệu thành công');
  overviewError = true;
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Không đọc được kho');
  await expect(card).toBeVisible();
  await expect(store).toHaveCount(0);
  overviewError = false;
  await page.getByRole('button', { name: 'Thử tải lại kho địa điểm' }).click();
  await expect(store).toBeVisible();
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(
      card.getByRole('button', { name: 'Xem chi tiết' }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/sources-evidence/mobile-${width}.png`,
      fullPage: true,
    });
    await card.getByRole('button', { name: 'Xem chi tiết' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    expect(
      await page
        .getByRole('dialog')
        .evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
    await page.keyboard.press('Escape');
  }
  Object.assign(overview, {
    total: 0,
    draft: 0,
    published: 0,
    needsAttention: 0,
    issues: [],
  });
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click();
  await expect(
    store.getByRole('link', { name: '0 địa điểm', exact: true }),
  ).toBeVisible();
  await page.getByRole('tab', { name: /Chất lượng địa điểm/ }).click();
  await expect(
    page.getByText('Kho địa điểm trong khu vực này đang trống.'),
  ).toBeVisible();

  // Restore real test-server reads; provider calls remain fixture-only.
  await page.unroute('**/api/v1/admin/v3/sources');
  await page.unroute('**/api/v1/admin/catalog/overview**');
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.getByRole('tab', { name: 'Các nguồn' }).click();
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click();
  const response = await page.request.get('/api/v1/admin/catalog/overview');
  expect(response.ok()).toBe(true);
  const realOverview = (await response.json()).data as AdminOverview;
  await expect(
    store.getByRole('link', {
      name: `${realOverview.total} địa điểm`,
      exact: true,
    }),
  ).toBeVisible();
  await expect(card).toContainText('Geoapify');
  await page.getByRole('link', { name: 'Tổng quan', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Tổng quan', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.admin-kpi').first().locator('strong')).toHaveText(
    String(realOverview.total),
  );
  await page.getByRole('link', { name: 'Cài đặt', exact: true }).click();
  await page.getByRole('tab', { name: 'Nhắc kiểm tra dữ liệu' }).click();
  await expect(
    page.getByLabel('Nhắc kiểm tra sau số ngày chưa biên tập'),
  ).toBeVisible();
});
