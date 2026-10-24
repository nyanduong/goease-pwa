import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

test('operator prepares a Northern destination; customer filters it and gets a truthful empty-catalog response without losing input', async ({
  page,
  browser,
}) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto('/login');
  await page
    .getByLabel('Email', { exact: true })
    .fill('catalog-browser@example.invalid');
  await page
    .getByLabel('Mật khẩu', { exact: true })
    .fill('Browser-fixture-2026!');
  await page.getByRole('button', { name: 'Đăng nhập', exact: false }).click();
  await expect(page).toHaveURL(/\/admin/);
  await page.getByRole('link', { name: 'Cài đặt', exact: true }).click();
  const manager = page.getByRole('region', { name: 'Điểm đến và phân vùng' });
  await expect(
    manager.getByRole('heading', { name: 'Điểm đến & phân vùng Việt Nam' }),
  ).toBeVisible();
  const name = `Fixture Tây Bắc ${Date.now()}`;
  await manager.getByLabel('Tên điểm đến', { exact: true }).fill(name);
  await manager
    .getByLabel('Đường dẫn điểm đến')
    .fill(`fixture-northwest-${Date.now()}`);
  await manager.getByLabel('Vùng của điểm đến').selectOption('northwest');
  await manager.getByLabel('Trạng thái điểm đến').selectOption('published');
  await manager
    .getByRole('button', { name: 'Lưu điểm đến', exact: true })
    .click();
  await expect(
    manager.getByText('Đã lưu điểm đến và phân vùng.', { exact: false }),
  ).toBeVisible();
  await manager
    .getByLabel('Miền du lịch', { exact: true })
    .selectOption('north');
  await manager
    .getByLabel('Vùng du lịch', { exact: true })
    .selectOption('northwest');
  await expect(
    manager.getByRole('button', { name: `Sửa ${name}`, exact: true }),
  ).toBeVisible();
  await expect(
    manager.getByRole('button', { name: 'Sửa Hội An', exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    manager.getByRole('button', { name: `Sửa ${name}`, exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await mkdir('.local/national-planner', { recursive: true });
  await page.screenshot({
    path: '.local/national-planner/admin-regions.png',
    fullPage: true,
  });
  const customer = await browser.newContext({
    baseURL: new URL(page.url()).origin,
    viewport: { width: 390, height: 844 },
  });
  try {
    const mobile = await customer.newPage();
    await mobile.goto('/register');
    await mobile
      .getByLabel('Tên của bạn', { exact: true })
      .fill('Fixture miền Bắc');
    await mobile
      .getByLabel('Email', { exact: true })
      .fill(`national-browser-${Date.now()}@example.invalid`);
    await mobile
      .getByLabel('Mật khẩu', { exact: true })
      .fill('National-browser-fixture-2026');
    await mobile
      .getByRole('button', { name: 'Tạo tài khoản', exact: false })
      .click();
    await expect(mobile).toHaveURL(/\/$/);
    await mobile.goto('/trips/new');
    await mobile
      .getByLabel('Miền du lịch', { exact: true })
      .selectOption('north');
    await mobile
      .getByLabel('Vùng du lịch', { exact: true })
      .selectOption('northwest');
    await mobile.getByRole('button', { name: new RegExp(name) }).click();
    await expect(
      mobile.getByRole('button', { name: 'Lên lịch giúp mình', exact: true }),
    ).toBeEnabled();
    const response = mobile.waitForResponse('**/api/v1/trips/ai-proposal');
    await mobile
      .getByRole('button', { name: 'Lên lịch giúp mình', exact: true })
      .click();
    const result = await response;
    expect(result.status()).toBe(503);
    expect((await result.json()).error.code).toBe('AI_CATALOG_EMPTY');
    await expect(mobile.getByRole('alert')).toContainText(
      'Chưa có địa điểm đủ dữ liệu',
    );
    await expect(
      mobile.getByRole('button', { name: new RegExp(name) }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(
      mobile.getByRole('button', { name: '2 ngày', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    for (const width of [320, 390, 768]) {
      await mobile.setViewportSize({ width, height: 844 });
      expect(
        await mobile.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    await mobile.setViewportSize({ width: 390, height: 844 });
    await mobile.screenshot({
      path: '.local/national-planner/customer-empty-catalog.png',
      fullPage: true,
    });
  } finally {
    await customer.close();
  }
});
