import { test, expect } from '@playwright/test';

test('enable province automatically imports drafts, restores progress and leads to scoped bulk publication', async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.route('https://res.cloudinary.com/fixture/**', (route) =>
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
    .getByRole('button', { name: 'Lấy địa điểm', exact: true })
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

  await page
    .getByRole('button', {
      name: 'Chỉnh sửa Tham quan Cao Bằng · dữ liệu thử',
      exact: true,
    })
    .click();
  const photos = page.getByRole('region', { name: 'Ảnh gợi ý Wikimedia' });
  await photos.scrollIntoViewIfNeeded();
  await expect(photos.locator('figure')).toHaveCount(6, { timeout: 30000 });
  await expect(photos.locator('figure').first()).toHaveClass('is-cover');
  const overview = page.getByRole('tab', { name: 'Tổng quan', exact: true });
  await overview.focus();
  await overview.press('ArrowRight');
  await expect(page.getByRole('tab', { name: /Ảnh địa điểm/ })).toBeFocused();
  await page.getByRole('tab', { name: /Ảnh địa điểm/ }).press('Home');
  await expect(overview).toBeFocused();
  const description = page.getByLabel('Giới thiệu ngắn');
  const edited = 'Giới thiệu đã kiểm tra cho dữ liệu thử Cao Bằng.';
  await description.fill(edited);
  await page.getByRole('tab', { name: 'Nguồn & lịch sử' }).click();
  const source = page.getByLabel('Link nguồn thông tin');
  const originalSource = await source.inputValue();
  await source.fill('invalid-url');
  await overview.click();
  await expect(description).toHaveValue(edited);
  await page.getByRole('button', { name: 'Lưu đề xuất', exact: true }).click();
  await expect(
    page.getByRole('tab', { name: 'Nguồn & lịch sử' }),
  ).toHaveAttribute('aria-selected', 'true');
  await expect(source).toBeFocused();
  await source.fill(originalSource);
  await overview.click();
  await expect(photos.locator('img').first()).toHaveAttribute(
    'src',
    /^https:\/\/res\.cloudinary\.com\//,
  );
  await photos
    .getByRole('button', { name: /^Xem ảnh:/ })
    .first()
    .click();
  await expect(page.getByRole('dialog')).toBeVisible();
  // A modal must stay centered even after the editor has scrolled.
  for (const viewport of [
    { width: 1366, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    const bounds = await page.getByRole('dialog').boundingBox();
    expect(bounds).not.toBeNull();
    expect(
      Math.abs(bounds!.x + bounds!.width / 2 - viewport.width / 2),
    ).toBeLessThan(2);
    expect(
      Math.abs(bounds!.y + bounds!.height / 2 - viewport.height / 2),
    ).toBeLessThan(2);
    expect(bounds!.y).toBeGreaterThanOrEqual(15);
    expect(bounds!.x).toBeGreaterThanOrEqual(15);
    await page.screenshot({
      path: `.local/national-planner/photo-dialog-${viewport.width}.png`,
    });
    await page.getByRole('dialog').locator('img').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.mouse.click(3, 3);
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(photos.locator('figure').first()).toHaveClass('is-cover');
    await photos
      .getByRole('button', { name: /^Xem ảnh:/ })
      .first()
      .click();
    await expect(page.getByRole('dialog')).toBeVisible();
  }
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.getByRole('button', { name: 'Đóng xem ảnh' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(photos.getByText(/Đã chọn ảnh bìa/)).toBeVisible();
  await photos
    .getByRole('button', { name: /^Chọn làm bìa:/ })
    .nth(1)
    .click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(photos.locator('figure').nth(1)).toHaveClass('is-cover');
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
