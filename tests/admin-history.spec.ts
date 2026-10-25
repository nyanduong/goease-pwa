import { test, expect } from '@playwright/test';
import type { CatalogHistoryDto } from '@goease/contracts';

test('history table selects details, filters the whole log, paginates and stays usable on mobile', async ({
  page,
}) => {
  const events: CatalogHistoryDto[] = [
    {
      action: 'catalog.published',
      name: 'Tượng đài Công an Nhân dân · dữ liệu thử',
      actor: 'Admin',
      note: '',
      outcome: 'succeeded',
    },
    {
      action: 'catalog.review_later',
      name: 'Tượng đài Công an Nhân dân · dữ liệu thử',
      actor: 'Admin',
      note: 'Kiểm tra lại giờ mở cửa vào ngày mai.',
      outcome: 'succeeded',
    },
    {
      action: 'catalog.proposal_saved',
      name: 'Bảo tàng Lịch sử Quốc gia · dữ liệu thử',
      actor: 'Admin',
      note: '',
      outcome: 'succeeded',
    },
    {
      action: 'catalog.run_succeeded',
      name: 'Hà Nội · Lượt lấy dữ liệu thử',
      actor: 'Hệ thống',
      note: '',
      outcome: 'succeeded',
    },
    {
      action: 'catalog.run_failed',
      name: 'Đà Nẵng · Lượt lấy dữ liệu thử',
      actor: 'Hệ thống',
      note: '',
      outcome: 'failed',
    },
    {
      action: 'catalog.run_requested',
      name: 'Hà Nội · Lượt lấy dữ liệu thử',
      actor: 'Admin',
      note: '',
      outcome: 'succeeded',
    },
  ].map((event, index) => ({
    ...event,
    id: `fixture-history-${index}`,
    occurredAt: `2026-10-25T${String(12 - index).padStart(2, '0')}:55:00.000Z`,
    placeId: null,
    destinationName: index === 4 ? 'Đà Nẵng' : 'Hà Nội',
    actorType: event.actor === 'Hệ thống' ? 'system' : 'user',
    entityRevision: index === 0 ? 4 : null,
    previousRevision: index === 0 ? 3 : null,
  }));
  let mode: 'normal' | 'empty' | 'error' = 'normal';
  let lastPeriod = '';
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
    const params = new URL(route.request().url()).searchParams;
    const q = params.get('q') ?? '';
    const offset = Number(params.get('offset') ?? 0);
    lastPeriod = params.get('period') ?? '';
    let filtered =
      q === 'phân trang'
        ? Array.from({ length: 32 }, (_, i) => ({
            ...events[0]!,
            id: `page-event-${i}`,
            action: i === 30 ? 'catalog.future_action' : 'catalog.published',
            occurredAt:
              i >= 30 ? '2026-10-24T16:59:00.000Z' : events[0]!.occurredAt,
          }))
        : events.filter(
            (entry) =>
              (!q || entry.name.includes(q) || entry.actor.includes(q)) &&
              (params.get('kind') !== 'editing' ||
                entry.action === 'catalog.proposal_saved'),
          );
    if (mode === 'empty') filtered = [];
    return route.fulfill({
      json: {
        ok: true,
        data: {
          items: filtered.slice(offset, offset + 30),
          total: filtered.length,
          hasMore: offset + 30 < filtered.length,
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
  const placesResponse = await page.request.get(
    '/api/v1/admin/places?offset=0',
  );
  const places = (await placesResponse.json()) as {
    data: { items: { id: string }[] };
  };
  events[0]!.placeId = places.data.items[0]!.id;
  await page
    .getByRole('link', { name: 'Lịch sử & phê duyệt', exact: true })
    .click();
  const log = page.getByRole('region', {
    name: 'Nhật ký hoạt động',
    exact: true,
  });
  const detail = page.getByRole('region', {
    name: 'Chi tiết hoạt động',
    exact: true,
  });
  await expect(log.locator('.history-browser-row')).toHaveCount(6);
  await expect(
    detail.getByRole('heading', {
      name: 'Đã xuất bản thông tin địa điểm',
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    detail.getByRole('button', { name: 'Mở địa điểm', exact: true }),
  ).toBeVisible();
  await expect(
    detail.getByText('catalog.published', { exact: true }),
  ).not.toBeVisible();
  await expect(page.getByLabel('Khu vực quản lý')).toHaveCount(0);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.screenshot({ path: '.local/history/desktop.png', fullPage: true });
  await log
    .getByRole('button', { name: /Xem hoạt động: Hẹn kiểm tra lại/ })
    .click();
  await expect(
    detail.getByText('Kiểm tra lại giờ mở cửa vào ngày mai.'),
  ).toBeVisible();
  await log
    .getByRole('button', { name: /Xem hoạt động: Lưu chỉnh sửa/ })
    .click();
  await expect(
    detail.getByText(
      'Chỉnh sửa đã được lưu; thông tin khách đang thấy chưa thay đổi.',
    ),
  ).toBeVisible();
  await log
    .getByRole('button', { name: /Xem hoạt động: Lấy dữ liệu thất bại/ })
    .click();
  await expect(
    detail.getByRole('heading', {
      name: 'Lấy dữ liệu chưa thành công',
      exact: true,
    }),
  ).toBeVisible();
  await log
    .getByRole('button', { name: /Xem hoạt động: Yêu cầu lấy dữ liệu/ })
    .click();
  await expect(
    detail.getByText('Yêu cầu đã được tiếp nhận, chưa phải kết quả thu thập.'),
  ).toBeVisible();
  await page.getByLabel('Lọc loại hoạt động').selectOption('editing');
  await expect(log.locator('.history-browser-row')).toHaveCount(1);
  await expect(
    detail.getByRole('heading', {
      name: 'Đã lưu chỉnh sửa để kiểm tra',
      exact: true,
    }),
  ).toBeVisible();
  await page.getByLabel('Lọc loại hoạt động').selectOption('all');
  await page.getByLabel('Lọc thời gian hoạt động').selectOption('today');
  await expect.poll(() => lastPeriod).toBe('today');
  await page.getByLabel('Lọc thời gian hoạt động').selectOption('all');
  await page.getByLabel('Tìm hoạt động', { exact: true }).fill('phân trang');
  await expect(log.locator('.history-browser-row')).toHaveCount(30);
  await log.getByRole('button', { name: 'Trang tiếp', exact: true }).click();
  await expect(log.locator('.history-browser-row')).toHaveCount(2);
  await expect(log.getByText(/Hiển thị 31–32 \/ 32 hoạt động/)).toBeVisible();
  await expect(
    detail.getByText('Lịch sử chưa có mô tả chi tiết cho hoạt động này.'),
  ).toBeVisible();
  await detail.locator('summary').click();
  await expect(
    detail.getByText('catalog.future_action', { exact: true }),
  ).toBeVisible();
  await page.getByLabel('Tìm hoạt động', { exact: true }).fill('không-có');
  await expect(
    log.getByText('Không có hoạt động phù hợp', { exact: true }),
  ).toBeVisible();
  await expect(log.getByText(/Trang 1/)).toBeVisible();
  await page.getByLabel('Tìm hoạt động', { exact: true }).fill('');
  await expect(log.locator('.history-browser-row')).toHaveCount(6);
  const first = log.getByRole('button', {
    name: /Xem hoạt động: Xuất bản địa điểm/,
  });
  await first.focus();
  await first.press('ArrowDown');
  await expect(
    log.getByRole('button', { name: /Xem hoạt động: Hẹn kiểm tra lại/ }),
  ).toBeFocused();
  await detail.getByRole('button', { name: 'Đóng chi tiết hoạt động' }).click();
  await expect(
    detail.getByText('Chọn một hoạt động', { exact: true }),
  ).toBeVisible();
  await first.click();
  await detail.locator('summary').click();
  await expect(detail.getByText('3 → 4', { exact: true })).toBeVisible();
  await detail.locator('summary').click();
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await log
      .getByRole('button', { name: /Xem hoạt động: Hẹn kiểm tra lại/ })
      .click();
    await expect(detail).toBeFocused();
    await page.screenshot({
      path: `.local/history/mobile-${width}.png`,
      fullPage: true,
    });
    await detail
      .getByRole('button', { name: 'Đóng chi tiết hoạt động' })
      .click();
    await expect(
      log.getByRole('button', { name: /Xem hoạt động: Hẹn kiểm tra lại/ }),
    ).toBeFocused();
  }
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page
    .getByRole('button', { name: 'Việc chờ duyệt', exact: true })
    .click();
  await expect(
    page.getByRole('region', { name: 'Danh sách cần kiểm tra', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Nhật ký hoạt động', exact: true })
    .click();
  mode = 'error';
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('lỗi kiểm thử');
  mode = 'empty';
  await page.getByRole('button', { name: 'Thử tải lại', exact: true }).click();
  await expect(log.getByText('Chưa có hoạt động để hiển thị')).toBeVisible();
});
