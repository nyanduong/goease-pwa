import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

// UI-only fixtures. These checks do not claim AI or database integration.
async function setup(page: Page) {
  await page.route('**/api/v1/auth/me', (r) =>
    r.fulfill({ json: { ok: true, data: { user: null } } }),
  );
  await page.route('**/api/v1/destinations', (r) =>
    r.fulfill({ json: { ok: true, data: { items: [] } } }),
  );
  await page.setViewportSize({ width: 390, height: 844 });
}

test('budget preview: categories, responsive layout, missing and exceeded budget', async ({
  page,
}) => {
  await setup(page);
  await page.goto('/budget');
  await expect(page.locator('.budget-total')).toContainText('8.200.000');
  await expect(page.locator('.budget-per-person')).toContainText('2.050.000');
  await expect(page.getByRole('meter')).toHaveAttribute('aria-valuenow', '82');
  await expect(page.locator('.budget-reserve')).toContainText('1.800.000');
  await expect(page.locator('.mobile-nav-item').nth(2)).toHaveText('Trang chủ');
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => document.fonts.ready);
  await expect
    .poll(() =>
      page
        .locator('.budget-screen img')
        .evaluateAll((imgs) =>
          imgs.every(
            (img) =>
              (img as HTMLImageElement).complete &&
              (img as HTMLImageElement).naturalWidth > 0,
          ),
        ),
    )
    .toBe(true);
  await mkdir('.local/mvp-preview', { recursive: true });
  await page.screenshot({ path: '.local/mvp-preview/budget-390.png' });
  for (const [value, expected] of [
    ['5000000', 'Vượt 3.200.000'],
    ['0', 'Vượt 8.200.000'],
    ['', 'Chưa đặt ngân sách nhóm'],
  ] as const) {
    await page.getByRole('button', { name: 'Điều chỉnh ngân sách' }).click();
    await page
      .getByLabel('Ngân sách minh họa (VND)', { exact: true })
      .fill(value);
    await page.getByRole('button', { name: 'Cập nhật bản xem trước' }).click();
    await expect(page.locator('.budget-reserve')).toContainText(expected);
  }
});

test('Goe preview: preserve, review, apply demo and send without writing a trip', async ({
  page,
}) => {
  await setup(page);
  const writes: string[] = [];
  page.on('request', (r) => {
    if (
      r.url().includes('/api/') &&
      ['POST', 'PATCH', 'DELETE'].includes(r.method())
    )
      writes.push(r.url());
  });
  await page.goto('/goe');
  await expect(
    page.getByRole('heading', { name: 'Mình cùng điều chỉnh nhé.' }),
  ).toBeVisible();
  await expect(page.locator('.goe-demo-note')).toContainText('Chưa kết nối AI');
  await page.evaluate(() => document.fonts.ready);
  await expect
    .poll(() =>
      page
        .locator('.goe-chat-page img')
        .evaluateAll((imgs) =>
          imgs.every(
            (img) =>
              (img as HTMLImageElement).complete &&
              (img as HTMLImageElement).naturalWidth > 0,
          ),
        ),
    )
    .toBe(true);
  await mkdir('.local/mvp-preview', { recursive: true });
  await page.screenshot({ path: '.local/mvp-preview/goe-390.png' });
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Giữ lịch cũ', exact: true }).click();
  await expect(page.locator('.goe-resolution')).toContainText('Đã giữ lịch cũ');
  await page.getByRole('button', { name: 'Giảm chi phí', exact: true }).click();
  await page.getByRole('button', { name: 'Xem thay đổi', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText(
    'KHÔNG SỬA CHUYẾN ĐI ĐÃ LƯU',
  );
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Xem thay đổi', exact: true }).click();
  await page.getByRole('button', { name: 'Áp dụng vào bản minh họa' }).click();
  await expect(page.locator('.goe-resolution').last()).toContainText(
    'Đã áp dụng vào bản minh họa',
  );
  await page
    .getByLabel('Hỏi Goe về chuyến đi', { exact: true })
    .fill('Xin chào');
  await page.getByRole('button', { name: 'Gửi tin nhắn' }).click();
  await expect(page.getByRole('log')).toContainText(
    'Mình đang ở chế độ minh họa',
  );
  expect(writes).toEqual([]);
});
