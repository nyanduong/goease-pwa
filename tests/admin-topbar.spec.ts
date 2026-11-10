import { e2eWebOrigin } from './ports.js';
import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

test('admin header is consistent and only scopes pages that consume the selected destination', async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  // These tests exercise admin UI; establish the fixture session before mounting it.
  const login = await page.request.post('/api/v1/auth/login', {
    headers: { Origin: e2eWebOrigin, 'X-GoEase-Client': 'web' },
    data: {
      email: 'catalog-browser@example.invalid',
      password: 'Browser-fixture-2026!',
    },
  });
  expect(login.ok()).toBe(true);
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin/);
  const header = page.getByRole('banner', { name: 'Thanh đầu trang quản trị' });
  const paths = [
    ['overview', 'Tổng quan', true],
    ['work', 'Cần kiểm tra', true],
    ['places', 'Địa điểm', true],
    ['automatic', 'Đợt thu thập', false],
    ['progress', 'Tiến trình lấy dữ liệu', true],
    ['history', 'Lịch sử & phê duyệt', false],
    ['sources', 'Nguồn dữ liệu', true],
    ['settings', 'Cài đặt', false],
    ['rules', 'Tự động cập nhật', false],
  ] as const;
  await mkdir('test-results/header-evidence', { recursive: true });
  for (const [hash, name, scoped] of paths) {
    await page
      .locator('.admin-navigation')
      .getByRole('link', { name, exact: true })
      .click();
    await expect(header.locator('[aria-current="page"]')).toHaveText(name);
    await expect(header.getByLabel('Khu vực quản lý')).toHaveCount(
      scoped ? 1 : 0,
    );
    await expect(
      header.getByRole('link', { name: 'Mở hàng chờ cần kiểm tra' }),
    ).toBeVisible();
    await expect(header.getByLabel('Tìm kiếm toàn danh mục')).toHaveCount(0);
    expect((await header.boundingBox())!.height).toBe(72);
    if (['overview', 'automatic', 'settings'].includes(hash))
      await page.screenshot({
        path: `test-results/header-evidence/${hash}-desktop.png`,
      });
  }
  await page
    .locator('.admin-navigation')
    .getByRole('link', { name: 'Tổng quan', exact: true })
    .click();
  const overviewResponse = page.waitForResponse((response) =>
    response
      .url()
      .includes(
        '/admin/catalog/overview?destinationId=000000000000000000000004',
      ),
  );
  await header
    .getByLabel('Khu vực quản lý')
    .selectOption('000000000000000000000004');
  expect((await overviewResponse).ok()).toBe(true);
  await page
    .locator('.admin-navigation')
    .getByRole('link', { name: 'Cài đặt', exact: true })
    .click();
  await expect(header.getByLabel('Khu vực quản lý')).toHaveCount(0);
  await page
    .locator('.admin-navigation')
    .getByRole('link', { name: 'Nguồn dữ liệu', exact: true })
    .click();
  await expect(header.getByLabel('Khu vực quản lý')).toHaveValue(
    '000000000000000000000004',
  );
  await expect(header).toContainText('Khu vực của kho địa điểm');
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    for (const [hash, name, scoped] of paths) {
      await page
        .locator('.admin-navigation')
        .getByRole('link', { name, exact: true })
        .click();
      await expect(header.locator('[aria-current="page"]')).toHaveText(name);
      await expect(header.getByLabel('Khu vực quản lý')).toHaveCount(
        scoped ? 1 : 0,
      );
      const bounds = await header.boundingBox();
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
      expect(
        await header.evaluate((el) => el.scrollWidth <= el.clientWidth),
      ).toBe(true);
      await expect(
        header.getByRole('link', { name: 'Mở hàng chờ cần kiểm tra' }),
      ).toBeVisible();
      if (['overview', 'settings'].includes(hash))
        await page.screenshot({
          path: `test-results/header-evidence/${hash}-${width}.png`,
        });
    }
  }
});

test('overview reuses the Đà Nẵng dashboard within 30 seconds', async ({
  page,
}) => {
  const login = await page.request.post('/api/v1/auth/login', {
    headers: { Origin: e2eWebOrigin, 'X-GoEase-Client': 'web' },
    data: {
      email: 'catalog-browser@example.invalid',
      password: 'Browser-fixture-2026!',
    },
  });
  expect(login.ok()).toBe(true);
  await page.clock.install();
  const gets: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (
      request.method() === 'GET' &&
      /^\/api\/v1\/admin\/catalog\/(overview|settings|operations)$/.test(
        url.pathname,
      )
    ) {
      gets.push(url.pathname + url.search);
    }
  });
  await page.goto('/admin#overview');
  const total = page
    .locator('.admin-kpi')
    .filter({ hasText: 'Tổng địa điểm' })
    .locator('strong');
  await expect(total).toBeVisible();
  await page.getByRole('button', { name: /Khu vực quản lý/ }).click();
  const picker = page.getByRole('dialog');
  await picker.getByPlaceholder('Tìm tên tỉnh/thành…').fill('Đà Nẵng');
  const scopedResponse = (endpoint: string) =>
    page.waitForResponse((r) => {
      const url = new URL(r.url());
      return (
        url.pathname === '/api/v1/admin/catalog/' + endpoint &&
        url.searchParams.has('destinationId') &&
        r.ok()
      );
    });
  const [overview, activity] = await Promise.all([
    scopedResponse('overview'),
    scopedResponse('operations'),
    picker.getByRole('button', { name: /^Đà Nẵng/ }).click(),
  ]);
  const count = (await overview.json()).data.total.toLocaleString('vi-VN');
  await activity.finished();
  await expect(total).toHaveText(count);
  const nav = page.locator('.admin-navigation');
  await nav
    .getByRole('link', { name: 'Lịch sử & phê duyệt', exact: true })
    .click();
  await expect(total).toBeHidden();
  const beforeReturn = [...gets];
  await page.clock.fastForward(25_000);
  await nav.getByRole('link', { name: 'Tổng quan', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Khu vực quản lý: Đà Nẵng', exact: true }),
  ).toBeVisible();
  await expect(total).toHaveText(count);
  await page.clock.runFor(100);
  expect(gets).toEqual(beforeReturn);
});
