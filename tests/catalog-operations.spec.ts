import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

test('new operator uses real catalog API/MongoDB at desktop sizes and 125% zoom', async ({
  page,
  context,
}) => {
  test.setTimeout(120000);
  await mkdir('test-results/catalog-evidence', { recursive: true });
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/login');
  await page
    .getByLabel('Email', { exact: true })
    .fill('catalog-browser@example.invalid');
  await page
    .getByLabel('Mật khẩu', { exact: true })
    .fill('Browser-fixture-2026!');
  await page.getByRole('button', { name: /^Đăng nhập/ }).click();
  await expect(
    page.getByRole('heading', { name: 'Xin chào, Admin!' }),
  ).toBeVisible();
  await expect(page.locator('.admin-kpi').first()).toContainText('4');
  await page.screenshot({
    path: 'test-results/catalog-evidence/00-dashboard-1366.png',
    fullPage: true,
  });
  await page.getByRole('link', { name: 'Việc cần làm', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Việc cần làm', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: /Thông tin nguồn thay đổi/ }),
  ).toBeVisible();
  expect(
    (await page.locator('.admin-work-row h3').first().boundingBox())!.width,
  ).toBeGreaterThan(250);
  expect(
    (await page.locator('.admin-work-row').first().boundingBox())!.height,
  ).toBeLessThan(250);
  await page.screenshot({
    path: 'test-results/catalog-evidence/01-work-1366.png',
    fullPage: true,
  });
  await page
    .getByRole('article')
    .filter({ hasText: 'Quán An đã biên tập' })
    .getByRole('button', { name: 'Xem và quyết định' })
    .click();
  await expect(
    page.getByRole('cell', {
      name: 'Địa chỉ nguồn mới, Hội An · dữ liệu thử',
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page.getByText('Giữ phần đã biên tập', { exact: true }).first(),
  ).toBeVisible();
  await page.screenshot({
    path: 'test-results/catalog-evidence/02-compare-1366.png',
    fullPage: true,
  });
  await page
    .getByRole('button', { name: 'Áp dụng thay đổi', exact: true })
    .click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Đã áp dụng' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Địa điểm', exact: true }).click();
  await page.getByLabel('Tìm trong danh mục').fill('thử');
  await expect(
    page.getByRole('heading', {
      name: 'Quán An đã biên tập · dữ liệu thử',
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole('checkbox', { name: /Chọn các địa điểm trên trang/ })
    .check();
  await page
    .getByRole('button', { name: 'Xem trước để đăng', exact: true })
    .click();
  await expect(
    page.getByText('1/4 mục đủ điều kiện.', { exact: false }),
  ).toBeVisible();
  await expect(
    page
      .getByText('Cần quyết định thông tin nguồn hoặc nghi trùng trước.', {
        exact: false,
      })
      .first(),
  ).toBeVisible();
  await page.screenshot({
    path: 'test-results/catalog-evidence/03-batch-preview.png',
    fullPage: true,
  });
  await page
    .getByRole('button', { name: 'Đăng các mục đủ điều kiện', exact: true })
    .click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Đã hoàn tất 1/4' }),
  ).toBeVisible();
  const published = await page.request.get(
    '/api/v1/places?destinationId=000000000000000000000004',
  );
  expect(published.ok()).toBe(true);
  const body = await published.json();
  expect(JSON.stringify(body)).toContain('Vườn Cẩm');
  expect(JSON.stringify(body)).not.toContain('Quán Bình');
  await page
    .getByRole('link', { name: 'Tự động cập nhật', exact: true })
    .click();
  await page.getByLabel('Tần suất').selectOption('weekly');
  await page.getByLabel('Ngày trong tuần').selectOption('1');
  await page.getByLabel('Giờ chạy · Việt Nam').fill('08:30');
  await page
    .getByRole('button', { name: 'Lưu và bật tự động', exact: true })
    .click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Đã lưu và bật' }),
  ).toBeVisible();
  await expect(
    page.getByText('Lần chạy tiếp theo:', { exact: false }),
  ).not.toContainText('Chưa bật lịch');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({
    path: 'test-results/catalog-evidence/04-schedule-1440.png',
    fullPage: true,
  });
  await page.reload();
  await expect(page.getByLabel('Giờ chạy · Việt Nam')).toHaveValue('08:30');
  await page.getByRole('button', { name: 'Chạy ngay', exact: true }).click();
  await expect(
    page.getByText('Sẽ tự thử lại', { exact: true }).first(),
  ).toBeVisible({ timeout: 25000 });
  const latest = page.locator('.admin-run').first();
  await latest.locator('> summary').click();
  await expect(
    latest.getByText('Tự thử lại lúc', { exact: false }),
  ).toBeVisible();
  await page.screenshot({
    path: 'test-results/catalog-evidence/05-source-retry.png',
    fullPage: true,
  });
  await page
    .getByRole('button', { name: 'Tạm dừng tự động', exact: true })
    .click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Đã tạm dừng' }),
  ).toBeVisible();
  // Match browser zoom: smaller CSS viewport AND higher pixel ratio, including media queries.
  const cdp = await context.newCDPSession(page);
  for (const zoom of [1, 1.25]) {
    for (const viewport of [
      { width: 1366, height: 768 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize({
        width: Math.floor(viewport.width / zoom),
        height: Math.floor(viewport.height / zoom),
      });
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: Math.floor(viewport.width / zoom),
        height: Math.floor(viewport.height / zoom),
        deviceScaleFactor: zoom,
        mobile: false,
      });
      for (const tab of [
        'Việc cần làm',
        'Địa điểm',
        'Tự động cập nhật',
        'Lịch sử & phê duyệt',
      ]) {
        await page
          .getByRole('navigation', { name: 'Quản trị danh mục' })
          .getByRole('link', { name: tab, exact: true })
          .click();
        await expect(page.locator('main')).toBeVisible();
        if (tab === 'Việc cần làm')
          await expect(page.locator('.admin-overview')).toBeVisible();
        if (tab === 'Tự động cập nhật')
          await expect(page.getByLabel('Tần suất')).toBeVisible();
        if (tab === 'Lịch sử & phê duyệt')
          await expect(
            page.getByRole('heading', { name: 'Quyết định và thay đổi' }),
          ).toBeVisible();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth + 1,
          ),
        ).toBe(true);
        await page.screenshot({
          path: `test-results/catalog-evidence/${zoom === 1 ? 'normal' : 'zoom'}-${viewport.width}-${tab === 'Việc cần làm' ? 'work' : tab === 'Địa điểm' ? 'places' : tab === 'Lịch sử & phê duyệt' ? 'history' : 'automatic'}.png`,
          fullPage: true,
        });
      }
    }
  }
  await page.getByRole('link', { name: 'Địa điểm', exact: true }).click();
  await page
    .getByRole('button', {
      name: 'Chỉnh sửa Vườn Cẩm · dữ liệu thử',
      exact: true,
    })
    .click();
  await expect(
    page.getByLabel('Tên địa điểm / quán ăn', { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: 'test-results/catalog-evidence/06-editor-125.png',
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
  await page
    .getByRole('button', { name: '← Về danh sách', exact: true })
    .click();
  await page.getByRole('link', { name: 'Việc cần làm', exact: true }).click();
  const duplicate = page
    .getByRole('article')
    .filter({ hasText: 'Quán Bình' })
    .first();
  await duplicate.getByRole('button', { name: 'Xem và quyết định' }).click();
  await page.getByRole('button', { name: 'Để sau', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Đã hẹn xem lại' }),
  ).toBeVisible();
  // The session and data are real; no browser route mocks or live-provider claims.
  expect((await context.cookies()).some((c) => c.httpOnly)).toBe(true);
});

test('V2 dashboard, filters, editor autosave, sources and persisted settings use real APIs', async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/login');
  await page
    .getByLabel('Email', { exact: true })
    .fill('catalog-browser@example.invalid');
  await page
    .getByLabel('Mật khẩu', { exact: true })
    .fill('Browser-fixture-2026!');
  await page.getByRole('button', { name: /^Đăng nhập/ }).click();
  await expect(
    page.getByRole('heading', { name: 'Xin chào, Admin!' }),
  ).toBeVisible();
  const response = await page.request.get('/api/v1/admin/catalog/overview');
  const overview = (await response.json()).data;
  await expect(page.locator('.admin-kpi').first().locator('strong')).toHaveText(
    String(overview.total),
  );
  await expect(
    page.locator('.admin-navigation [aria-current="page"]'),
  ).toHaveCount(1);
  await page
    .getByLabel('Khu vực quản lý')
    .selectOption('000000000000000000000003');
  await expect(
    page.getByRole('heading', { name: 'Bắt đầu xây dựng danh mục' }),
  ).toBeVisible();
  await page
    .getByLabel('Khu vực quản lý')
    .selectOption('000000000000000000000004');
  await page
    .getByRole('link', { name: 'Thêm địa điểm mới Tạo bản nháp có nguồn' })
    .click();
  await page
    .getByLabel('Tên địa điểm / quán ăn', { exact: true })
    .fill('Địa điểm V2 giao diện fixture');
  await page
    .getByLabel('Giới thiệu ngắn')
    .fill('Nội dung dành riêng cho kiểm thử giao diện.');
  await page
    .getByLabel('Địa chỉ / vị trí tìm trên bản đồ')
    .fill('Địa chỉ kiểm thử Hội An');
  await page
    .getByLabel('Link nguồn thông tin')
    .fill('https://example.com/ui-fixture');
  await page.getByLabel('Vĩ độ', { exact: true }).fill('15.88');
  await page.getByLabel('Kinh độ', { exact: true }).fill('108.328');
  await page
    .getByLabel('Chỉ quản trị viên nhìn thấy')
    .fill('Ghi chú kiểm thử riêng');
  await page.getByRole('button', { name: 'Lưu bản nháp', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Đã lưu bản nháp' }),
  ).toBeVisible();
  await page.getByLabel('Tự lưu bản nháp hợp lệ sau 2 giây').check();
  await page
    .getByLabel('Tên địa điểm / quán ăn', { exact: true })
    .fill('Địa điểm V2 đã tự lưu fixture');
  await expect(
    page.getByRole('status').filter({ hasText: 'Đã lưu bản nháp' }),
  ).toBeVisible({ timeout: 10000 });
  const result = await page.request.get('/api/v1/admin/places?q=V2');
  expect((await result.json()).data.items[0].name).toBe(
    'Địa điểm V2 đã tự lưu fixture',
  );
  await page.screenshot({
    path: 'test-results/catalog-evidence/v2-editor.png',
    fullPage: true,
  });
  await page
    .getByRole('button', { name: '← Về danh sách', exact: true })
    .click();
  await page.getByLabel('Tìm trong danh mục').fill('V2');
  await expect(page.locator('.admin-data-table tbody tr')).toHaveCount(1);
  await page.getByRole('button', { name: 'Xem bản đồ', exact: true }).click();
  await expect(page.locator('.admin-map-marker')).toHaveCount(1);
  // Global no-referrer stays in place; map tiles identify only the app origin.
  await expect(page.locator('.leaflet-tile').first()).toHaveAttribute(
    'referrerpolicy',
    'origin',
  );
  await page.screenshot({
    path: 'test-results/catalog-evidence/v2-map.png',
    fullPage: true,
  });
  await page.getByRole('link', { name: 'Nguồn dữ liệu', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Nguồn dữ liệu & chất lượng' }),
  ).toBeVisible();
  await expect(page.locator('.admin-source-card')).toContainText('Geoapify');
  await page.screenshot({
    path: 'test-results/catalog-evidence/v2-sources.png',
    fullPage: true,
  });
  await page.getByRole('link', { name: 'Cài đặt', exact: true }).click();
  await page.getByLabel('Nhắc kiểm tra sau số ngày chưa biên tập').fill('45');
  await page.getByRole('button', { name: 'Lưu cài đặt', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Đã lưu cấu hình');
  await page.reload();
  await expect(
    page.getByLabel('Nhắc kiểm tra sau số ngày chưa biên tập'),
  ).toHaveValue('45');
  await page.screenshot({
    path: 'test-results/catalog-evidence/v2-settings.png',
    fullPage: true,
  });
  await page
    .getByRole('link', { name: 'Lịch sử & phê duyệt', exact: true })
    .click();
  await page.getByRole('button', { name: /^Chờ phê duyệt/ }).click();
  await expect(page.getByLabel('Loại việc')).toBeVisible();
  await page.screenshot({
    path: 'test-results/catalog-evidence/v2-review-queue.png',
    fullPage: true,
  });
});
