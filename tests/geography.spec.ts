import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

test('operator enables a province; customer filters it and gets a truthful empty-catalog response without losing input', async ({
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
  const manager = page.getByRole('region', { name: 'Danh mục tỉnh thành' });
  await expect(
    manager.getByRole('heading', { name: 'Danh mục tỉnh/thành Việt Nam' }),
  ).toBeVisible();
  await expect(manager.locator('tbody tr')).toHaveCount(34);
  await expect(
    manager.getByRole('switch', { name: 'Hiển thị Hội An', exact: true }),
  ).toHaveCount(0);
  await expect(
    manager.getByRole('textbox', { name: 'Tên điểm đến', exact: true }),
  ).toHaveCount(0);
  const name = 'Lào Cai';
  await manager.getByLabel('Tìm tỉnh/thành hoặc khu vực').fill('Sa Pa');
  await expect(
    manager.getByRole('switch', { name: `Hiển thị ${name}`, exact: true }),
  ).toHaveAttribute('aria-checked', 'false');
  await manager
    .getByRole('switch', { name: `Hiển thị ${name}`, exact: true })
    .click();
  await expect(manager.getByRole('status')).toContainText('Đã bật Lào Cai');
  await expect(
    manager.getByRole('switch', { name: `Hiển thị ${name}`, exact: true }),
  ).toHaveAttribute('aria-checked', 'true');
  await page.reload();
  await expect(
    manager.getByRole('switch', { name: `Hiển thị ${name}`, exact: true }),
  ).toHaveAttribute('aria-checked', 'true');
  await expect(
    manager.getByRole('switch', { name: `Hiển thị ${name}`, exact: true }),
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
    page.once('dialog', (dialog) => dialog.accept());
    await manager
      .getByRole('switch', { name: `Hiển thị ${name}`, exact: true })
      .click();
    await expect(manager.getByRole('status')).toContainText('Đã tắt Lào Cai');
    await mobile.reload();
    await expect(mobile.getByRole('button', { name: /Lào Cai/ })).toHaveCount(
      0,
    );
    for (const width of [320, 390, 1366]) {
      await page.setViewportSize({ width, height: 900 });
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        )
        .toBe(true);
    }
  } finally {
    await customer.close();
  }
});
