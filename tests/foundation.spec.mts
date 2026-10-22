import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { once } from 'node:events';
import mongoose from 'mongoose';
import { createProduct } from '../server/src/product.js';
import { parseConfig } from '../server/src/config.js';
import { seedDestinations } from '../server/src/features/trips/destination-seed.js';
import { inputFromTrip } from '../client/src/trip-draft.js';
import { e2eApiOrigin } from './ports.js';

let mongo: ChildProcess;
let dbPath: string;
async function startMongo() {
  const binary = process.env.MONGOD_BINARY;
  if (!binary)
    throw new Error(
      'Set MONGOD_BINARY to an installed mongod executable. This test owns port 27020.',
    );
  mongo = spawn(
    binary,
    [
      '--dbpath',
      dbPath,
      '--bind_ip',
      '127.0.0.1',
      '--port',
      '27020',
      '--replSet',
      'goease_e2e',
    ],
    { stdio: 'ignore', windowsHide: true },
  );
  await once(mongo, 'spawn');
  let direct!: mongoose.Connection;
  await expect
    .poll(
      async () => {
        const attempt = mongoose.createConnection(
          'mongodb://127.0.0.1:27020/admin?directConnection=true',
          { serverSelectionTimeoutMS: 1000 },
        );
        try {
          direct = await attempt.asPromise();
          return true;
        } catch {
          await attempt.close();
          return false;
        }
      },
      { timeout: 20000 },
    )
    .toBe(true);
  try {
    const admin = direct.db!.admin();
    const args = await admin.command({ getCmdLineOpts: 1 });
    expect(resolve(args.parsed.storage.dbPath)).toBe(resolve(dbPath));
    expect(
      args.parsed.replication.replSet ?? args.parsed.replication.replSetName,
    ).toBe('goease_e2e');
    try {
      await admin.command({ replSetGetStatus: 1 });
    } catch (error) {
      if ((error as { code?: number }).code !== 94) throw error;
      await admin.command({
        replSetInitiate: {
          _id: 'goease_e2e',
          members: [{ _id: 0, host: '127.0.0.1:27020' }],
        },
      });
    }
    await expect
      .poll(async () => (await admin.command({ hello: 1 })).isWritablePrimary, {
        timeout: 20000,
      })
      .toBe(true);
  } finally {
    await direct.close();
  }
  await expect
    .poll(
      async () => (await fetch(`${e2eApiOrigin}/api/v1/health/db`)).status,
      { timeout: 20000 },
    )
    .toBe(200);
}
async function stopMongo() {
  if (mongo && mongo.exitCode === null) {
    const exited = once(mongo, 'exit');
    mongo.kill();
    await exited;
  }
}
test.beforeAll(async () => {
  await mkdir('.local', { recursive: true });
  dbPath = await mkdtemp(resolve('.local/e2e-mongo-'));
  await startMongo();
  const connection = await mongoose
    .createConnection(
      'mongodb://127.0.0.1:27020/goease_f0_test?replicaSet=goease_e2e',
      { autoIndex: false, autoCreate: false },
    )
    .asPromise();
  try {
    const product = createProduct(
      connection,
      parseConfig({
        NODE_ENV: 'development',
        CLIENT_ORIGIN: 'http://localhost:5181',
        MONGODB_URI:
          'mongodb://127.0.0.1:27020/goease_f0_test?replicaSet=goease_e2e',
      }),
    );
    await product.initialize();
    await seedDestinations(product.trips.models.Destination);
  } finally {
    await connection.close();
  }
});
test.afterAll(async () => {
  await stopMongo();
});

test('browser uses live API and database health at desktop and mobile sizes', async ({
  page,
}) => {
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 });
    const api = page.waitForResponse('**/api/v1/health');
    const database = page.waitForResponse('**/api/v1/health/db');
    await page.goto('/dev/foundation');
    const apiResponse = await api;
    const dbResponse = await database;
    expect(apiResponse.status()).toBe(200);
    expect(dbResponse.status()).toBe(200);
    for (const response of [apiResponse, dbResponse])
      expect(response.headers()['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    await expect(
      page.getByRole('region', { name: 'Database', exact: true }),
    ).toContainText('Hoạt động');
    await expect(
      page.getByRole('button', { name: 'Kiểm tra lại' }),
    ).toBeEnabled();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/foundation-${width}.png`,
      fullPage: true,
    });
  }
});

test('API transport failure shows error and supports retry (browser fault injection)', async ({
  page,
}) => {
  await page.route('**/api/v1/health**', (route) => route.abort());
  await page.goto('/dev/foundation');
  await expect(page.getByRole('region', { name: 'Backend API' })).toContainText(
    'Chưa sẵn sàng',
  );
  await expect(
    page.getByRole('region', { name: 'Database', exact: true }),
  ).toContainText('Chưa sẵn sàng');
  await page.unroute('**/api/v1/health**');
  await page.getByRole('button', { name: 'Kiểm tra lại' }).click();
  await expect(
    page.getByRole('region', { name: 'Database', exact: true }),
  ).toContainText('Hoạt động');
});

test('actual MongoDB stop returns 503 in browser; same API recovers after restart', async ({
  page,
  request,
}) => {
  test.setTimeout(60000);
  await page.goto('/dev/foundation');
  await expect(
    page.getByRole('region', { name: 'Database', exact: true }),
  ).toContainText('Hoạt động');
  await stopMongo();
  await expect
    .poll(async () => (await request.get('/api/v1/health/db')).status(), {
      timeout: 15000,
    })
    .toBe(503);
  expect((await request.get('/api/v1/health')).status()).toBe(200);
  await page.getByRole('button', { name: 'Kiểm tra lại' }).click();
  await expect(
    page.getByRole('region', { name: 'Database', exact: true }),
  ).toContainText('Chưa sẵn sàng');
  await expect(page.getByRole('region', { name: 'Backend API' })).toContainText(
    'Hoạt động',
  );
  await startMongo();
  await page.getByRole('button', { name: 'Kiểm tra lại' }).click();
  await expect(
    page.getByRole('region', { name: 'Database', exact: true }),
  ).toContainText('Hoạt động');
});

test('real browser account, manual trip, failed save preservation, reload and relogin', async ({
  page,
  browser,
}) => {
  test.setTimeout(90000);
  const email = `browser-${Date.now()}@example.invalid`;
  const password = 'Browser-only-local-test-2026';
  const storageBlockedPage = await browser.newPage();
  await storageBlockedPage.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('Storage blocked');
      },
    });
  });
  await storageBlockedPage.goto('/');
  await expect(storageBlockedPage).toHaveURL(/\/welcome$/);
  await storageBlockedPage
    .getByRole('link', { name: 'Khám phá trước' })
    .click();
  await expect(
    storageBlockedPage.getByRole('heading', { name: 'Hôm nay, mình đi đâu?' }),
  ).toBeVisible();
  await storageBlockedPage.close();
  await page.goto('/');
  await expect(page).toHaveURL(/\/welcome$/);
  await expect(
    page.getByRole('heading', {
      name: 'Những hành trình đẹp bắt đầu từ một ý tưởng nhỏ.',
    }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: 'test-results/welcome-mobile-390.png',
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: 'test-results/welcome-desktop-1440.png',
    fullPage: true,
  });
  await page.getByRole('link', { name: 'Khám phá trước' }).click();
  await expect(
    page.getByRole('heading', { name: 'Hôm nay, mình đi đâu?' }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Hôm nay, mình đi đâu?' }),
  ).toBeVisible();
  await page.getByLabel('Tìm điểm đến theo tên').fill('Da Nang');
  await expect(
    page.getByRole('button', { name: /Đà Nẵng.*Lên kế hoạch tại đây/ }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: /Đà Nẵng.*Lên kế hoạch tại đây/ })
    .click();
  await expect(page).toHaveURL(/\/trips\/new$/);
  await expect(page.getByLabel('Điểm đến', { exact: true })).toHaveValue(/./);
  await page.getByRole('link', { name: 'Trang chủ', exact: true }).click();
  await page.getByLabel('Tìm điểm đến theo tên').fill('khong co dia diem nay');
  await expect(
    page.getByText('Không tìm thấy điểm đến phù hợp.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Xóa từ khóa' }).click();
  await expect(
    page.getByRole('button', { name: /Đà Nẵng.*Lên kế hoạch tại đây/ }),
  ).toBeVisible();
  await page.route('**/api/v1/destinations', (route) => route.abort());
  await page.reload();
  await expect(
    page.getByText('Chưa tải được danh mục điểm đến.'),
  ).toBeVisible();
  await page.unroute('**/api/v1/destinations');
  await page.getByRole('button', { name: 'Thử lại' }).last().click();
  await expect(
    page.getByRole('button', { name: /Đà Nẵng.*Lên kế hoạch tại đây/ }),
  ).toBeVisible();
  await page
    .getByRole('banner')
    .getByRole('link', { name: 'Đăng nhập', exact: true })
    .click();
  await page.getByRole('link', { name: 'Tạo tài khoản', exact: false }).click();
  await page
    .getByLabel('Tên của bạn', { exact: true })
    .fill('Người thử GoEase');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page
    .getByRole('button', { name: 'Hiện mật khẩu', exact: true })
    .click();
  await expect(page.getByLabel('Mật khẩu', { exact: true })).toHaveAttribute(
    'type',
    'text',
  );
  await page.getByRole('button', { name: 'Ẩn mật khẩu', exact: true }).click();
  await page
    .getByRole('button', { name: 'Tạo tài khoản', exact: false })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Chuyến đi của tôi', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Chuyến đi đầu tiên, bắt đầu thôi.'),
  ).toBeVisible();
  async function login() {
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Đăng nhập', exact: false }).click();
  }
  await expect(
    page.getByRole('heading', { name: 'Chuyến đi của tôi', exact: true }),
  ).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await page
    .getByRole('button', { name: '＋ Tạo chuyến đi', exact: true })
    .click();
  await page
    .getByLabel('Tên chuyến đi', { exact: true })
    .fill('Hai ngày thư thả ở Đà Nẵng');
  await page
    .getByLabel('Điểm đến', { exact: true })
    .selectOption({ label: 'Đà Nẵng' });
  await page.getByLabel('Ngày đi', { exact: true }).fill('2026-11-12');
  await page.getByLabel('Ngày về', { exact: true }).fill('2026-11-13');
  await page.getByLabel('Số người', { exact: true }).fill('2');
  await page
    .getByLabel('Ngân sách tổng nhóm (VND)', { exact: true })
    .fill('2000000');
  await page.getByRole('button', { name: 'Thiên nhiên', exact: true }).click();
  await page.getByRole('button', { name: 'Thêm hoạt động' }).click();
  await page
    .getByLabel('Tên hoạt động', { exact: true })
    .fill('Dạo biển buổi sáng');
  await page.getByLabel('Bắt đầu', { exact: true }).fill('08:00');
  await page.getByLabel('Kết thúc', { exact: true }).fill('09:00');
  await page.getByLabel('Chi phí nhóm (VND)', { exact: true }).fill('200000');
  await page
    .getByLabel('Ghi chú hoạt động', { exact: true })
    .fill('Mang nước uống');
  await page.getByRole('tab', { name: 'Ngày 2' }).click();
  await page.getByRole('button', { name: 'Thêm hoạt động' }).click();
  await page.getByLabel('Tên hoạt động', { exact: true }).fill('Ghé bảo tàng');
  await expect(page.locator('.cost-panel')).toContainText(
    '1 hoạt động chưa rõ chi phí',
  );
  await page.route('**/api/v1/trips', (route) =>
    route.request().method() === 'POST' ? route.abort() : route.continue(),
  );
  await page
    .getByRole('button', { name: 'Tạo chuyến đi', exact: false })
    .click();
  await expect(page.getByRole('status', { name: 'Trạng thái lưu' })).toHaveText(
    'Lưu thất bại',
  );
  await expect(page.getByLabel('Tên hoạt động', { exact: true })).toHaveValue(
    'Ghé bảo tàng',
  );
  await page.unroute('**/api/v1/trips');
  await page
    .getByRole('button', { name: 'Tạo chuyến đi', exact: false })
    .click();
  await expect(page.getByRole('status', { name: 'Trạng thái lưu' })).toHaveText(
    'Đã lưu',
  );
  const savedUrl = page.url();
  await page.getByRole('link', { name: 'Trang chủ', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Hai ngày thư thả ở Đà Nẵng' }),
  ).toBeVisible();
  await page.route('**/api/v1/trips', (route) => route.abort());
  await page.reload();
  await expect(page.getByText('Chưa tải được chuyến đi.')).toBeVisible();
  await page.unroute('**/api/v1/trips');
  await page.getByRole('button', { name: 'Thử lại' }).last().click();
  await expect(
    page.getByRole('heading', { name: 'Hai ngày thư thả ở Đà Nẵng' }),
  ).toBeVisible();
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/home-${width}.png`,
      fullPage: true,
    });
  }
  await page.goto(savedUrl);
  await page.reload();
  await expect(page.getByRole('status', { name: 'Trạng thái lưu' })).toHaveText(
    'Đã lưu',
  );
  await page.getByRole('tab', { name: 'Ngày 2' }).click();
  await expect(page.getByLabel('Tên hoạt động', { exact: true })).toHaveValue(
    'Ghé bảo tàng',
  );
  await page
    .getByLabel('Tên hoạt động', { exact: true })
    .fill('Ghé bảo tàng, thong thả');
  await page.getByRole('button', { name: 'Thêm hoạt động' }).click();
  await page
    .getByRole('button', { name: 'Xóa hoạt động 2', exact: true })
    .click();
  await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(page.getByRole('status', { name: 'Trạng thái lưu' })).toHaveText(
    'Đã lưu',
  );
  // A stale browser revision keeps the unsaved input instead of overwriting server data.
  const current = await page.request.get(
    new URL(savedUrl).pathname.replace('/trips/', '/api/v1/trips/'),
  );
  const stored = (await current.json()) as {
    data: { trip: import('@goease/contracts').TripDto };
  };
  const { id: _id, revision } = stored.data.trip;
  const input = inputFromTrip(stored.data.trip);
  const newer = await page.request.patch(`/api/v1/trips/${_id}`, {
    headers: {
      Origin: new URL(savedUrl).origin,
      'X-GoEase-Client': 'web',
      'Idempotency-Key': crypto.randomUUID(),
    },
    data: { trip: input, expectedRevision: revision },
  });
  expect(newer.status()).toBe(200);
  await page
    .getByLabel('Ghi chú chuyến đi', { exact: true })
    .fill('Ghi chú giữ khi xung đột');
  await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(page.getByRole('status', { name: 'Trạng thái lưu' })).toHaveText(
    'Lưu thất bại',
  );
  await expect(
    page.getByLabel('Ghi chú chuyến đi', { exact: true }),
  ).toHaveValue('Ghi chú giữ khi xung đột');
  await page.reload();
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByLabel('Tên chuyến đi', { exact: true })).toHaveValue(
      'Hai ngày thư thả ở Đà Nẵng',
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/product-trip-${width}.png`,
      fullPage: true,
    });
  }
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
  await page.goto('/login');
  await login();
  await page.getByRole('link', { name: 'Mở lịch trình' }).click();
  await page.getByRole('tab', { name: 'Ngày 2' }).click();
  await expect(page.getByLabel('Tên hoạt động', { exact: true })).toHaveValue(
    'Ghé bảo tàng, thong thả',
  );
  const contextB = await browser.newContext();
  try {
    const request = contextB.request;
    const origin = new URL(savedUrl).origin;
    const headers = { Origin: origin, 'X-GoEase-Client': 'web' };
    const emailB = `other-${Date.now()}@example.invalid`;
    expect(
      (
        await request.post(origin + '/api/v1/auth/register', {
          headers,
          data: { email: emailB, password, displayName: 'Tài khoản khác' },
        })
      ).status(),
    ).toBe(201);
    expect(
      (await request.get(origin + '/api/v1/auth/me', { headers })).status(),
    ).toBe(200);
    expect(
      (await request.get(origin + '/api/v1/dev/mailbox', { headers })).status(),
    ).toBe(404);
    expect(
      (
        await request.post(origin + '/api/v1/auth/login', {
          headers,
          data: { email: emailB, password },
        })
      ).status(),
    ).toBe(200);
    const otherPage = await contextB.newPage();
    await otherPage.goto(savedUrl);
    await expect(
      otherPage
        .getByRole('alert')
        .filter({ hasText: 'Không tìm thấy chuyến đi của bạn.' }),
    ).toContainText('Không tìm thấy chuyến đi của bạn.');
    await expect(
      otherPage.getByLabel('Tên chuyến đi', { exact: true }),
    ).toHaveCount(0);
    await otherPage.goto('/');
    await expect(otherPage.getByText('Chào, Tài khoản khác')).toBeVisible();
    await expect(otherPage.getByText('Chưa có chuyến đi nào')).toBeVisible();
    await expect(otherPage.getByText('Hai ngày thư thả ở Đà Nẵng')).toHaveCount(
      0,
    );
    expect(
      (
        await request.patch(origin + `/api/v1/trips/${_id}`, {
          headers: { ...headers, 'Idempotency-Key': crypto.randomUUID() },
          data: { trip: input, expectedRevision: revision },
        })
      ).status(),
    ).toBe(404);
  } finally {
    await contextB.close();
  }
});
