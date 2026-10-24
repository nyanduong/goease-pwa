import { test, expect } from '@playwright/test';

const user = {
  id: '507f1f77bcf86cd799439011',
  displayName: 'Traveler fixture',
  email: 'traveler@example.invalid',
  emailVerified: false,
  avatarUrl: null,
};
const profile = {
  user,
  revision: 0,
  canChangePassword: true,
  createdAt: '2026-10-20T08:47:00Z',
  updatedAt: '2026-10-24T02:22:00Z',
};
const unavailable = {
  status: 503,
  json: {
    ok: false,
    error: {
      code: 'DATABASE_UNAVAILABLE',
      message: 'Máy chủ tạm thời không sẵn sàng.',
    },
  },
};

test('failed session/catalog/profile reads recover with backoff and stop after success; writes are never replayed', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-10-24T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-24T00:00:01Z'));
  let sessions = 0,
    destinations = 0,
    profiles = 0,
    writes = 0;
  await page.route('**/api/v1/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/auth/me'))
      return route.fulfill(
        ++sessions <= 3 ? unavailable : { json: { ok: true, data: { user } } },
      );
    if (path.endsWith('/destinations'))
      return route.fulfill(
        ++destinations <= 2
          ? unavailable
          : { json: { ok: true, data: { items: [] } } },
      );
    if (path.endsWith('/me/profile')) {
      if (route.request().method() === 'PATCH') {
        writes++;
        return route.fulfill(unavailable);
      }
      return route.fulfill(
        ++profiles <= 2 ? unavailable : { json: { ok: true, data: profile } },
      );
    }
    return route.fulfill({ json: { ok: true, data: { items: [] } } });
  });
  await page.goto('/account');
  await expect(
    page.getByText('Chưa kết nối được máy chủ. Ứng dụng đang tự thử lại.', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Thử kết nối lại', exact: true }),
  ).toHaveCount(0);
  await page.clock.runFor(1900);
  expect(sessions).toBe(2);
  await page.clock.runFor(100);
  await expect.poll(() => sessions).toBe(3);
  await expect(
    page.getByText('Chưa kết nối được máy chủ. Ứng dụng đang tự thử lại.', {
      exact: true,
    }),
  ).toBeVisible();
  // Let React register the next backoff before advancing the clock again.
  await expect(
    page.locator('header').getByText('Đang kết nối lại…', { exact: true }),
  ).toBeVisible();
  await page.clock.runFor(3900);
  expect(sessions).toBe(3);
  await page.clock.runFor(100);
  await expect.poll(() => sessions).toBe(4);
  await expect(page.getByRole('alert')).toContainText('Máy chủ tạm thời');
  await page.clock.runFor(2000);
  await expect(
    page.getByRole('heading', { name: 'Trung tâm cá nhân' }),
  ).toBeVisible();
  expect(destinations).toBe(3);
  expect(profiles).toBe(3);
  await expect(
    page.getByText('Chưa kết nối được máy chủ. Ứng dụng đang tự thử lại.', {
      exact: true,
    }),
  ).toHaveCount(0);
  await page
    .getByLabel('Tên hiển thị', { exact: true })
    .fill('Bản nháp phải được giữ');
  await page.getByRole('button', { name: 'Lưu hồ sơ', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Máy chủ tạm thời');
  await page.clock.runFor(120000);
  await page.evaluate(() => {
    dispatchEvent(new Event('online'));
    dispatchEvent(new Event('focus'));
  });
  expect(sessions).toBe(4);
  expect(profiles).toBe(3);
  expect(writes).toBe(1);
  await expect(page.getByLabel('Tên hiển thị', { exact: true })).toHaveValue(
    'Bản nháp phải được giữ',
  );
});

test('waits while offline and reconnects immediately on the online event', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.assign(window, { fixtureOnline: false });
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get: () =>
        (window as unknown as { fixtureOnline: boolean }).fixtureOnline,
    });
  });
  await page.clock.install({ time: new Date('2026-10-24T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-24T00:00:01Z'));
  let calls = 0,
    available = false;
  await page.route('**/api/v1/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/auth/me')) {
      calls++;
      return available
        ? route.fulfill({ json: { ok: true, data: { user } } })
        : route.abort('connectionfailed');
    }
    return route.fulfill({
      json: {
        ok: true,
        data: path.endsWith('/me/profile') ? profile : { items: [] },
      },
    });
  });
  await page.goto('/account');
  await expect(
    page.getByText('Đang chờ mạng để tự kết nối lại.', { exact: true }),
  ).toBeVisible();
  await page.clock.runFor(120000);
  expect(calls).toBe(2);
  available = true;
  await page.evaluate(() => {
    Object.assign(window, { fixtureOnline: true });
    dispatchEvent(new Event('online'));
  });
  await expect(
    page.getByRole('heading', { name: 'Trung tâm cá nhân' }),
  ).toBeVisible();
  expect(calls).toBe(3);
});

test('pauses retries in a hidden tab and resumes when the tab becomes visible', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.assign(window, { fixtureVisible: true });
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () =>
        (window as unknown as { fixtureVisible: boolean }).fixtureVisible
          ? 'visible'
          : 'hidden',
    });
  });
  await page.clock.install({ time: new Date('2026-10-24T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-24T00:00:01Z'));
  let calls = 0;
  await page.route('**/api/v1/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/auth/me'))
      return route.fulfill(
        ++calls <= 2 ? unavailable : { json: { ok: true, data: { user } } },
      );
    return route.fulfill({
      json: {
        ok: true,
        data: path.endsWith('/me/profile') ? profile : { items: [] },
      },
    });
  });
  await page.goto('/account');
  await expect(
    page.getByText('Chưa kết nối được máy chủ. Ứng dụng đang tự thử lại.', {
      exact: true,
    }),
  ).toBeVisible();
  await page.evaluate(() => {
    Object.assign(window, { fixtureVisible: false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.runFor(60000);
  expect(calls).toBe(2);
  await page.evaluate(() => {
    Object.assign(window, { fixtureVisible: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(
    page.getByRole('heading', { name: 'Trung tâm cá nhân' }),
  ).toBeVisible();
  expect(calls).toBe(3);
});
