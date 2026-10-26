import { respondToConfirmation } from './support/confirmation';
import { fixturePhoto } from '../server/test/support/photo.js';
import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

test('V3 operator preserves public content through proposals, publishes a frozen batch, and keeps responsive operations usable', async ({
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
    page.getByRole('heading', { name: 'Tổng quan', exact: true }),
  ).toBeVisible();
  // Other browser scenarios may add places in other provinces. This workflow
  // owns the four imported Đà Nẵng fixtures, so keep its bulk scope explicit.
  await page
    .getByLabel('Khu vực quản lý')
    .selectOption('000000000000000000000004');
  await expect(page.locator('.admin-kpi').first()).toContainText('4');
  await page.screenshot({
    path: 'test-results/catalog-evidence/00-dashboard-1366.png',
    fullPage: true,
  });
  await page.getByRole('link', { name: 'Cần kiểm tra', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Cần kiểm tra', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: /Nguồn thay đổi/ }),
  ).toBeVisible();
  expect(
    (await page
      .locator('.admin-check-row-copy > strong')
      .first()
      .boundingBox())!.width,
  ).toBeGreaterThan(150);
  expect(
    (await page.locator('.admin-check-row').first().boundingBox())!.height,
  ).toBeLessThan(250);
  await page.screenshot({
    path: 'test-results/catalog-evidence/01-work-1366.png',
    fullPage: true,
  });
  await page
    .locator('.admin-check-row')
    .filter({ hasText: 'Quán An đã biên tập' })
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
  const comparisonColors = await page
    .locator('.admin-comparison tr.has-difference')
    .first()
    .locator('td')
    .evaluateAll((cells) =>
      cells.map((cell) => getComputedStyle(cell).backgroundColor),
    );
  expect(comparisonColors).toHaveLength(2);
  expect(comparisonColors[0]).toBe(comparisonColors[1]);
  await page.screenshot({
    path: 'test-results/catalog-evidence/02-compare-1366.png',
    fullPage: true,
  });
  const publicBeforeProposal = await (
    await page.request.get(
      '/api/v1/places?destinationId=000000000000000000000004',
    )
  ).json();
  await page
    .getByRole('button', { name: 'Lưu đề xuất từ nguồn', exact: true })
    .click();
  await expect(
    page
      .getByRole('status')
      .filter({ hasText: 'Đã lưu đề xuất thay đổi từ nguồn' }),
  ).toBeVisible();
  const publicAfterProposal = await (
    await page.request.get(
      '/api/v1/places?destinationId=000000000000000000000004',
    )
  ).json();
  expect(publicAfterProposal).toEqual(publicBeforeProposal);
  await page.getByRole('link', { name: 'Địa điểm', exact: true }).click();
  await page.getByLabel('Tìm trong danh mục').fill('thử');
  await expect(
    page.getByRole('heading', {
      name: 'Quán An đã biên tập · dữ liệu thử',
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole('checkbox', { name: 'Chọn toàn bộ trang hiện tại' })
    .check();
  await page
    .getByRole('button', {
      name: 'Chọn toàn bộ 4 kết quả khớp bộ lọc',
      exact: true,
    })
    .click();
  await page
    .getByRole('button', { name: 'Xem trước xuất bản', exact: true })
    .click();
  await expect(
    page
      .locator('.admin-bulk-preview .admin-metrics > div')
      .filter({ hasText: 'Đủ điều kiện' })
      .locator('strong'),
  ).toHaveText('2');
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
  const previewCdp = await context.newCDPSession(page);
  for (const size of [
    { width: 683, height: 450, zoom: 2 },
    { width: 390, height: 800, zoom: 1 },
    { width: 320, height: 800, zoom: 1 },
  ]) {
    await page.setViewportSize({ width: size.width, height: size.height });
    await previewCdp.send('Emulation.setDeviceMetricsOverride', {
      width: size.width,
      height: size.height,
      deviceScaleFactor: size.zoom,
      mobile: false,
    });
    const previewHeading = page.getByRole('heading', {
      name: 'Xem trước lô thay đổi',
      exact: true,
    });
    await previewHeading.scrollIntoViewIfNeeded();
    await expect(previewHeading).toBeInViewport({ ratio: 1 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/catalog-evidence/bulk-preview-${size.zoom === 2 ? '200' : size.width}-content.png`,
      fullPage: false,
    });
    const apply = page.getByRole('button', {
      name: 'Áp dụng 2 mục đủ điều kiện',
      exact: true,
    });
    await apply.scrollIntoViewIfNeeded();
    await expect(apply).toBeEnabled();
    await expect(apply).toBeInViewport({ ratio: 1 });
    await page.screenshot({
      path: `test-results/catalog-evidence/bulk-preview-${size.zoom === 2 ? '200' : size.width}-actions.png`,
      fullPage: false,
    });
  }
  await previewCdp.send('Emulation.clearDeviceMetricsOverride');
  await page.setViewportSize({ width: 1366, height: 768 });
  await page
    .getByRole('button', { name: 'Áp dụng 2 mục đủ điều kiện', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Kết quả lô thay đổi', exact: true }),
  ).toBeVisible();
  await expect(
    page
      .locator('.admin-bulk-preview .admin-metrics > div')
      .filter({ hasText: 'Đã áp dụng' })
      .locator('strong'),
  ).toHaveText('2');
  await expect(
    page
      .locator('.admin-bulk-preview .admin-metrics > div')
      .filter({ hasText: 'Bị chặn / lỗi' })
      .locator('strong'),
  ).toHaveText('2');
  await page
    .getByRole('heading', { name: 'Kết quả lô thay đổi', exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: 'test-results/catalog-evidence/03b-publication-results.png',
    fullPage: false,
  });
  const published = await page.request.get(
    '/api/v1/places?destinationId=000000000000000000000004',
  );
  expect(published.ok()).toBe(true);
  const body = await published.json();
  expect(JSON.stringify(body)).toContain('Vườn Cẩm');
  expect(JSON.stringify(body)).not.toContain('Quán Bình');
  const publicItems = body.data.items as {
    name: string;
    referencePrice?: unknown;
  }[];
  expect(
    publicItems.find((p) => p.name.includes('Quán An'))?.referencePrice ?? null,
  ).toBeNull();
  expect(publicItems.some((p) => p.name.includes('Quán An'))).toBe(true);
  await page
    .getByRole('link', { name: 'Tự động cập nhật', exact: true })
    .click();
  const scheduleRow = page.getByRole('article', {
    name: 'Lịch Đà Nẵng',
    exact: true,
  });
  await scheduleRow
    .getByRole('button', { name: 'Chỉnh sửa', exact: true })
    .click();
  const scheduleEditor = page.getByRole('dialog', {
    name: 'Chỉnh sửa lịch cập nhật',
  });
  await scheduleEditor
    .getByRole('button', { name: 'Hằng tuần', exact: true })
    .click();
  await scheduleEditor.getByLabel('Ngày', { exact: true }).selectOption('1');
  await scheduleEditor.getByLabel('Giờ', { exact: true }).fill('08:30');
  await scheduleEditor.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(scheduleEditor).not.toBeVisible();
  await scheduleRow.getByRole('switch').click();
  await expect(scheduleRow.getByRole('switch')).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({
    path: 'test-results/catalog-evidence/04-schedule-1440.png',
    fullPage: true,
  });
  await page.reload();
  await expect(scheduleRow).toContainText('08:30');
  await scheduleRow
    .getByRole('button', { name: 'Lần chạy', exact: true })
    .click();
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
  await page.keyboard.press('Escape');
  await scheduleRow.getByRole('switch').click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Đã tạm dừng' }),
  ).toBeVisible();
  // Match browser zoom: smaller CSS viewport AND higher pixel ratio, including media queries.
  const cdp = await context.newCDPSession(page);
  for (const zoom of [1, 2]) {
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
      expect(await page.evaluate(() => window.devicePixelRatio)).toBe(zoom);
      expect(await page.evaluate(() => window.innerWidth)).toBe(
        Math.floor(viewport.width / zoom),
      );
      for (const tab of [
        'Cần kiểm tra',
        'Địa điểm',
        'Tự động cập nhật',
        'Lịch sử & phê duyệt',
      ]) {
        await page
          .getByRole('navigation', { name: 'Quản trị danh mục' })
          .getByRole('link', { name: tab, exact: true })
          .click();
        await expect(page.locator('main')).toBeVisible();
        if (tab === 'Cần kiểm tra')
          await expect(
            page.getByRole('heading', { name: 'Cần kiểm tra', exact: true }),
          ).toBeVisible();
        if (tab === 'Tự động cập nhật')
          await expect(
            page.getByRole('button', { name: 'Tạo lịch', exact: true }),
          ).toBeVisible();
        if (tab === 'Lịch sử & phê duyệt')
          await expect(
            page.getByRole('heading', { name: 'Nhật ký hoạt động' }),
          ).toBeVisible();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth + 1,
          ),
        ).toBe(true);
        await page.screenshot({
          path: `test-results/catalog-evidence/${zoom === 1 ? 'normal' : 'zoom'}-${viewport.width}-${tab === 'Cần kiểm tra' ? 'work' : tab === 'Địa điểm' ? 'places' : tab === 'Lịch sử & phê duyệt' ? 'history' : 'automatic'}.png`,
          fullPage: false,
        });
      }
    }
  }
  for (const width of [390, 320]) {
    await cdp.send('Emulation.clearDeviceMetricsOverride');
    await page.setViewportSize({ width, height: 800 });
    for (const tab of [
      'Cần kiểm tra',
      'Địa điểm',
      'Tự động cập nhật',
      'Lịch sử & phê duyệt',
    ]) {
      await page
        .getByRole('navigation', { name: 'Quản trị danh mục' })
        .getByRole('link', { name: tab, exact: true })
        .click();
      await expect(page.locator('main')).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth + 1,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `test-results/catalog-evidence/narrow-${width}-${tab === 'Địa điểm' ? 'places' : tab === 'Cần kiểm tra' ? 'work' : tab === 'Tự động cập nhật' ? 'rules' : 'history'}.png`,
        fullPage: false,
      });
    }
  }
  await cdp.send('Emulation.clearDeviceMetricsOverride');
  await page.setViewportSize({ width: 683, height: 450 });
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 683,
    height: 450,
    deviceScaleFactor: 2,
    mobile: false,
  });
  await page.getByRole('link', { name: 'Địa điểm', exact: true }).click();
  await page
    .getByRole('button', {
      name: 'Chỉnh sửa Vườn Cẩm · dữ liệu thử',
      exact: true,
    })
    .click();
  const editorName = page.getByLabel('Tên địa điểm / quán ăn', { exact: true });
  await editorName.scrollIntoViewIfNeeded();
  await expect(editorName).toBeInViewport({ ratio: 1 });
  await page.screenshot({
    path: 'test-results/catalog-evidence/06-editor-200-content.png',
    fullPage: false,
  });
  const saveProposal = page.getByRole('button', {
    name: 'Lưu đề xuất',
    exact: true,
  });
  await saveProposal.scrollIntoViewIfNeeded();
  await expect(saveProposal).toBeEnabled();
  await expect(saveProposal).toBeInViewport({ ratio: 1 });
  await page.screenshot({
    path: 'test-results/catalog-evidence/06-editor-200-actions.png',
    fullPage: false,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
  await cdp.send('Emulation.clearDeviceMetricsOverride');
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 800 });
    await editorName.scrollIntoViewIfNeeded();
    await expect(editorName).toBeInViewport({ ratio: 1 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/catalog-evidence/editor-narrow-${width}-content.png`,
      fullPage: false,
    });
    await saveProposal.scrollIntoViewIfNeeded();
    await expect(saveProposal).toBeEnabled();
    await expect(saveProposal).toBeInViewport({ ratio: 1 });
    await page.screenshot({
      path: `test-results/catalog-evidence/editor-narrow-${width}-actions.png`,
      fullPage: false,
    });
  }
  await page
    .getByRole('button', { name: '← Về danh sách', exact: true })
    .click();
  await page.getByRole('link', { name: 'Cần kiểm tra', exact: true }).click();
  const duplicate = page
    .locator('.admin-check-row')
    .filter({ hasText: 'Quán Bình' })
    .first();
  await duplicate.click();
  await page.getByRole('button', { name: 'Để sau', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Đã hẹn xem lại' }),
  ).toBeVisible();
  // The session and data are real; no browser route mocks or live-provider claims.
  expect((await context.cookies()).some((c) => c.httpOnly)).toBe(true);
});

test('V3 dashboard, filters, editor autosave, map, sources and persisted settings use real APIs', async ({
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
    page.getByRole('heading', { name: 'Tổng quan', exact: true }),
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
  await page.screenshot({
    path: 'test-results/catalog-evidence/v3-empty-overview.png',
    fullPage: false,
  });
  await page
    .getByLabel('Khu vực quản lý')
    .selectOption('000000000000000000000004');
  await page
    .getByRole('link', { name: 'Thêm địa điểm mới Tạo bản nháp có nguồn' })
    .click();
  await page
    .getByLabel('Tên địa điểm / quán ăn', { exact: true })
    .fill('Địa điểm V3 giao diện fixture');
  await page
    .getByLabel('Giới thiệu ngắn')
    .fill('Nội dung dành riêng cho kiểm thử giao diện.');
  await page
    .getByLabel('Địa chỉ / vị trí tìm trên bản đồ')
    .fill('Địa chỉ kiểm thử Hội An');
  await page.getByRole('tab', { name: 'Nguồn & lịch sử' }).click();
  await page
    .getByLabel('Link nguồn thông tin')
    .fill('https://example.com/ui-fixture');
  await page.getByText('Kiểm tra vị trí →', { exact: true }).click();
  await page.getByLabel('Vĩ độ', { exact: true }).fill('15.88');
  await page.getByLabel('Kinh độ', { exact: true }).fill('108.328');
  await page.getByText('Ghi chú nội bộ', { exact: true }).click();
  await page
    .getByLabel('Chỉ quản trị viên nhìn thấy')
    .fill('Ghi chú kiểm thử riêng');
  await page.getByRole('button', { name: 'Lưu đề xuất', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Đã lưu bản chỉnh sửa' }),
  ).toBeVisible();
  await page.getByLabel('Tự lưu khi thông tin hợp lệ').check();
  await page.getByRole('tab', { name: 'Tổng quan', exact: true }).click();
  await page
    .getByLabel('Tên địa điểm / quán ăn', { exact: true })
    .fill('Địa điểm V3 đã tự lưu fixture');
  await expect(
    page.getByRole('status').filter({ hasText: 'Đã lưu bản chỉnh sửa' }),
  ).toBeVisible({ timeout: 10000 });
  await expect
    .poll(async () => {
      const result = await page.request.get('/api/v1/admin/places?q=V3');
      expect(result.ok()).toBe(true);
      return (await result.json()).data.items[0]?.name;
    })
    .toBe('Địa điểm V3 đã tự lưu fixture');
  await page.screenshot({
    path: 'test-results/catalog-evidence/v3-editor.png',
    fullPage: true,
  });
  await page
    .getByRole('button', { name: '← Về danh sách', exact: true })
    .click();
  await page.getByLabel('Tìm trong danh mục').fill('V3');
  await expect(page.locator('.admin-data-table tbody tr')).toHaveCount(1);
  await page.route('https://tile.openstreetmap.org/**', (route) =>
    route.abort(),
  );
  await page.getByRole('button', { name: 'Bản đồ', exact: true }).click();
  await expect(page.locator('.admin-cluster')).toHaveCount(1);
  const fullMap = page.getByRole('region', {
    name: 'Bản đồ địa điểm theo bộ lọc',
  });
  await expect(fullMap.getByRole('alert')).toContainText(
    'Chưa tải được nền OpenStreetMap',
  );
  await expect(fullMap).toContainText('1 địa điểm trong vùng đang xem');
  await expect(
    fullMap.getByRole('button', { name: 'Thử lại nền bản đồ', exact: true }),
  ).toBeEnabled();
  // Global no-referrer stays in place; map tiles identify only the app origin.
  await expect(page.locator('.leaflet-tile').first()).toHaveAttribute(
    'referrerpolicy',
    'origin',
  );
  await page.screenshot({
    path: 'test-results/catalog-evidence/v3-map.png',
    fullPage: true,
  });
  await page.unroute('https://tile.openstreetmap.org/**');
  await page.getByRole('link', { name: 'Nguồn dữ liệu', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Nguồn dữ liệu', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.sources-provider-card')).toContainText(
    'Geoapify',
  );
  await page.screenshot({
    path: 'test-results/catalog-evidence/v3-sources.png',
    fullPage: true,
  });
  await page.getByRole('link', { name: 'Cài đặt', exact: true }).click();
  await page.getByRole('tab', { name: 'Nhắc kiểm tra dữ liệu' }).click();
  await page.getByLabel('Nhắc kiểm tra sau số ngày chưa biên tập').fill('45');
  await page.getByRole('button', { name: 'Lưu cài đặt', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Đã lưu cài đặt');
  await page.reload();
  await page.getByRole('tab', { name: 'Nhắc kiểm tra dữ liệu' }).click();
  await expect(
    page.getByLabel('Nhắc kiểm tra sau số ngày chưa biên tập'),
  ).toHaveValue('45');
  await page.screenshot({
    path: 'test-results/catalog-evidence/v3-settings.png',
    fullPage: true,
  });
  await page
    .getByRole('link', { name: 'Lịch sử & phê duyệt', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Việc chờ duyệt', exact: true })
    .click();
  await expect(page.getByLabel('Loại việc')).toBeVisible();
  await page.screenshot({
    path: 'test-results/catalog-evidence/v3-review-queue.png',
    fullPage: true,
  });
});

test('V3 policy simulation is read-only, historical restore stages a proposal, and frozen bulk context survives reload', async ({
  page,
}) => {
  test.setTimeout(90000);
  await mkdir('test-results/catalog-evidence', { recursive: true });
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
    page.getByRole('heading', { name: 'Tổng quan', exact: true }),
  ).toBeVisible();
  await page
    .getByLabel('Khu vực quản lý')
    .selectOption('000000000000000000000004');

  const suffix = randomUUID().slice(0, 8);
  const name = `Địa điểm phục hồi V3 fixture ${suffix}`;
  const initialDescription =
    'Nội dung công khai ban đầu của fixture phục hồi, không phải dữ kiện du lịch.';
  const created = await page.request.post('/api/v1/admin/places', {
    headers: {
      Origin: new URL(page.url()).origin,
      'X-GoEase-Client': 'web',
      'Idempotency-Key': randomUUID(),
    },
    data: {
      intent: 'publish',
      place: {
        destinationId: '000000000000000000000004',
        name,
        category: 'culture',
        venueType: 'place',
        description: initialDescription,
        locationQuery: 'Địa chỉ fixture Hội An',
        durationMinutes: 60,
        openingHoursNote: '08:00–18:00 · fixture',
        sourceUrl: 'https://example.com/history-fixture',
        referencePrice: null,
        publicationStatus: 'published',
        images: [fixturePhoto],
        fieldLocks: ['name'],
      },
    },
  });
  expect(created.ok()).toBe(true);
  const initial = (await created.json()).data.place as {
    id: string;
    revision: number;
    publicRevision: number;
  };
  expect(initial.publicRevision).toBeGreaterThan(0);
  // Let the independent fixture image worker finish before taking a full DTO
  // snapshot. Its pending -> ready transition is unrelated to policy dry-run.
  await expect
    .poll(
      async () => {
        const response = await page.request.get(
          `/api/v1/admin/places/${initial.id}`,
        );
        expect(response.ok()).toBe(true);
        return (await response.json()).data.place.photoSearch?.state;
      },
      { timeout: 25000 },
    )
    .toBe('ready');
  const publicPath = '/api/v1/places?destinationId=000000000000000000000004';
  const publicBefore = await (await page.request.get(publicPath)).json();
  const adminBefore = (
    await (await page.request.get(`/api/v1/admin/places/${initial.id}`)).json()
  ).data;

  await page
    .getByRole('link', { name: 'Tự động cập nhật', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Quy tắc nâng cao', exact: true })
    .click();
  await page
    .getByLabel('Khu vực xem trước')
    .selectOption('000000000000000000000004');
  await page.getByRole('button', { name: 'Thêm quy tắc', exact: true }).click();
  const policyName = `Quy tắc mô phỏng fixture ${suffix}`;
  await page.getByLabel('Tên quy tắc', { exact: true }).fill(policyName);
  await page
    .getByRole('checkbox', {
      name: 'Tự áp dụng giờ nguồn cho bản nháp đủ điều kiện',
      exact: true,
    })
    .check();
  const policyResponsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/v1/admin/v3/policies') &&
      response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Lưu quy tắc', exact: true }).click();
  const policyResponse = await policyResponsePromise;
  expect(policyResponse.ok()).toBe(true);
  const policy = (await policyResponse.json()).data as {
    id: string;
    version: number;
    autoApplyDraftHours: boolean;
    autoPublish: boolean;
  };
  expect(policy.version).toBeGreaterThan(0);
  expect(policy.autoApplyDraftHours).toBe(true);
  expect(policy.autoPublish).toBe(false);
  const policyRadio = page.getByRole('radio', { name: new RegExp(policyName) });
  await expect(policyRadio).toBeChecked();
  const simulationPromise = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/v1/admin/v3/policies/dry-run') &&
      response.request().method() === 'POST',
  );
  await page
    .getByRole('button', { name: 'Xem trước ảnh hưởng', exact: true })
    .click();
  const simulationResponse = await simulationPromise;
  expect(simulationResponse.ok()).toBe(true);
  expect(simulationResponse.request().postDataJSON()).toEqual({
    policyId: policy.id,
    destinationId: '000000000000000000000004',
    offset: 0,
  });
  const simulation = (await simulationResponse.json()).data as {
    dryRun: boolean;
    policy: { id: string; version: number };
    total: number;
    items: { eligible: boolean; reason: string }[];
  };
  expect(simulation.dryRun).toBe(true);
  expect(simulation.policy.id).toBe(policy.id);
  expect(simulation.policy.version).toBe(policy.version);
  expect(simulation.total).toBeGreaterThanOrEqual(0);
  for (const item of simulation.items) {
    expect(typeof item.eligible).toBe('boolean');
    expect(item.reason.length).toBeGreaterThan(0);
  }
  expect(
    (
      await (
        await page.request.get(`/api/v1/admin/places/${initial.id}`)
      ).json()
    ).data,
  ).toEqual(adminBefore);
  expect(await (await page.request.get(publicPath)).json()).toEqual(
    publicBefore,
  );
  const simulationHeading = page.getByRole('heading', {
    name: `Thay đổi dự kiến · ${policyName} · bản ${policy.version}`,
    exact: true,
  });
  await simulationHeading.scrollIntoViewIfNeeded();
  await expect(simulationHeading).toBeInViewport({ ratio: 1 });
  await page.screenshot({
    path: 'test-results/catalog-evidence/v3-policy-read-only-simulation.png',
    fullPage: false,
  });

  await page.getByRole('link', { name: 'Địa điểm', exact: true }).click();
  await page.getByLabel('Tìm trong danh mục').fill(name);
  await page
    .getByRole('button', { name: `Chỉnh sửa ${name}`, exact: true })
    .click();
  const proposalDescription = `Nội dung đề xuất chưa xuất bản của fixture ${suffix}.`;
  await page.getByLabel('Giới thiệu ngắn').fill(proposalDescription);
  await page.getByRole('button', { name: 'Lưu đề xuất', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Đã lưu bản chỉnh sửa' }),
  ).toBeVisible();
  const staged = (
    await (await page.request.get(`/api/v1/admin/places/${initial.id}`)).json()
  ).data;
  expect(staged.place.revision).toBeGreaterThan(initial.revision);
  expect(staged.place.proposalRevision).toBe(staged.place.revision);
  expect(staged.publicPlace.description).toBe(initialDescription);
  expect(await (await page.request.get(publicPath)).json()).toEqual(
    publicBefore,
  );

  await page.getByRole('tab', { name: 'Nguồn & lịch sử' }).click();
  const historical = page
    .locator('.admin-version')
    .filter({ hasText: `Bản ${initial.publicRevision} · Công khai` });
  await historical
    .getByRole('button', { name: 'So sánh & chuẩn bị phục hồi', exact: true })
    .click();
  const comparisonHeading = page.getByRole('heading', {
    name: `So sánh phiên bản ${initial.publicRevision}`,
    exact: true,
  });
  await comparisonHeading.scrollIntoViewIfNeeded();
  await expect(comparisonHeading).toBeInViewport({ ratio: 1 });
  await expect(page.locator('.admin-version-comparison')).toContainText(
    proposalDescription,
  );
  await expect(page.locator('.admin-version-comparison')).toContainText(
    initialDescription,
  );
  await page.screenshot({
    path: 'test-results/catalog-evidence/v3-history-restore-preview.png',
    fullPage: false,
  });
  const restorePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/v1/admin/places/${initial.id}/restore`) &&
      response.request().method() === 'POST',
  );
  await page
    .getByRole('button', { name: 'Chuẩn bị đề xuất phục hồi', exact: true })
    .click();
  await expect(page.getByRole('alertdialog')).toContainText(
    'Bản công khai được giữ nguyên',
  );
  await respondToConfirmation(page);
  const restoreResponse = await restorePromise;
  expect(restoreResponse.ok()).toBe(true);
  await expect(page.getByLabel('Giới thiệu ngắn')).toHaveValue(
    initialDescription,
  );
  const restored = (
    await (await page.request.get(`/api/v1/admin/places/${initial.id}`)).json()
  ).data;
  expect(restored.place.revision).toBeGreaterThan(staged.place.revision);
  expect(restored.place.proposalRevision).toBe(restored.place.revision);
  expect(restored.place.publicRevision).toBe(initial.publicRevision);
  expect(restored.publicPlace.description).toBe(initialDescription);
  expect(restored.place.fieldLocks).toContain('name');
  expect(await (await page.request.get(publicPath)).json()).toEqual(
    publicBefore,
  );

  await page
    .getByRole('button', { name: '← Về danh sách', exact: true })
    .click();
  await page.getByLabel('Tìm trong danh mục').fill(name);
  await expect(page.locator('.admin-data-table tbody tr')).toHaveCount(1);
  await page
    .getByRole('checkbox', { name: 'Chọn toàn bộ trang hiện tại', exact: true })
    .check();
  await page
    .getByRole('button', {
      name: 'Chọn toàn bộ 1 kết quả khớp bộ lọc',
      exact: true,
    })
    .click();
  const previewPromise = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/v1/admin/v3/bulk/preview') &&
      response.request().method() === 'POST',
  );
  await page
    .getByRole('button', { name: 'Xem trước xuất bản', exact: true })
    .click();
  const previewResponse = await previewPromise;
  expect(previewResponse.ok()).toBe(true);
  const frozen = (await previewResponse.json()).data;
  expect(frozen.selection.mode).toBe('filter');
  expect(frozen.selection.filter.q).toBe(name);
  expect(frozen.selection.filter.destinationId).toBe(
    '000000000000000000000004',
  );
  expect(frozen.items).toHaveLength(1);
  expect(frozen.items[0].expectedRevision).toBe(restored.place.revision);
  await page.reload();
  await expect(page.getByLabel('Tìm trong danh mục')).toHaveValue('');
  const recovered = page.locator('.admin-bulk-preview');
  await expect(recovered).toContainText(`tìm “${name}”`);
  await expect(recovered).toContainText('Đà Nẵng');
  await expect(recovered).toContainText('Chốt lúc');
  const persisted = (
    await (await page.request.get(`/api/v1/admin/v3/bulk/${frozen.id}`)).json()
  ).data;
  expect(persisted.selection).toEqual(frozen.selection);
  expect(persisted.snapshotAt).toBe(frozen.snapshotAt);
  expect(persisted.items[0].expectedRevision).toBe(restored.place.revision);
  const recoveredHeading = recovered.getByRole('heading', {
    name: 'Xem trước lô thay đổi',
    exact: true,
  });
  await recoveredHeading.scrollIntoViewIfNeeded();
  await expect(recoveredHeading).toBeInViewport({ ratio: 1 });
  await page.screenshot({
    path: 'test-results/catalog-evidence/v3-frozen-bulk-recovered.png',
    fullPage: false,
  });
  expect(await (await page.request.get(publicPath)).json()).toEqual(
    publicBefore,
  );
});
