import { test, expect } from '@playwright/test';
import { e2eWebOrigin } from './ports.js';
import type { EnrichmentDto } from '@goease/contracts';
test('national enrichment shows honest progress, pauses and resumes, filters and opens the place editor', async ({
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
  const fixture: EnrichmentDto = {
    job: {
      id: '000000000000000000000099',
      state: 'running',
      revision: 1,
      total: 26566,
      registered: 26566,
      createdAt: '2026-10-25T18:00:00.000Z',
      counts: {
        queued: 26000,
        waiting: 500,
        review: 40,
        ready: 5,
        unresolved: 21,
      },
    },
    items: [
      {
        id: '000000000000000000000098',
        placeId: '000000000000000000000097',
        name: 'Địa điểm kiểm thử bổ sung',
        destinationName: 'Đà Nẵng · fixture',
        state: 'review',
        missing: ['Ảnh bìa', 'Giá đã xác minh'],
        message: 'Thông tin nguồn chưa được duyệt.',
      },
    ],
    hasMore: false,
  };
  let filter = 'all';
  await page.route('**/api/v1/admin/catalog/enrichment**', async (route) => {
    const req = route.request();
    if (req.method() === 'PATCH') {
      const data = req.postDataJSON();
      expect(data.expectedRevision).toBe(fixture.job!.revision);
      fixture.job!.state = data.action === 'pause' ? 'paused' : 'running';
      fixture.job!.revision++;
      return route.fulfill({
        json: { ok: true, data: { id: fixture.job!.id } },
      });
    }
    filter = new URL(req.url()).searchParams.get('state') ?? 'all';
    return route.fulfill({
      json: {
        ok: true,
        data: {
          ...fixture,
          items: filter === 'all' || filter === 'review' ? fixture.items : [],
        },
      },
    });
  });
  await page.goto('/admin#automatic');
  const panel = page.locator('.admin-enrichment');
  await expect(
    panel.getByRole('heading', { name: 'Bổ sung dữ liệu toàn quốc' }),
  ).toBeVisible();
  await expect(panel.getByText(/Chưa tích hợp Google Maps/)).toBeVisible();
  await panel.getByRole('button', { name: 'Tạm dừng giao việc' }).click();
  await expect(panel.getByRole('button', { name: 'Tiếp tục' })).toBeVisible();
  await panel.getByRole('button', { name: 'Tiếp tục' }).click();
  await expect(
    panel.getByRole('button', { name: 'Tạm dừng giao việc' }),
  ).toBeVisible();
  await panel.getByRole('button', { name: /Chưa tìm được nguồn/ }).click();
  await expect.poll(() => filter).toBe('unresolved');
  await panel.getByText('Xem từng địa điểm và thông tin còn thiếu').click();
  await expect(panel.getByText('Chưa có mục trong bộ lọc này.')).toBeVisible();
  await panel.getByLabel('Lọc kết quả').selectOption('review');
  await expect(
    panel.getByText('Địa điểm kiểm thử bổ sung', { exact: true }),
  ).toBeVisible();
  await expect(
    panel.getByRole('link', { name: 'Xem & duyệt' }),
  ).toHaveAttribute('href', /#places\?place=/);
  await page.screenshot({
    path: 'test-results/enrichment-desktop.png',
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(panel.getByRole('link', { name: 'Xem & duyệt' })).toBeVisible();
  await expect(
    panel.getByRole('heading', { name: 'Bổ sung dữ liệu toàn quốc' }),
  ).toBeVisible();
  await page.screenshot({
    path: 'test-results/enrichment-mobile.png',
    fullPage: true,
  });
});
