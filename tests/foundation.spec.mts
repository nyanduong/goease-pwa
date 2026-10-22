import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { once } from 'node:events';
import mongoose from 'mongoose';
import { createProduct } from '../server/src/product.js';
import { parseConfig } from '../server/src/config.js';
import { seedDestinations } from '../server/src/features/trips/destination-seed.js';
import { seedPlaces } from '../server/src/features/explore/explore.seed.js';
import type { TripDto, TripInput } from '@goease/contracts';
// Build the HTTP write payload independently of browser modules. Mixing .ts/CJS
// and .mts/ESM browser-helper imports makes the full Playwright suite ambiguous.
function inputFromTrip(trip: TripDto): TripInput {
  return {
    title: trip.title,
    destinations: trip.destinations,
    startDate: trip.startDate,
    endDate: trip.endDate,
    timezone: trip.timezone,
    travelers: trip.travelers,
    budget: trip.budget,
    preferences: trip.preferences,
    generationMode: trip.generationMode,
    ...(trip.aiRunId ? { aiRunId: trip.aiRunId } : {}),
    days: trip.days,
    notes: trip.notes,
  };
}
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
    await seedPlaces(product.explore.models.Place);
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
  await page.addInitScript(() => {
    localStorage.setItem('goease:onboarding:seen:v1', 'true');
  });
  await page.context().addCookies([
    {
      name: 'goease_session',
      value: 'x'.repeat(43),
      url: `${e2eApiOrigin}/api/v1`,
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
  await page.goto('/');
  await expect(page).toHaveURL(/\/welcome$/);
  await expect(
    page.getByRole('heading', {
      name: 'Just go. We’ll plan.',
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
  await page.getByRole('button', { name: 'Bắt đầu hành trình' }).click();
  await expect(
    page.getByRole('heading', { name: 'Hôm nay, mình đi đâu?' }),
  ).toBeVisible();
  await page
    .getByRole('searchbox', { name: 'Tìm điểm đến ở Việt Nam' })
    .click();
  await expect(page).toHaveURL(/\/login$/);
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
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole('heading', { name: 'Hôm nay, mình đi đâu?' }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/trips');
  await expect(
    page.getByRole('heading', { name: 'Mỗi chuyến đi, một câu chuyện.' }),
  ).toBeVisible();
  await expect(page.getByText('Một nơi bạn luôn muốn đến?')).toBeVisible();
  await page
    .getByRole('button', { name: 'Tạo chuyến đi', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Gợi ý lịch trình', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText('Chọn điểm đến');
  await page.getByRole('button', { name: /^Điểm đến/ }).click();
  await page
    .getByLabel('Điểm đến', { exact: true })
    .selectOption({ label: 'Hội An' });
  await page.getByRole('button', { name: 'Xong', exact: true }).click();
  await page.getByRole('button', { name: /^Thời gian/ }).click();
  await page.getByLabel('Ngày đi', { exact: true }).fill('2026-11-12');
  await page.getByLabel('Ngày về', { exact: true }).fill('2026-11-14');
  await page.getByRole('button', { name: 'Xong', exact: true }).click();
  await page.getByRole('button', { name: /^Đi cùng/ }).click();
  await page.getByLabel('Số người', { exact: true }).fill('4');
  await page.getByRole('button', { name: 'Xong', exact: true }).click();
  await page.getByRole('button', { name: /^Ngân sách cả nhóm/ }).click();
  await page
    .getByLabel('Ngân sách tổng nhóm (VND)', { exact: true })
    .fill('10000000');
  await page.getByRole('button', { name: 'Xong', exact: true }).click();
  await page.getByRole('button', { name: 'Ẩm thực', exact: true }).click();
  await page.getByRole('button', { name: 'Văn hóa', exact: true }).click();
  await page.getByRole('button', { name: 'Thư thả', exact: true }).click();
  await mkdir('.local/journey-preview', { recursive: true });
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: '.local/journey-preview/create-390.png',
    fullPage: false,
  });
  await page
    .getByRole('button', { name: 'Gợi ý lịch trình', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Đóng', exact: true }).click();
  async function addStop(
    title: string,
    start: string,
    end: string,
    cost?: string,
  ) {
    await page
      .getByRole('button', { name: 'Thêm điểm dừng', exact: true })
      .click();
    await page.getByLabel('Tên hoạt động', { exact: true }).fill(title);
    await page.getByLabel('Bắt đầu', { exact: true }).fill(start);
    await page.getByLabel('Kết thúc', { exact: true }).fill(end);
    if (cost)
      await page.getByLabel('Chi phí nhóm (VND)', { exact: true }).fill(cost);
    await page
      .getByRole('button', { name: 'Thêm vào lịch trình', exact: true })
      .click();
  }
  await addStop('Dạo phố cổ', '08:30', '10:00', '200000');
  await addStop('Cơm gà Hội An', '11:30', '12:30');
  await addStop('Làng rau Trà Quế', '15:00', '16:00');
  await addStop('Dạo sông Hoài', '18:00', '19:00');
  await page
    .getByRole('button', { name: 'Đưa Cơm gà Hội An lên', exact: true })
    .click();
  await expect(page.locator('.journey-stop-open').first()).toContainText(
    'Cơm gà Hội An',
  );
  await page
    .getByRole('button', { name: 'Đưa Cơm gà Hội An xuống', exact: true })
    .click();
  await page.getByRole('tab', { name: 'Ngày 2', exact: true }).click();
  await addStop('Một ngày thong thả', '09:00', '10:00');
  await page.getByRole('button', { name: 'Chi phí', exact: true }).click();
  await expect(page.locator('.journey-budget-view')).toContainText(
    '4 điểm dừng chưa rõ chi phí',
  );
  await expect(page.locator('.journey-budget-view')).toContainText('200.000');
  await page.getByRole('button', { name: 'Quay lại', exact: true }).click();
  await page
    .getByRole('button', { name: 'Xem lại chuyến đi', exact: true })
    .click();
  await page
    .getByLabel('Tên chuyến đi', { exact: true })
    .fill('Ba ngày thư thả ở Hội An');
  await page.route('**/api/v1/trips', (route) =>
    route.request().method() === 'POST' ? route.abort() : route.continue(),
  );
  await page
    .getByRole('button', { name: 'Lưu chuyến đi', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText('Không kết nối');
  await expect(page.getByLabel('Tên chuyến đi', { exact: true })).toHaveValue(
    'Ba ngày thư thả ở Hội An',
  );
  await page.unroute('**/api/v1/trips');
  await page
    .getByRole('button', { name: 'Lưu chuyến đi', exact: true })
    .click();
  await expect(page.getByRole('status', { name: 'Trạng thái lưu' })).toHaveText(
    'Đã lưu',
  );
  const savedUrl = page.url();
  await page.reload();
  await expect(page.locator('.journey-stop-open')).toHaveCount(4);
  await page.screenshot({
    path: '.local/journey-preview/itinerary-390.png',
    fullPage: false,
  });
  await page.getByRole('button', { name: 'Bản đồ', exact: true }).click();
  await expect(page.getByRole('link', { name: /Dạo phố cổ/ })).toHaveAttribute(
    'href',
    /google.com\/maps\/search/,
  );
  await page.getByRole('button', { name: 'Lịch trình', exact: true }).click();
  await page.getByRole('tab', { name: 'Ngày 2', exact: true }).click();
  await page.locator('.journey-stop-open').click();
  await page
    .getByLabel('Tên hoạt động', { exact: true })
    .fill('Một ngày thong thả, ghé bảo tàng');
  await page
    .getByRole('button', { name: 'Áp dụng thay đổi', exact: true })
    .click();
  await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
  await expect(page.getByRole('status', { name: 'Trạng thái lưu' })).toHaveText(
    'Đã lưu',
  );
  const path = new URL(savedUrl).pathname.replace('/trips/', '/api/v1/trips/');
  const current = await page.request.get(path);
  const stored = (await current.json()) as {
    data: { trip: import('@goease/contracts').TripDto };
  };
  expect(stored.data.trip.days[0]!.activities.map((a) => a.order)).toEqual([
    0, 1, 2, 3,
  ]);
  expect(stored.data.trip.preferences.pace).toBe('relaxed');
  expect(stored.data.trip.preferences.interestCodes).toEqual([
    'food',
    'culture',
  ]);
  expect(stored.data.trip.budget.amountMinor).toBe(10000000);
  await page.getByRole('button', { name: 'Chi phí', exact: true }).click();
  await expect(page.locator('.budget-total')).toContainText('200.000');
  await expect(page.getByRole('meter')).toHaveAttribute('aria-valuenow', '2');
  await expect(page.locator('.budget-disclaimer')).toContainText(
    '4 điểm dừng chưa rõ chi phí',
  );
  await page.getByRole('button', { name: 'Quay lại', exact: true }).click();
  await page.getByRole('button', { name: /Muốn đổi nhịp/ }).click();
  await expect(page.locator('.goe-context-chip')).toContainText(
    'Hội An · Ngày 2',
  );
  await page.getByRole('button', { name: 'Xem thay đổi', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText(
    'Ngày này có 1 điểm dừng',
  );
  await page.getByRole('button', { name: 'Áp dụng vào bản minh họa' }).click();
  const unchanged = await page.request.get(path);
  expect((await unchanged.json()).data.trip.revision).toBe(
    stored.data.trip.revision,
  );
  await page.getByRole('button', { name: 'Quay lại', exact: true }).click();
  await expect(page.getByRole('status', { name: 'Trạng thái lưu' })).toHaveText(
    'Đã lưu',
  );
  const input = inputFromTrip(stored.data.trip);
  const headers = {
    Origin: new URL(savedUrl).origin,
    'X-GoEase-Client': 'web',
    'Idempotency-Key': crypto.randomUUID(),
  };
  expect(
    (
      await page.request.patch(path, {
        headers,
        data: { trip: input, expectedRevision: stored.data.trip.revision },
      })
    ).status(),
  ).toBe(200);
  await page
    .getByLabel('Ghi chú chuyến đi', { exact: true })
    .fill('Giữ bản nháp khi xung đột');
  await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
  await expect(page.getByRole('status', { name: 'Trạng thái lưu' })).toHaveText(
    'Lưu thất bại',
  );
  await expect(
    page.getByLabel('Ghi chú chuyến đi', { exact: true }),
  ).toHaveValue('Giữ bản nháp khi xung đột');
  page.once('dialog', (d) => d.accept());
  await page.reload();
  await expect(page.getByRole('status', { name: 'Trạng thái lưu' })).toHaveText(
    'Đã lưu',
  );
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Quay lại', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Ba ngày thư thả ở Hội An' }),
  ).toBeVisible();
  await page.screenshot({
    path: '.local/journey-preview/list-390.png',
    fullPage: false,
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: false }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto(savedUrl);
  await page.getByRole('tab', { name: 'Ngày 2', exact: true }).click();
  await expect(page.locator('.journey-stop-open')).toContainText(
    'Một ngày thong thả, ghé bảo tàng',
  );
  const contextB = await browser.newContext();
  try {
    const origin = new URL(savedUrl).origin;
    expect(
      (
        await contextB.request.post(origin + '/api/v1/auth/register', {
          headers,
          data: {
            email: `other-${Date.now()}@example.invalid`,
            password,
            displayName: 'Tài khoản khác',
          },
        })
      ).status(),
    ).toBe(201);
    expect((await contextB.request.get(origin + path)).status()).toBe(404);
    expect(
      (
        await contextB.request.patch(origin + path, {
          headers: { ...headers, 'Idempotency-Key': crypto.randomUUID() },
          data: { trip: input, expectedRevision: stored.data.trip.revision },
        })
      ).status(),
    ).toBe(404);
    const otherPage = await contextB.newPage();
    await otherPage.goto(savedUrl);
    await expect(
      otherPage.getByText('Không tìm thấy chuyến đi của bạn.'),
    ).toBeVisible();
    await expect(otherPage.locator('.journey-stop')).toHaveCount(0);
  } finally {
    await contextB.close();
  }
});
test('Hoi An catalog journey and server budget stay connected across save and reload', async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/register');
  const email = `hoian-browser-${Date.now()}@example.invalid`;
  const password = 'HoiAn-browser-test-2026';
  await page.getByLabel('Tên của bạn', { exact: true }).fill('Người đi Hội An');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page
    .getByRole('button', { name: 'Tạo tài khoản', exact: false })
    .click();
  await expect(page).toHaveURL(/\/$/);
  await page
    .getByRole('button', { name: 'Lên kế hoạch đến Hội An', exact: true })
    .click();
  await page.getByRole('button', { name: /^Thời gian/ }).click();
  await page.getByLabel('Ngày đi', { exact: true }).fill('2026-11-12');
  await page.getByLabel('Ngày về', { exact: true }).fill('2026-11-14');
  await page.getByRole('button', { name: 'Xong', exact: true }).click();
  await page.getByRole('button', { name: /^Đi cùng/ }).click();
  await page.getByLabel('Số người', { exact: true }).fill('4');
  await page.getByRole('button', { name: 'Xong', exact: true }).click();
  await page.getByRole('button', { name: /^Ngân sách cả nhóm/ }).click();
  await page
    .getByLabel('Ngân sách tổng nhóm (VND)', { exact: true })
    .fill('1000000');
  await page.getByRole('button', { name: 'Xong', exact: true }).click();
  await page
    .getByRole('button', { name: 'Gợi ý lịch trình', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Thêm Phố cổ Hội An', exact: true })
    .click();
  await page.locator('.journey-stop-open').first().click();
  await page
    .getByRole('button', { name: 'Dùng vé tham quan 80.000đ', exact: true })
    .click();
  await expect(
    page.getByLabel('Chi phí mỗi người (VND)', { exact: true }),
  ).toHaveValue('80000');
  await page
    .getByRole('button', { name: 'Áp dụng thay đổi', exact: true })
    .click();
  for (const [day, name] of [
    [2, 'Làng rau Trà Quế'],
    [3, 'Biển An Bàng'],
  ] as const) {
    await page.getByRole('tab', { name: `Ngày ${day}`, exact: true }).click();
    await page.getByRole('button', { name: /Tìm một nơi hợp gu/ }).click();
    await page
      .getByRole('button', { name: `Thêm ${name}`, exact: true })
      .click();
  }
  await page.getByRole('button', { name: 'Chi phí', exact: true }).click();
  await expect(page.locator('.budget-total')).toContainText('320.000');
  await expect(page.locator('.budget-disclaimer')).toContainText(
    '2 điểm dừng chưa rõ',
  );
  await page.getByRole('button', { name: 'Quay lại', exact: true }).click();
  await page
    .getByRole('button', { name: 'Xem lại chuyến đi', exact: true })
    .click();
  await page
    .getByLabel('Tên chuyến đi', { exact: true })
    .fill('Hội An nối dữ liệu thật');
  await page
    .getByRole('button', { name: 'Lưu chuyến đi', exact: true })
    .click();
  await expect(page).toHaveURL(/\/trips\/[a-f0-9]{24}$/);
  const tripUrl = page.url();
  await expect(page.getByRole('status', { name: 'Trạng thái lưu' })).toHaveText(
    'Đã lưu',
  );
  await page
    .getByRole('button', { name: 'Thông tin chuyến đi', exact: true })
    .click();
  await page.getByRole('button', { name: /^Đi cùng/ }).click();
  await page.getByLabel('Số người', { exact: true }).fill('5');
  await page.getByRole('button', { name: 'Xong', exact: true }).click();
  await page.getByRole('button', { name: 'Quay lại', exact: true }).click();
  await page.getByRole('button', { name: 'Chi phí', exact: true }).click();
  await expect(page.locator('.budget-total')).toContainText('400.000');
  await expect(page.locator('.budget-per-person')).toContainText('80.000');
  await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
  await expect(page.getByRole('status', { name: 'Trạng thái lưu' })).toHaveText(
    'Đã lưu',
  );
  await page.reload();
  await page.getByRole('button', { name: 'Chi phí', exact: true }).click();
  await expect(page.locator('.budget-total')).toContainText('400.000');
  await mkdir('.local/hoian-preview', { recursive: true });
  await page.screenshot({ path: '.local/hoian-preview/budget-live-390.png' });
  // A failed preview must not masquerade as a successful, freshly calculated budget.
  await page.route('**/api/v1/trips/budget-preview', (r) => r.abort());
  await page.getByRole('button', { name: 'Quay lại', exact: true }).click();
  await page.getByRole('button', { name: 'Chi phí', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText(
    'Chưa tính được ngân sách',
  );
  await page.unroute('**/api/v1/trips/budget-preview');
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
  await expect(page.locator('.budget-total')).toContainText('400.000');
  await page.getByRole('link', { name: 'Khám phá', exact: true }).click();
  await page
    .getByRole('button', { name: /Cơm gà Hội An/ })
    .first()
    .click();
  await page
    .getByRole('button', { name: 'Thêm vào chuyến đi', exact: false })
    .first()
    .click();
  await page
    .getByLabel('Chuyến đi tại Hội An')
    .selectOption({ label: 'Hội An nối dữ liệu thật' });
  await page.getByLabel('Ngày ghé thăm').selectOption({ label: '2026-11-13' });
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Thêm vào chuyến đi', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Mở chuyến đi →', exact: true })
    .click();
  await expect(
    page.getByRole('tab', { name: 'Ngày 2', exact: true }),
  ).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.journey-stop-open')).toHaveCount(2);
  await page.getByRole('button', { name: 'Chi phí', exact: true }).click();
  await expect(page.locator('.budget-disclaimer')).toContainText(
    '3 điểm dừng chưa rõ',
  );
  await expect(page.locator('.budget-total')).toContainText('400.000');
  const stored = (
    await (
      await page.request.get(
        new URL(tripUrl).pathname.replace('/trips/', '/api/v1/trips/'),
      )
    ).json()
  ).data.trip;
  expect(stored.days[0].activities[0].placeId).toBe('100000000000000000000001');
  expect(stored.days[1].activities[1].placeId).toBe('100000000000000000000002');
  expect(stored.budgetSummary.knownEstimatedMinor).toBe(400000);
  await page.goto('/');
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: false }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto(tripUrl);
  await page.getByRole('button', { name: 'Chi phí', exact: true }).click();
  await expect(page.locator('.budget-total')).toContainText('400.000');
});

test('live Gemini proposal applies saves reloads and preserves AI provenance', async ({
  page,
}) => {
  test.skip(
    process.env.LIVE_GEMINI !== '1',
    'Explicit opt-in: uses real Gemini quota.',
  );
  test.setTimeout(150000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/register');
  await page
    .getByLabel('Tên của bạn', { exact: true })
    .fill('Gemini acceptance traveler');
  await page
    .getByLabel('Email', { exact: true })
    .fill(`gemini-${Date.now()}@example.invalid`);
  await page
    .getByLabel('Mật khẩu', { exact: true })
    .fill('Gemini-acceptance-only-2026');
  await page
    .getByRole('button', { name: 'Tạo tài khoản', exact: false })
    .click();
  await expect(page).toHaveURL(/\/$/);
  await page
    .getByRole('button', { name: 'Lên kế hoạch đến Hội An', exact: true })
    .click();
  await page.getByRole('button', { name: /^Thời gian/ }).click();
  await page.getByLabel('Ngày đi', { exact: true }).fill('2026-11-12');
  await page.getByLabel('Ngày về', { exact: true }).fill('2026-11-14');
  await page.getByRole('button', { name: 'Xong', exact: true }).click();
  const generated = page.waitForResponse('**/api/v1/trips/ai-proposal', {
    timeout: 65000,
  });
  await page
    .getByRole('button', { name: 'Tạo đề xuất bằng Gemini', exact: true })
    .click();
  const response = await generated;
  const result = await response.json();
  expect(response.status(), JSON.stringify(result.error ?? {})).toBe(200);
  expect(result.data.trip.generationMode).toBe('ai');
  expect(result.data.trip.days).toHaveLength(3);
  expect(
    (await (await page.request.get('/api/v1/trips')).json()).data.items,
  ).toHaveLength(0);
  await expect(
    page.getByText('Đề xuất của Goe · Chưa áp dụng', { exact: true }),
  ).toBeVisible();
  await mkdir('.local/ai-preview', { recursive: true });
  await page.screenshot({
    path: '.local/ai-preview/live-proposal.png',
    fullPage: true,
  });
  await page
    .getByRole('button', {
      name: 'Dùng đề xuất này trong bản nháp',
      exact: true,
    })
    .click();
  await expect(page.locator('.journey-stop-open')).toHaveCount(
    result.data.trip.days[0].activities.length,
  );
  await page
    .getByRole('button', { name: 'Xem lại chuyến đi', exact: true })
    .click();
  await page
    .getByLabel('Tên chuyến đi', { exact: true })
    .fill('Hội An – Gemini live acceptance');
  const saved = page.waitForResponse(
    (r) => r.url().endsWith('/api/v1/trips') && r.request().method() === 'POST',
  );
  await page
    .getByRole('button', { name: 'Lưu chuyến đi', exact: true })
    .click();
  const savedResponse = await saved;
  expect(
    savedResponse.status(),
    JSON.stringify((await savedResponse.json()).error ?? {}),
  ).toBe(201);
  await expect(page).toHaveURL(/\/trips\/[a-f0-9]{24}$/);
  const endpoint = new URL(page.url()).pathname.replace(
    '/trips/',
    '/api/v1/trips/',
  );
  await page.reload();
  await expect(page.getByRole('status', { name: 'Trạng thái lưu' })).toHaveText(
    'Đã lưu',
  );
  const stored = (await (await page.request.get(endpoint)).json()).data
    .trip as TripDto;
  expect(stored.aiRunId).toBe(result.data.runId);
  expect(stored.days).toEqual(result.data.trip.days);
  expect(stored.generationMode).toBe('ai');
  expect(stored.budgetSummary?.missingCostCount).toBe(
    stored.days.flatMap((d) => d.activities).length,
  );
  await page.screenshot({
    path: '.local/ai-preview/live-saved-reloaded.png',
    fullPage: true,
  });
  // The same run is recovered without another provider request or quota unit.
  const recovered = await page.request.post('/api/v1/trips/ai-proposal', {
    headers: {
      Origin: new URL(page.url()).origin,
      'X-GoEase-Client': 'web',
      'Idempotency-Key': response.request().headers()['idempotency-key']!,
    },
    data: response.request().postDataJSON(),
  });
  expect(recovered.status()).toBe(200);
  expect((await recovered.json()).data.runId).toBe(stored.aiRunId);
});
