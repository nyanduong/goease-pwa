import { test, expect } from '@playwright/test';

test('history explains actions, keeps technical metadata collapsed and separates pending reviews', async ({
  page,
}) => {
  const events = [
    {
      action: 'catalog.published',
      name: 'Tượng đài · dữ liệu thử',
      actor: 'Admin · dữ liệu thử',
      note: '',
      outcome: 'succeeded',
    },
    {
      action: 'catalog.review_later',
      name: 'Tượng đài · dữ liệu thử',
      actor: 'Admin · dữ liệu thử',
      note: 'Kiểm tra lại giờ mở cửa vào ngày mai.',
      outcome: 'succeeded',
    },
    {
      action: 'catalog.proposal_saved',
      name: 'Quán ăn · dữ liệu thử',
      actor: 'Admin · dữ liệu thử',
      note: '',
      outcome: 'succeeded',
    },
    {
      action: 'catalog.run_failed',
      name: 'Lượt lấy dữ liệu · dữ liệu thử',
      actor: 'Hệ thống',
      note: '',
      outcome: 'failed',
    },
    {
      action: 'catalog.future_action',
      name: 'Hoạt động cũ · dữ liệu thử',
      actor: 'Hệ thống',
      note: '',
      outcome: 'succeeded',
    },
  ].map((event, index) => ({
    ...event,
    id: `fixture-history-${index}`,
    occurredAt: `2026-10-25T${String(12 - index).padStart(2, '0')}:55:00.000Z`,
    placeId: null,
    entityRevision: index === 0 ? 4 : null,
    previousRevision: index === 0 ? 3 : null,
    campaignId: null,
    batchId: null,
    runId: null,
  }));
  let mode: 'normal' | 'empty' | 'error' = 'normal';
  await page.route('**/api/v1/admin/catalog/history?**', (route) => {
    if (mode === 'error')
      return route.fulfill({
        status: 503,
        json: {
          ok: false,
          error: {
            code: 'FIXTURE_UNAVAILABLE',
            message: 'Không tải được nhật ký · lỗi kiểm thử.',
          },
        },
      });
    const offset = new URL(route.request().url()).searchParams.get('offset');
    return route.fulfill({
      json: {
        ok: true,
        data: {
          items:
            mode === 'empty'
              ? []
              : offset === '30'
                ? [
                    {
                      ...events[0],
                      id: 'older-event',
                      occurredAt: '2026-10-24T16:59:00.000Z',
                    },
                  ]
                : events,
          hasMore: mode === 'normal' && offset !== '30',
        },
      },
    });
  });
  await page.goto('/login');
  await page
    .getByLabel('Email', { exact: true })
    .fill('catalog-browser@example.invalid');
  await page
    .getByLabel('Mật khẩu', { exact: true })
    .fill('Browser-fixture-2026!');
  await page.getByRole('button', { name: 'Đăng nhập', exact: false }).click();
  await expect(page).toHaveURL(/\/admin/);
  await page
    .getByRole('link', { name: 'Lịch sử & phê duyệt', exact: true })
    .click();
  const log = page.getByRole('region', {
    name: 'Nhật ký hoạt động',
    exact: true,
  });
  await expect(
    log.getByRole('heading', {
      name: 'Đã xuất bản thông tin địa điểm',
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    log.getByText(
      'Chỉnh sửa đã được lưu; thông tin khách đang thấy chưa thay đổi.',
    ),
  ).toBeVisible();
  await expect(
    log.getByText('Kiểm tra lại giờ mở cửa vào ngày mai.'),
  ).toBeVisible();
  await expect(
    log.getByRole('heading', {
      name: 'Lấy dữ liệu chưa thành công',
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    log.getByText('Lịch sử chưa có mô tả chi tiết cho hoạt động này.'),
  ).toBeVisible();
  await expect(
    log.getByText('catalog.published', { exact: true }),
  ).not.toBeVisible();
  await expect(
    log.getByText('catalog.future_action', { exact: true }),
  ).not.toBeVisible();
  await expect(page.getByLabel('Khu vực quản lý')).toHaveCount(0);
  await expect(
    page.getByText('VẬN HÀNH DỮ LIỆU · Toàn hệ thống', { exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.screenshot({ path: '.local/history/desktop.png', fullPage: true });
  const support = log.locator('details').first();
  await support.locator('summary').click();
  await expect(
    support.getByText('catalog.published', { exact: true }),
  ).toBeVisible();
  await expect(support.getByText('3 → 4', { exact: true })).toBeVisible();
  await support.locator('summary').click();
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `.local/history/mobile-${width}.png`,
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 1600, height: 1000 });
  await log.getByRole('button', { name: 'Xem hoạt động cũ hơn' }).click();
  await expect(
    log.getByText('Trang 2 · 1 hoạt động', { exact: true }),
  ).toBeVisible();
  await expect(
    log.getByRole('heading', { name: '24/10/2026', exact: true }),
  ).toBeVisible();
  await log.getByRole('button', { name: 'Trang trước' }).click();
  await expect(
    log.getByText('Trang 1 · 5 hoạt động', { exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Xem việc chờ duyệt', exact: true })
    .click();
  await expect(
    page.getByRole('region', { name: 'Danh sách cần kiểm tra', exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('Khu vực quản lý')).toBeVisible();
  await page.getByRole('button', { name: /Hoạt động đã thực hiện/ }).click();
  mode = 'error';
  await log.getByRole('button', { name: 'Làm mới', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('lỗi kiểm thử');
  mode = 'empty';
  await page.getByRole('button', { name: 'Thử tải lại', exact: true }).click();
  await expect(log.getByText('Chưa có hoạt động để hiển thị')).toBeVisible();
});
