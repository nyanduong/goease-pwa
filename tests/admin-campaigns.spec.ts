import { test, expect } from '@playwright/test';
import type { CampaignSummary } from '@goease/contracts';

test('campaign list is readable, filters results, retries failures and opens progress on desktop and mobile', async ({
  page,
}) => {
  const destinationId = '000000000000000000000004';
  const items: CampaignSummary[] = [
    'running',
    'succeeded',
    'failed',
    'paused',
  ].map((state, index) => ({
    id: `00000000000000000000010${index}`,
    state,
    createdAt: '2026-10-25T07:48:00.000Z',
    totalTasks: 1,
    completedTasks: state === 'succeeded' ? 1 : 0,
    failedTasks: state === 'failed' ? 1 : 0,
    pausedTasks: state === 'paused' ? 1 : 0,
    source: 'geoapify',
    destinations: [{ id: destinationId, name: 'Đà Nẵng · dữ liệu thử' }],
    groups: ['sights'],
    counts: {
      created: 42 + index,
      updated: 18,
      review: 3,
      errors: state === 'failed' ? 1 : 0,
    },
  }));
  let fail = false;
  await page.route('**/api/v1/admin/v3/campaigns**', async (route) => {
    const url = new URL(route.request().url());
    if (fail)
      return route.fulfill({
        status: 503,
        json: {
          ok: false,
          error: {
            code: 'FIXTURE_UNAVAILABLE',
            message: 'Chưa tải được các đợt · lỗi kiểm thử.',
          },
        },
      });
    const id = url.pathname.split('/').at(-1);
    if (id !== 'campaigns') {
      const campaign = items.find((item) => item.id === id)!;
      return route.fulfill({
        json: {
          ok: true,
          data: {
            campaign: {
              ...campaign,
              policy: {
                policyId: null,
                version: 0,
                autoApplyDraftHours: false,
                autoPublish: false,
              },
            },
            totalTasks: 1,
            tasks: [
              {
                id: campaign.id,
                destinationId,
                destinationName: 'Đà Nẵng · dữ liệu thử',
                state: campaign.state,
                actor: 'user',
                createdAt: campaign.createdAt,
                finishedAt: null,
                nextAttemptAt: campaign.createdAt,
                attempts: 1,
                message: 'Dữ liệu thử giao diện.',
                counts: { ...campaign.counts, unchanged: 0, skipped: 0 },
              },
            ],
          },
        },
      });
    }
    const state = url.searchParams.get('state');
    const q = url.searchParams.get('q') ?? '';
    const filtered = items.filter(
      (item) =>
        (!state ||
          (state === 'issues' ? item.failedTasks > 0 : item.state === state)) &&
        (!q || item.id.includes(q)),
    );
    return route.fulfill({
      json: {
        ok: true,
        data: {
          items: filtered,
          total: filtered.length,
          hasMore: false,
          summary: { running: 1, completedToday: 1, issues: 1 },
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
  await page.getByRole('link', { name: 'Đợt thu thập', exact: true }).click();
  const list = page.getByRole('region', {
    name: 'Danh sách đợt thu thập',
    exact: true,
  });
  await expect(list.locator('tbody tr')).toHaveCount(4);
  await expect(list.getByText('42 mới · 18 cập nhật')).toBeVisible();
  await expect(page.getByLabel('Khu vực quản lý')).toHaveCount(0);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.screenshot({
    path: '.local/campaigns/desktop.png',
    fullPage: true,
  });
  await page.getByLabel('Lọc trạng thái đợt').selectOption('issues');
  await expect(list.locator('tbody tr')).toHaveCount(1);
  await expect(
    list.getByRole('button', { name: /^Xem lỗi đợt/ }),
  ).toBeVisible();
  await page.getByLabel('Lọc trạng thái đợt').selectOption('');
  await page.getByLabel('Tìm đợt thu thập', { exact: true }).fill('không-có');
  await expect(list.getByText('Không có đợt phù hợp')).toBeVisible();
  await list.getByRole('button', { name: 'Xóa bộ lọc' }).click();
  await expect(list.locator('tbody tr')).toHaveCount(4);
  fail = true;
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('lỗi kiểm thử');
  fail = false;
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: '.local/campaigns/mobile.png',
    fullPage: true,
  });
  await page.setViewportSize({ width: 1600, height: 1000 });
  await list
    .getByRole('button', { name: /^Xem tiến trình đợt/ })
    .first()
    .click();
  await expect(
    page.getByRole('heading', { name: 'Tiến độ theo điểm đến' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Danh sách đợt', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Tạo đợt thu thập', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Phạm vi đợt thu thập', exact: true }),
  ).toBeVisible();
});
