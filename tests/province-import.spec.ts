import { test, expect } from '@playwright/test';

test('enable province automatically imports drafts, restores progress and leads to scoped bulk publication', async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.route('https://upload.wikimedia.org/**', (route) =>
    route.fulfill({
      contentType: 'image/png',
      body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
        'base64',
      ),
    }),
  );
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
  await manager.getByLabel('Tìm tỉnh/thành hoặc khu vực').fill('Cao Bằng');
  await manager
    .getByRole('switch', { name: 'Hiển thị Cao Bằng', exact: true })
    .click();
  const flow = page.getByRole('region', { name: 'Lấy địa điểm Cao Bằng' });
  await expect(flow.getByText(/Nháp mới: 1/)).toBeVisible({ timeout: 20000 });
  await page.screenshot({
    path: '.local/national-planner/province-import-drafts.png',
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.reload();
  await manager.getByLabel('Tìm tỉnh/thành hoặc khu vực').fill('Cao Bằng');
  await manager
    .getByRole('button', { name: 'Lấy địa điểm / xem tiến trình' })
    .click();
  await expect(flow.getByText(/Nháp mới: 1/)).toBeVisible();
  await flow
    .getByRole('link', { name: 'Kiểm tra bản nháp và xuất bản theo lô' })
    .click();
  await expect(
    page.getByRole('checkbox', {
      name: 'Chọn Tham quan Cao Bằng · dữ liệu thử',
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole('checkbox', {
      name: 'Chọn Tham quan Cao Bằng · dữ liệu thử',
      exact: true,
    })
    .check();
  await page
    .getByRole('button', { name: 'Xem trước xuất bản', exact: true })
    .click();
  await expect(page.getByText(/Thiếu ảnh bìa thật đã duyệt/)).toBeVisible();
  await page
    .getByRole('button', {
      name: 'Chỉnh sửa Tham quan Cao Bằng · dữ liệu thử',
      exact: true,
    })
    .click();
  const photos = page.getByRole('region', { name: 'Ảnh gợi ý Wikimedia' });
  await photos.scrollIntoViewIfNeeded();
  await photos
    .getByRole('button', { name: 'Chọn ảnh thật này làm bìa' })
    .click();
  await page.screenshot({
    path: '.local/national-planner/wikimedia-selected.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Lưu đề xuất', exact: true }).click();
  await page
    .getByRole('button', { name: '← Về danh sách', exact: true })
    .click();
  await page
    .getByRole('checkbox', {
      name: 'Chọn Tham quan Cao Bằng · dữ liệu thử',
      exact: true,
    })
    .check();
  await page
    .getByRole('button', { name: 'Xem trước xuất bản', exact: true })
    .click();
  await expect(
    page.getByRole('button', {
      name: 'Áp dụng 1 mục đủ điều kiện',
      exact: true,
    }),
  ).toBeEnabled();
  await page
    .getByRole('button', { name: 'Áp dụng 1 mục đủ điều kiện', exact: true })
    .click();
  await expect(page.getByText('Đã áp dụng', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('heading', {
      name: 'Không có địa điểm khớp bộ lọc',
      exact: true,
    }),
  ).toBeVisible();
  await page.screenshot({
    path: '.local/national-planner/province-import-published.png',
    fullPage: true,
  });
});
