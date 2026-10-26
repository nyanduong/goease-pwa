import { e2eWebOrigin } from './ports.js';
import { respondToConfirmation } from './support/confirmation';
import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

test('settings provinces filter and paginate, persist toggles, import drafts and view progress without creating a run', async ({
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
  await page.getByRole('link', { name: 'Cài đặt', exact: true }).click();
  const manager = page.getByRole('region', { name: 'Danh mục tỉnh thành' });
  await expect(manager.locator('tbody tr')).toHaveCount(5);
  await expect(manager.locator('.settings-count')).toContainText(
    '/ 34 tỉnh, thành',
  );
  await expect(page.getByLabel('Khu vực quản lý')).toHaveCount(0);
  await expect(
    page.getByLabel('Nhắc kiểm tra sau số ngày chưa biên tập'),
  ).not.toBeVisible();
  await mkdir('test-results/settings-evidence', { recursive: true });
  await page.screenshot({
    path: 'test-results/settings-evidence/desktop.png',
    fullPage: true,
  });
  const first = await manager.locator('tbody tr').first().textContent();
  const pagination = manager.getByRole('navigation', {
    name: 'Phân trang tỉnh thành',
  });
  await expect(
    pagination.getByRole('button', { name: 'Trang 4', exact: true }),
  ).toHaveCount(0);
  await expect(
    pagination.getByRole('button', { name: 'Trang trước', exact: true }),
  ).toBeDisabled();
  await manager.getByRole('button', { name: 'Trang 7', exact: true }).click();
  await expect(manager.locator('tbody tr')).toHaveCount(4);
  await expect(
    pagination.getByRole('button', { name: 'Trang sau', exact: true }),
  ).toBeDisabled();
  expect(await manager.locator('tbody tr').first().textContent()).not.toBe(
    first,
  );
  await manager.getByLabel('Số dòng mỗi trang').selectOption('10');
  await expect(manager.locator('tbody tr')).toHaveCount(10);
  await expect(
    pagination.getByRole('button', { name: 'Trang 1', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  await manager.getByLabel('Số dòng mỗi trang').selectOption('50');
  await expect(manager.locator('tbody tr')).toHaveCount(34);
  await expect(
    pagination.getByRole('button', { name: 'Trang sau', exact: true }),
  ).toBeDisabled();
  await manager.getByLabel('Số dòng mỗi trang').selectOption('5');
  await manager
    .getByLabel('Miền du lịch', { exact: true })
    .selectOption('north');
  await expect(
    manager.getByRole('button', { name: 'Trang 1', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  await expect(manager.locator('tbody')).not.toContainText('Miền Nam');
  const search = manager.getByLabel('Tìm tỉnh/thành hoặc khu vực');
  await search.fill('sa pa');
  await expect(manager.locator('tbody tr')).toHaveCount(1);
  await expect(manager.locator('tbody')).toContainText('Lào Cai');
  await search.fill('khong-co-tinh-nao-fixture');
  await expect(
    manager.getByText('Không có tỉnh/thành phù hợp bộ lọc.'),
  ).toBeVisible();
  await manager.getByRole('button', { name: 'Xóa bộ lọc' }).click();
  await expect(manager.locator('tbody tr')).toHaveCount(5);
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(
      pagination.getByRole('button', { name: 'Trang 2', exact: true }),
    ).toHaveCount(0);
    await pagination
      .getByRole('button', { name: 'Trang sau', exact: true })
      .click();
    await expect(
      pagination.getByRole('button', { name: 'Trang 2', exact: true }),
    ).toHaveAttribute('aria-current', 'page');
    await pagination
      .getByRole('button', { name: 'Trang 1', exact: true })
      .click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/settings-evidence/mobile-${width}.png`,
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 1600, height: 1000 });
  await search.fill('lai chau');
  const toggle = manager.getByRole('switch', {
    name: 'Hiển thị Lai Châu',
    exact: true,
  });
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  let imports = 0;
  page.on('request', (request) => {
    if (
      request.method() === 'POST' &&
      request.url().endsWith('/admin/v3/province-imports')
    )
      imports++;
  });
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await expect(
    manager.getByRole('status').filter({ hasText: 'Đã bật Lai Châu.' }),
  ).toBeVisible();
  await expect(
    page
      .getByRole('region', { name: 'Lấy địa điểm Lai Châu' })
      .getByText(/Nháp mới: 1/),
  ).toBeVisible({ timeout: 20000 });
  expect(imports).toBe(1);
  await page.reload();
  await search.fill('Lai Châu');
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  const progress = manager.getByRole('link', { name: 'Xem tiến trình' });
  const href = await progress.getAttribute('href');
  await progress.click();
  await expect(page).toHaveURL(/#automatic\?destinationId=/);
  await expect(
    page.getByRole('heading', { name: 'Đợt thu thập', exact: true }),
  ).toBeVisible();
  expect(imports).toBe(1);
  expect(href).toContain('destinationId=');
  await page.getByRole('link', { name: 'Cài đặt', exact: true }).click();
  await search.fill('Lai Châu');
  await toggle.click();
  await respondToConfirmation(page, false);
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await toggle.click();
  await respondToConfirmation(page);
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  expect(imports).toBe(1);
  await expect(
    manager.getByText('Bật hiển thị để lấy dữ liệu', { exact: true }),
  ).toBeVisible();

  await page.getByRole('tab', { name: 'Nhắc kiểm tra dữ liệu' }).click();
  await page.getByLabel('Nhắc kiểm tra sau số ngày chưa biên tập').fill('45');
  await page.getByRole('tab', { name: 'Thiết lập nâng cao' }).click();
  await expect(page.getByLabel('Khu vực mặc định')).toBeVisible();
  await page.getByRole('tab', { name: 'Nhắc kiểm tra dữ liệu' }).click();
  await expect(
    page.getByLabel('Nhắc kiểm tra sau số ngày chưa biên tập'),
  ).toHaveValue('45');
  await page.getByRole('button', { name: 'Lưu cài đặt', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Đã lưu cài đặt' }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole('tab', { name: 'Tỉnh/thành hiển thị' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(
    page.getByRole('tab', { name: 'Nhắc kiểm tra dữ liệu' }),
  ).toBeFocused();
  await expect(
    page.getByLabel('Nhắc kiểm tra sau số ngày chưa biên tập'),
  ).toHaveValue('45');
  await page.route('**/api/v1/admin/destinations?limit=200&offset=0', (route) =>
    route.fulfill({
      status: 503,
      json: {
        ok: false,
        error: {
          code: 'FIXTURE_UNAVAILABLE',
          message: 'Danh mục tạm lỗi · dữ liệu thử.',
        },
      },
    }),
  );
  await page.reload();
  await expect(manager.getByRole('alert')).toContainText('Danh mục tạm lỗi');
  await expect(manager.locator('tbody tr')).toHaveCount(0);
  await page.unroute('**/api/v1/admin/destinations?limit=200&offset=0');
  await manager.getByRole('button', { name: 'Tải lại danh mục' }).click();
  await expect(manager.locator('tbody tr')).toHaveCount(5);
});
