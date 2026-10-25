import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { e2eWebOrigin } from './ports.js';

test('schedule list persists edits and toggles, creates a schedule, handles conflict and mobile drawer', async ({
  page,
  playwright,
}) => {
  test.setTimeout(90000);
  page.setDefaultTimeout(12000);
  const headers = { Origin: e2eWebOrigin, 'X-GoEase-Client': 'web' };
  const unauth = await playwright.request.newContext({ baseURL: e2eWebOrigin });
  expect((await unauth.get('/api/v1/admin/catalog/schedules')).status()).toBe(
    401,
  );
  expect(
    (
      await unauth.post('/api/v1/auth/register', {
        headers,
        data: {
          email: `schedule-reader-${Date.now()}@example.invalid`,
          password: 'Browser-fixture-2026!',
          displayName: 'Reader fixture',
        },
      })
    ).ok(),
  ).toBe(true);
  expect((await unauth.get('/api/v1/admin/catalog/schedules')).status()).toBe(
    403,
  );
  await unauth.dispose();
  expect(
    (
      await page.request.post('/api/v1/auth/login', {
        headers,
        data: {
          email: 'catalog-browser@example.invalid',
          password: 'Browser-fixture-2026!',
        },
      })
    ).ok(),
  ).toBe(true);
  expect(
    (
      await page.request.get('/api/v1/admin/catalog/schedules?offset=-1')
    ).status(),
  ).toBe(400);
  const initial = (
    await (await page.request.get('/api/v1/admin/catalog/schedules')).json()
  ).data;
  expect(
    initial.items.every((s: { destinationId: string }) =>
      /^[a-f0-9]{24}$/.test(s.destinationId),
    ),
  ).toBe(true);
  expect(JSON.stringify(initial)).not.toContain('actorSearches');
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/admin#rules');
  const row = page.getByRole('article', { name: 'Lịch Đà Nẵng', exact: true });
  await expect(row).toBeVisible();
  await expect(page.getByLabel('Khu vực quản lý')).toHaveCount(0);
  await row.getByRole('button', { name: 'Chỉnh sửa', exact: true }).click();
  const edit = page.getByRole('dialog', {
    name: 'Chỉnh sửa lịch cập nhật',
    exact: true,
  });
  await edit.getByRole('button', { name: 'Hằng tuần', exact: true }).click();
  await edit.getByLabel('Ngày', { exact: true }).selectOption('1');
  await edit.getByLabel('Giờ', { exact: true }).fill('02:35');
  await edit.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(edit).not.toBeVisible();
  await expect(row).toContainText('Thứ Hai hằng tuần · 02:35');
  await expect(row.getByRole('switch')).toHaveAttribute(
    'aria-checked',
    'false',
  );
  await row.getByRole('switch').click();
  await expect(row.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  await page.reload();
  await expect(row.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  await expect(row).toContainText('02:35');
  await row.getByRole('switch').click();
  await expect(row.getByRole('switch')).toHaveAttribute(
    'aria-checked',
    'false',
  );
  await page.getByLabel('Tìm khu vực có lịch').fill('da nang');
  await expect(row).toBeVisible();
  await page.getByLabel('Trạng thái lịch').selectOption('enabled');
  await expect(row).not.toBeVisible();
  await page.getByRole('button', { name: 'Xóa bộ lọc' }).click();
  await row.getByRole('button', { name: 'Chỉnh sửa', exact: true }).click();
  await edit.getByLabel('Giờ', { exact: true }).fill('04:10');
  const latest = (
    await (
      await page.request.get(
        '/api/v1/admin/catalog/operations?destinationId=000000000000000000000004',
      )
    ).json()
  ).data.schedule;
  const { revision, nextRunAt: _next, ...fields } = latest;
  void _next;
  expect(
    (
      await page.request.put('/api/v1/admin/catalog/schedule', {
        headers: { ...headers, 'Idempotency-Key': crypto.randomUUID() },
        data: { ...fields, expectedRevision: revision, hour: 5 },
      })
    ).ok(),
  ).toBe(true);
  await edit.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(edit.getByRole('alert')).toContainText('Thông tin đã thay đổi');
  await expect(edit.getByLabel('Giờ', { exact: true })).toHaveValue('04:10');
  await edit.getByRole('button', { name: 'Nạp lại bản đã lưu' }).click();
  await expect(edit.getByLabel('Giờ', { exact: true })).toHaveValue('05:35');
  await edit.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(edit).not.toBeVisible();
  // Configure a second area in the owned fixture database, then create via UI.
  const dests = (
    await (
      await page.request.get('/api/v1/admin/destinations?limit=200&offset=0')
    ).json()
  ).data.items;
  const target = dests.find((d: { name: string }) => d.name === 'Hà Nội');
  const settings = (
    await (await page.request.get('/api/v1/admin/catalog/settings')).json()
  ).data;
  const { revision: settingsRevision, ...settingsFields } = settings;
  expect(
    (
      await page.request.put('/api/v1/admin/catalog/settings', {
        headers,
        data: {
          ...settingsFields,
          expectedRevision: settingsRevision,
          regions: [
            ...(settings.regions ?? []).filter(
              (r: { destinationId: string }) => r.destinationId !== target.id,
            ),
            {
              destinationId: target.id,
              latitude: 21.02,
              longitude: 105.83,
              radiusMeters: 5000,
              enabled: true,
            },
          ],
        },
      })
    ).ok(),
  ).toBe(true);
  await page.getByRole('button', { name: 'Tạo lịch', exact: true }).click();
  const create = page.getByRole('dialog', {
    name: 'Tạo lịch cập nhật',
    exact: true,
  });
  await expect(
    create.getByRole('button', { name: 'Tạo và bật lịch' }),
  ).toBeDisabled();
  await create.getByLabel('Khu vực', { exact: true }).selectOption(target.id);
  await create.getByRole('button', { name: 'Hằng ngày', exact: true }).click();
  await create.getByRole('button', { name: 'Tạo và bật lịch' }).click();
  await expect(create).not.toBeVisible();
  const newRow = page.getByRole('article', {
    name: 'Lịch Hà Nội',
    exact: true,
  });
  await expect(newRow.getByRole('switch')).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.reload();
  await expect(newRow).toContainText('Hằng ngày · 02:00');
  await newRow.getByRole('switch').click();
  await expect(newRow.getByRole('switch')).toHaveAttribute(
    'aria-checked',
    'false',
  );
  await mkdir('test-results/schedule-evidence', { recursive: true });
  await page.screenshot({
    path: 'test-results/schedule-evidence/list-desktop.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByRole('button', { name: 'Tạo lịch', exact: true }).click();
  expect(
    await create
      .getByLabel('Khu vực', { exact: true })
      .locator(`option[value="${target.id}"]`)
      .count(),
  ).toBe(0);
  await page.screenshot({
    path: 'test-results/schedule-evidence/drawer-desktop.png',
  });
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('button', { name: 'Tạo lịch', exact: true }),
  ).toBeFocused();
  await row.getByRole('button', { name: 'Lần chạy', exact: true }).click();
  await expect(
    page.getByRole('dialog', { name: 'Lần chạy · Đà Nẵng' }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await page
    .getByRole('button', { name: 'Quy tắc nâng cao', exact: true })
    .click();
  await expect(page.getByLabel('Khu vực xem trước')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Mô phỏng tác động' }),
  ).toBeDisabled();
  await page
    .getByRole('button', { name: 'Lịch cập nhật', exact: true })
    .click();
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/schedule-evidence/list-${width}.png`,
      fullPage: true,
    });
    await row.getByRole('button', { name: 'Chỉnh sửa', exact: true }).click();
    await expect(edit).toBeVisible();
    expect(await edit.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
      true,
    );
    await expect(
      edit.getByRole('button', { name: 'Lưu thay đổi' }),
    ).toBeVisible();
    await page.screenshot({
      path: `test-results/schedule-evidence/drawer-${width}.png`,
    });
    await page.keyboard.press('Escape');
  }
  await page.route('**/api/v1/admin/catalog/schedules?*', (route) =>
    route.fulfill({
      status: 503,
      json: { ok: false, error: { message: 'Lỗi tải lịch thử nghiệm' } },
    }),
  );
  await page.reload();
  await expect(page.getByRole('alert')).toContainText(
    'Lỗi tải lịch thử nghiệm',
  );
  await expect(
    page.getByText('Chưa có lịch cập nhật', { exact: true }),
  ).not.toBeVisible();
  await page.unroute('**/api/v1/admin/catalog/schedules?*');
  await page.getByRole('button', { name: 'Tải lại danh sách' }).click();
  await expect(row).toBeVisible();
  // Real saved schedules verify pagination after filtering.
  const extra = dests
    .filter(
      (d: { id: string }) =>
        ![target.id, '000000000000000000000004'].includes(d.id),
    )
    .slice(0, 10);
  for (const d of extra) {
    const current = (
      await (
        await page.request.get(
          `/api/v1/admin/catalog/operations?destinationId=${d.id}`,
        )
      ).json()
    ).data.schedule;
    const { revision: r, nextRunAt: _at, ...fields } = current;
    void _at;
    expect(
      (
        await page.request.put('/api/v1/admin/catalog/schedule', {
          headers: { ...headers, 'Idempotency-Key': crypto.randomUUID() },
          data: { ...fields, enabled: false, expectedRevision: r },
        })
      ).ok(),
    ).toBe(true);
  }
  await page.reload();
  await expect(page.locator('.schedule-row')).toHaveCount(10);
  await page.getByRole('button', { name: 'Trang sau', exact: true }).click();
  await expect(page.locator('.schedule-row')).toHaveCount(2);
  await page.getByLabel('Tìm khu vực có lịch').fill('da nang');
  await expect(page.locator('.schedule-row')).toHaveCount(1);
  await expect(row).toBeVisible();
});
