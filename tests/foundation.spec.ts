import { images } from '@goease/media';
import { createHash, randomBytes } from 'node:crypto';
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
import { catalogCost, type PlaceDto } from '@goease/contracts';
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
import { catalogToday } from '@goease/contracts';

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
  await expect(
    page.getByRole('button', { name: 'Lên lịch giúp mình' }),
  ).toBeDisabled();
  await page
    .getByRole('button', { name: 'Hội An Goe kiểm tra dữ liệu khi lập lịch' })
    .click();
  await page.getByRole('button', { name: 'Khác', exact: true }).click();
  await page
    .getByRole('combobox', { name: 'Số ngày', exact: true })
    .selectOption('8');
  await expect(
    page.getByRole('button', { name: 'Lên lịch giúp mình' }),
  ).toBeDisabled();
  await page.getByRole('button', { name: '2 ngày', exact: true }).click();
  await page.getByRole('button', { name: '3 ngày', exact: true }).click();
  await page.getByRole('button', { name: 'Nhóm / gia đình' }).click();
  await page.getByLabel('Số người', { exact: true }).fill('4');
  await page
    .getByText('Sở thích, nhịp đi & ngân sách', { exact: false })
    .click();
  await page
    .getByLabel('Ngân sách cả nhóm (VND)', { exact: true })
    .fill('10000000');
  await page.getByRole('button', { name: 'Ẩm thực', exact: true }).click();
  await page.getByRole('button', { name: 'Văn hóa', exact: true }).click();
  await page.getByLabel('Nhịp đi', { exact: true }).selectOption('relaxed');
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
    .getByRole('button', { name: 'Tự chọn điểm dừng', exact: true })
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
    await page
      .getByRole('button', { name: 'Tự thêm điểm dừng', exact: false })
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
  await page.getByRole('button', { name: 'Giữ lịch này', exact: true }).click();
  await page.getByLabel('Ngày khởi hành', { exact: true }).fill('2026-11-12');
  await page.getByText('Đổi tên hoặc thêm ghi chú', { exact: false }).click();
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
  await expect(page.getByRole('meter')).toHaveCount(0);
  await expect(page.locator('.budget-incomplete')).toContainText(
    'Chưa đủ dữ liệu',
  );
  await expect(page.locator('.budget-disclaimer')).toContainText(
    '4 điểm dừng chưa rõ chi phí',
  );
  await page.getByRole('button', { name: 'Quay lại', exact: true }).click();
  await page.getByRole('button', { name: /Muốn đổi nhịp/ }).click();
  await expect(page.locator('.goe-context-chip')).toContainText(
    'Hội An · Ngày 2',
  );
  await expect(
    page.getByLabel('Hỏi Goe về chuyến đi', { exact: true }),
  ).toBeEnabled();
  await expect(page.getByRole('log')).toContainText('bạn xác nhận rồi mới lưu');
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
  await page.getByRole('button', { name: '3 ngày', exact: true }).click();
  await page.getByRole('button', { name: 'Nhóm / gia đình' }).click();
  await page.getByLabel('Số người', { exact: true }).fill('4');
  await page
    .getByText('Sở thích, nhịp đi & ngân sách', { exact: false })
    .click();
  await page
    .getByLabel('Ngân sách cả nhóm (VND)', { exact: true })
    .fill('1000000');
  await page
    .getByRole('button', { name: 'Tự chọn điểm dừng', exact: true })
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
  await page.getByRole('button', { name: 'Giữ lịch này', exact: true }).click();
  await page.getByLabel('Ngày khởi hành', { exact: true }).fill('2026-11-12');
  await page.getByText('Đổi tên hoặc thêm ghi chú', { exact: false }).click();
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
    .getByLabel('Ghi chú của bạn', { exact: true })
    .fill('Ăn trưa cùng nhóm');
  await page.getByRole('button', { name: 'Lưu ghi chú', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Đã lưu ghi chú.');
  await page
    .getByRole('button', { name: 'Lưu địa điểm', exact: true })
    .first()
    .click();
  await expect(page.getByRole('status')).toHaveText('Đã lưu địa điểm.');
  await page.goto('/saved');
  await expect(page.locator('.explore-card')).toHaveCount(1);
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '.local/hoian-preview/saved-live-390.png' });
  await page
    .getByRole('button', {
      name: 'Thêm Cơm gà Hội An vào chuyến đi',
      exact: true,
    })
    .click();
  await expect(page.getByRole('dialog')).toBeVisible();
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
  expect(stored.days[1].activities[1].notes).toBe('Ăn trưa cùng nhóm');
  await page.goto('/saved');
  await page
    .getByRole('button', {
      name: 'Thêm Cơm gà Hội An vào chuyến đi',
      exact: true,
    })
    .click();
  await page
    .getByLabel('Chuyến đi tại Hội An')
    .selectOption({ label: 'Hội An nối dữ liệu thật' });
  await page.getByLabel('Ngày ghé thăm').selectOption({ label: '2026-11-13' });
  const duplicatePrompt = page.waitForEvent('dialog');
  page.once('dialog', (dialog) => dialog.dismiss());
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Thêm vào chuyến đi', exact: true })
    .click();
  expect((await duplicatePrompt).message()).toContain('đã có trong ngày');
  await expect(
    page
      .getByRole('dialog')
      .getByRole('button', { name: 'Thêm vào chuyến đi', exact: true }),
  ).toBeEnabled();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.getByRole('button', { name: 'Về Đã lưu', exact: true }).click();
  await expect(page).toHaveURL(/\/saved$/);
  await page.locator('.explore-save').click();
  await expect(page.locator('.explore-card')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.explore-card')).toHaveCount(0);
  const unchanged = (
    await (
      await page.request.get(
        new URL(tripUrl).pathname.replace('/trips/', '/api/v1/trips/'),
      )
    ).json()
  ).data.trip;
  expect(unchanged.revision).toBe(stored.revision);
  expect(unchanged.days[1].activities).toHaveLength(2);
  await page.goto(tripUrl);
  await page.getByRole('button', { name: 'Bản đồ', exact: true }).click();
  await expect(page.locator('.trip-map-pin')).toHaveCount(1);
  await expect(
    page.getByRole('link', {
      name: 'Chỉ đường đến Phố cổ Hội An',
      exact: true,
    }),
  ).toHaveAttribute('href', /destination=15.8771291%2C108.3286631/);
  await page.locator('.trip-map-pin').click();
  await expect(page.locator('.trip-map-selected')).toContainText(
    'Phố cổ Hội An',
  );
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '.local/hoian-preview/trip-map-live-390.png' });
  await page.getByRole('tab', { name: 'Ngày 2', exact: true }).click();
  await expect(page.locator('.trip-map-pin')).toHaveCount(1);
  await expect(page.locator('.trip-map-stops')).toContainText('Chưa có tọa độ');
  await expect(
    page.getByRole('link', {
      name: 'Tìm Cơm gà Hội An trên Google Maps',
      exact: true,
    }),
  ).toHaveAttribute('href', /maps\/search/);
  await expect(page.locator('.trip-map-selected')).toHaveCount(0);
  await page.route('**/api/v1/places/100000000000000000000004', (r) =>
    r.abort(),
  );
  await page.getByRole('tab', { name: 'Ngày 3', exact: true }).click();
  await expect(page.getByText('Chưa tải được một số địa điểm.')).toBeVisible();
  await page.unroute('**/api/v1/places/100000000000000000000004');
  await page.route('https://tile.openstreetmap.org/**', (r) => r.abort());
  await page.getByRole('button', { name: 'Thử lại vị trí' }).click();
  await expect(page.locator('.trip-map-pin')).toHaveCount(1);
  await expect(
    page.getByRole('button', { name: 'Tải lại bản đồ' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Chỉ đường đến Biển An Bàng', exact: true }),
  ).toBeVisible();
  await page.unroute('https://tile.openstreetmap.org/**');

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

test('real expenses create retry edit conflict delete and persist independently of itinerary', async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/register');
  const email = `expense-browser-${Date.now()}@example.invalid`,
    password = 'Expenses-browser-only-2026';
  await page
    .getByLabel('Tên của bạn', { exact: true })
    .fill('Người ghi chi tiêu');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page
    .getByRole('button', { name: 'Tạo tài khoản', exact: false })
    .click();
  await expect(page).toHaveURL(/\/$/);
  const headers = () => ({
    Origin: new URL(page.url()).origin,
    'X-GoEase-Client': 'web',
    'Idempotency-Key': crypto.randomUUID(),
  });
  const destinationId = '000000000000000000000004';
  const input: TripInput = {
    title: 'Hội An và chi tiêu',
    destinations: [{ destinationId, order: 0 }],
    startDate: '2026-11-12',
    endDate: '2026-11-12',
    timezone: 'Asia/Ho_Chi_Minh',
    travelers: { totalCount: 4 },
    budget: {
      amountMinor: 1000000,
      currency: 'VND',
      scope: 'group_total',
      includedCategories: [],
    },
    preferences: { interestCodes: [], pace: 'relaxed', transportModes: [] },
    generationMode: 'manual',
    notes: '',
    days: [
      {
        dayId: crypto.randomUUID(),
        date: '2026-11-12',
        destinationId,
        activities: [100000, null].map((amountMinor, order) => ({
          activityId: crypto.randomUUID(),
          kind: 'visit',
          title: `Điểm ${order + 1}`,
          timezone: 'Asia/Ho_Chi_Minh',
          order,
          notes: '',
          source: 'manual',
          estimatedCost: {
            amountMinor,
            currency: 'VND',
            basis: 'group_total',
            quantity: 1,
            confidence: 'user_entered',
          },
        })),
      },
    ],
  };
  const created = await page.request.post('/api/v1/trips', {
    headers: headers(),
    data: { trip: input },
  });
  expect(created.status()).toBe(201);
  const trip: TripDto = (await created.json()).data.trip;
  const path = `/api/v1/trips/${trip.id}/expenses`;
  await page.goto(`/trips/${trip.id}`);
  await page.getByRole('button', { name: 'Chi phí', exact: true }).click();
  await page.getByRole('button', { name: 'Thực chi', exact: true }).click();
  await expect(
    page.getByText('Chưa ghi nhận khoản chi nào.', { exact: false }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: '+ Thêm khoản chi', exact: true })
    .click();
  await page
    .getByLabel('Tên khoản chi', { exact: true })
    .fill('Ăn trưa cả nhóm');
  await page.getByLabel('Số tiền đã chi (VND)', { exact: true }).fill('240000');
  await page.getByLabel('Ngày chi', { exact: true }).fill('2026-11-11');
  const keys: string[] = [];
  let drop = true;
  await page.route(`**${path}`, async (r) => {
    if (r.request().method() !== 'POST') return r.continue();
    keys.push(r.request().headers()['idempotency-key']!);
    const response = await r.fetch();
    expect(response.status()).toBe(201);
    if (drop) {
      drop = false;
      await r.abort();
    } else await r.fulfill({ response });
  });
  await page
    .getByRole('button', { name: 'Lưu khoản chi', exact: true })
    .click();
  await expect(page.getByLabel('Tên khoản chi', { exact: true })).toHaveValue(
    'Ăn trưa cả nhóm',
  );
  await page
    .getByRole('button', { name: 'Thử lại thao tác', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toBeHidden();
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);
  await page.unroute(`**${path}`);
  await expect(page.locator('.expense-total')).toContainText('240.000');
  await expect(page.locator('.expense-remaining')).toContainText('760.000');
  await expect(page.locator('.expense-list li')).toHaveCount(1);
  await page
    .getByRole('button', { name: 'Sửa Ăn trưa cả nhóm', exact: true })
    .click();
  await page
    .getByLabel('Số tiền đã chi (VND)', { exact: true })
    .fill('1200000');
  await page
    .getByRole('button', { name: 'Lưu khoản chi', exact: true })
    .click();
  await expect(page.locator('.expense-remaining')).toContainText(
    'Vượt ngân sách 200.000',
  );
  await page
    .getByRole('button', { name: '+ Thêm khoản chi', exact: true })
    .click();
  await page.getByLabel('Tên khoản chi', { exact: true }).fill('Taxi');
  await page.getByLabel('Số tiền đã chi (VND)', { exact: true }).fill('200000');
  await page
    .getByLabel('Nhóm chi phí', { exact: true })
    .selectOption('transport');
  await page
    .getByRole('button', { name: 'Lưu khoản chi', exact: true })
    .click();
  await expect(page.locator('.expense-total')).toContainText('1.400.000');
  await expect(page.locator('.expense-caption').first()).toContainText(
    '1 điểm dừng chưa có dự toán',
  );
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await mkdir('.local/expense-preview', { recursive: true });
  await page.screenshot({
    path: '.local/expense-preview/actual-live-390.png',
    fullPage: true,
  });
  await page.reload();
  await page.getByRole('button', { name: 'Chi phí', exact: true }).click();
  await page.getByRole('button', { name: 'Thực chi', exact: true }).click();
  await expect(page.locator('.expense-total')).toContainText('1.400.000');
  await page
    .getByRole('button', { name: 'Sửa Ăn trưa cả nhóm', exact: true })
    .click();
  const list = (await (await page.request.get(path)).json()).data;
  const item = list.items.find(
    (v: { description: string }) => v.description === 'Ăn trưa cả nhóm',
  );
  const newer = await page.request.patch(`${path}/${item.id}`, {
    headers: headers(),
    data: {
      expectedRevision: item.revision,
      expense: {
        description: item.description,
        category: item.category,
        amountMinor: 900000,
        currency: 'VND',
        spentOn: item.spentOn,
        timezone: 'Asia/Ho_Chi_Minh',
      },
    },
  });
  expect(newer.status()).toBe(200);
  await page
    .getByLabel('Số tiền đã chi (VND)', { exact: true })
    .fill('1100000');
  await page
    .getByRole('button', { name: 'Lưu khoản chi', exact: true })
    .click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText(
    'đã thay đổi',
  );
  await expect(
    page.getByLabel('Số tiền đã chi (VND)', { exact: true }),
  ).toHaveValue('1100000');
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Đóng', exact: true }).click();
  await expect(page.locator('.expense-total')).toContainText('1.100.000');
  page.once('dialog', (d) => d.dismiss());
  await page.getByRole('button', { name: 'Xóa Taxi', exact: true }).click();
  await expect(page.locator('.expense-list li')).toHaveCount(2);
  for (const title of ['Taxi', 'Ăn trưa cả nhóm']) {
    page.once('dialog', (d) => d.accept());
    await page
      .getByRole('button', { name: `Xóa ${title}`, exact: true })
      .click();
    await expect(
      page.getByText('Đã xóa khoản chi.', { exact: true }),
    ).toBeVisible();
  }
  await expect(page.locator('.expense-total')).toContainText('0');
  await expect(page.locator('.expense-list li')).toHaveCount(0);
  const unchanged: TripDto = (
    await (await page.request.get(`/api/v1/trips/${trip.id}`)).json()
  ).data.trip;
  expect(unchanged.revision).toBe(trip.revision);
  expect(unchanged.days).toEqual(trip.days);
  expect(unchanged.budgetSummary).toEqual(trip.budgetSummary);
  await page.route(`**${path}?**`, (r) => r.abort());
  await page.reload();
  await page.getByRole('button', { name: 'Chi phí', exact: true }).click();
  await page.getByRole('button', { name: 'Thực chi', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Tải lại chi tiêu' }),
  ).toBeVisible();
  await expect(page.locator('.expense-total')).toHaveCount(0);
  await page.unroute(`**${path}?**`);
  await page.getByRole('button', { name: 'Tải lại chi tiêu' }).click();
  await expect(page.locator('.expense-total')).toContainText('0');
});

test('trip management reschedules without data loss duplicates deletes and summarizes', async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/register');
  const email = `management-browser-${Date.now()}@example.invalid`,
    password = 'Expenses-browser-only-2026';
  await page
    .getByLabel('Tên của bạn', { exact: true })
    .fill('Người ghi chi tiêu');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page
    .getByRole('button', { name: 'Tạo tài khoản', exact: false })
    .click();
  await expect(page).toHaveURL(/\/$/);
  const headers = () => ({
    Origin: new URL(page.url()).origin,
    'X-GoEase-Client': 'web',
    'Idempotency-Key': crypto.randomUUID(),
  });
  const destinationId = '000000000000000000000004';
  const input: TripInput = {
    title: 'Hội An và chi tiêu',
    destinations: [{ destinationId, order: 0 }],
    startDate: '2026-11-12',
    endDate: '2026-11-12',
    timezone: 'Asia/Ho_Chi_Minh',
    travelers: { totalCount: 4 },
    budget: {
      amountMinor: 1000000,
      currency: 'VND',
      scope: 'group_total',
      includedCategories: [],
    },
    preferences: { interestCodes: [], pace: 'relaxed', transportModes: [] },
    generationMode: 'manual',
    notes: '',
    days: [
      {
        dayId: crypto.randomUUID(),
        date: '2026-11-12',
        destinationId,
        activities: [100000, null].map((amountMinor, order) => ({
          activityId: crypto.randomUUID(),
          kind: 'visit',
          title: `Điểm ${order + 1}`,
          timezone: 'Asia/Ho_Chi_Minh',
          order,
          notes: '',
          source: 'manual',
          estimatedCost: {
            amountMinor,
            currency: 'VND',
            basis: 'group_total',
            quantity: 1,
            confidence: 'user_entered',
          },
        })),
      },
    ],
  };
  input.endDate = '2026-11-14';
  input.days = [0, 1, 2].map((i) => ({
    ...input.days[0]!,
    dayId: crypto.randomUUID(),
    date: `2026-11-${12 + i}`,
    activities: input.days[0]!.activities.map((a) => ({
      ...a,
      activityId: crypto.randomUUID(),
    })),
  }));
  const created = await page.request.post('/api/v1/trips', {
    headers: headers(),
    data: { trip: input },
  });
  expect(created.status()).toBe(201);
  const trip: TripDto = (await created.json()).data.trip;
  const path = `/api/v1/trips/${trip.id}`;
  expect(
    (
      await page.request.post(path + '/expenses', {
        headers: headers(),
        data: {
          expense: {
            description: 'Giữ khoản chi',
            category: 'meal',
            amountMinor: 240000,
            currency: 'VND',
            spentOn: '2026-11-11',
            timezone: 'Asia/Ho_Chi_Minh',
          },
        },
      })
    ).status(),
  ).toBe(201);
  await page.goto(`/trips/${trip.id}`);
  await page
    .getByRole('button', { name: 'Thông tin chuyến đi', exact: true })
    .click();
  await page.getByRole('button', { name: /Thời gian/ }).click();
  await page.getByLabel('Ngày đi', { exact: true }).fill('2027-02-01');
  await page.getByLabel('Ngày về', { exact: true }).fill('2027-02-02');
  await page.getByRole('button', { name: 'Xong', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText(
    'vẫn có hoạt động',
  );
  await page.getByLabel('Ngày về', { exact: true }).fill('2027-02-03');
  await page.getByRole('button', { name: 'Xong', exact: true }).click();
  await page
    .getByLabel('Tên chuyến đi', { exact: true })
    .fill('Hội An đã dời ngày');
  await expect(
    page.getByRole('button', { name: 'Nhân bản chuyến đi', exact: true }),
  ).toBeDisabled();
  await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Nhân bản chuyến đi', exact: true }),
  ).toBeEnabled();
  const saved: TripDto = (await (await page.request.get(path)).json()).data
    .trip;
  expect(saved.startDate).toBe('2027-02-01');
  expect(saved.endDate).toBe('2027-02-03');
  expect(saved.days.map((d) => d.dayId)).toEqual(trip.days.map((d) => d.dayId));
  expect(saved.days.map((d) => d.activities)).toEqual(
    trip.days.map((d) => d.activities),
  );
  const costs = (await (await page.request.get(path + '/expenses')).json())
    .data;
  expect(costs.actual.amountMinor).toBe(240000);
  expect(costs.items[0].spentOn).toBe('2026-11-11');
  await page
    .getByRole('button', { name: 'Thông tin chuyến đi', exact: true })
    .click();
  await page.getByRole('button', { name: 'Tổng kết', exact: true }).click();
  await expect(page.locator('.expense-total')).toContainText('240.000');
  await expect(page.locator('.expense-remaining')).toContainText('760.000');
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await mkdir('.local/management-preview', { recursive: true });
  await page.screenshot({
    path: '.local/management-preview/summary-390.png',
    fullPage: true,
  });
  await page
    .getByRole('button', { name: 'Thông tin chuyến đi', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Nhân bản chuyến đi', exact: true })
    .click();
  await page
    .getByLabel('Ngày bắt đầu bản sao', { exact: true })
    .fill('2027-05-01');
  let dropped = false;
  const keys: string[] = [];
  await page.route(`**${path}/duplicate`, async (r) => {
    keys.push(r.request().headers()['idempotency-key']!);
    const response = await r.fetch();
    expect(response.status()).toBe(201);
    if (!dropped) {
      dropped = true;
      await r.abort();
    } else await r.fulfill({ response });
  });
  await page.getByRole('button', { name: 'Tạo bản sao', exact: true }).click();
  await page
    .getByRole('button', { name: 'Thử lại thao tác', exact: true })
    .click();
  await expect(page).not.toHaveURL(new RegExp(`${trip.id}$`));
  expect(keys.length).toBe(2);
  expect(keys[0]).toBe(keys[1]);
  await page.unroute(`**${path}/duplicate`);
  const copyId = page.url().split('/').pop()!;
  const copy: TripDto = (
    await (await page.request.get(`/api/v1/trips/${copyId}`)).json()
  ).data.trip;
  expect(copy.startDate).toBe('2027-05-01');
  expect(copy.days[0]!.activities[0]!.activityId).not.toBe(
    trip.days[0]!.activities[0]!.activityId,
  );
  expect(
    (await (await page.request.get(`/api/v1/trips/${copyId}/expenses`)).json())
      .data.totalCount,
  ).toBe(0);
  await page
    .getByRole('button', { name: 'Thông tin chuyến đi', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Xóa chuyến đi', exact: true })
    .click();
  await page.getByRole('button', { name: 'Đóng', exact: true }).click();
  expect((await page.request.get(`/api/v1/trips/${copyId}`)).status()).toBe(
    200,
  );
  await page
    .getByRole('button', { name: 'Xóa chuyến đi', exact: true })
    .click();
  let deleteDropped = false;
  const deleteKeys: string[] = [];
  await page.route(`**/api/v1/trips/${copyId}`, async (r) => {
    if (r.request().method() !== 'DELETE') return r.continue();
    deleteKeys.push(r.request().headers()['idempotency-key']!);
    const response = await r.fetch();
    expect(response.status()).toBe(200);
    if (!deleteDropped) {
      deleteDropped = true;
      await r.abort();
    } else await r.fulfill({ response });
  });
  await page
    .getByRole('button', { name: 'Xác nhận xóa chuyến đi', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Thử lại thao tác', exact: true })
    .click();
  await expect(page).toHaveURL(/\/trips$/);
  expect(deleteKeys[0]).toBe(deleteKeys[1]);
  await page.unroute(`**/api/v1/trips/${copyId}`);
  await expect(
    page.getByRole('heading', { name: 'Hội An đã dời ngày', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: /bản sao/ })).toHaveCount(0);
  expect(
    (await page.request.get(`/api/v1/trips/${copyId}/expenses`)).status(),
  ).toBe(404);
  await page.getByRole('button', { name: 'Đã kết thúc', exact: true }).click();
  await expect(
    page.getByText('Chưa có chuyến đi trong mục này.', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Sắp đi', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Hội An đã dời ngày', exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: '.local/management-preview/list-390.png',
    fullPage: true,
  });
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Hội An đã dời ngày', exact: true }),
  ).toBeVisible();
  // Restore the original trip with real expenses; retry a committed response lost in transit.
  expect(
    (
      await page.request.delete(path, {
        headers: headers(),
        data: { expectedRevision: saved.revision },
      })
    ).status(),
  ).toBe(200);
  await page.getByRole('button', { name: 'Thùng rác', exact: true }).click();
  await expect(page).toHaveURL(/\/trips\/trash$/);
  const originalCard = page.locator('.trip-trash-card').filter({
    has: page.getByRole('heading', {
      name: 'Hội An đã dời ngày',
      exact: true,
    }),
  });
  await expect(originalCard).toBeVisible();
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
    path: '.local/management-preview/trash-390.png',
    fullPage: true,
  });
  let restoreDropped = false;
  const restoreKeys: string[] = [];
  await page.route('**' + path + '/restore', async (route) => {
    restoreKeys.push(route.request().headers()['idempotency-key']!);
    const response = await route.fetch();
    expect(response.status()).toBe(200);
    if (!restoreDropped) {
      restoreDropped = true;
      await route.abort();
    } else await route.fulfill({ response });
  });
  await originalCard
    .getByRole('button', { name: 'Khôi phục chuyến đi', exact: true })
    .click();
  await originalCard
    .getByRole('button', { name: 'Thử lại khôi phục', exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp('/trips/' + trip.id + '$'));
  expect(restoreKeys[0]).toBe(restoreKeys[1]);
  await page.unroute('**' + path + '/restore');
  await page.reload();
  const restored: TripDto = (await (await page.request.get(path)).json()).data
    .trip;
  expect(restored.days).toEqual(saved.days);
  expect(
    (await (await page.request.get(path + '/expenses')).json()).data.items,
  ).toEqual(costs.items);
  await page.goto('/trips/trash');
  await expect(
    page.getByRole('heading', { name: 'Hội An đã dời ngày', exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Khôi phục chuyến đi', exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp('/trips/' + copyId + '$'));
  await page.goto('/trips/trash');
  await expect(
    page.getByRole('heading', { name: 'Thùng rác đang trống' }),
  ).toBeVisible();
});

test('customer profile and password persist and revoke other browser sessions', async ({
  page,
  browser,
}) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 390, height: 844 });
  const email = `profile-${Date.now()}@example.invalid`,
    password = 'Profile-browser-old-2026',
    next = 'Profile-browser-new-2026';
  await page.goto('/register');
  await page.getByLabel('Tên của bạn', { exact: true }).fill('Khách ban đầu');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page
    .getByRole('button', { name: 'Tạo tài khoản', exact: false })
    .click();
  await expect(page).toHaveURL(/\/$/);
  const origin = new URL(page.url()).origin;
  const headers = { Origin: origin, 'X-GoEase-Client': 'web' };
  const second = await browser.newContext({ baseURL: origin });
  try {
    expect(
      (
        await second.request.post('/api/v1/auth/login', {
          headers,
          data: { email, password },
        })
      ).status(),
    ).toBe(200);
    await page
      .getByRole('button', { name: 'Hồ sơ cá nhân', exact: true })
      .click();
    await expect(page).toHaveURL(/\/account$/);
    await page
      .getByLabel('Tên hiển thị', { exact: true })
      .fill('Người du lịch mới');
    await page.route('https://example.com/avatar.png', (r) =>
      r.fulfill({
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="green"/></svg>',
        contentType: 'image/svg+xml',
      }),
    );
    // Upload provider is mocked here; profile PATCH/reload still use the real API/DB.
    await page.route('**/api/v1/me/avatar', (r) =>
      r.fulfill({
        json: {
          ok: true,
          data: { avatarUrl: 'https://example.com/avatar.png' },
        },
      }),
    );
    const avatarPng = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 200;
      canvas.height = 200;
      canvas.getContext('2d')!.fillRect(0, 0, 200, 200);
      return canvas.toDataURL('image/png').split(',')[1]!;
    });
    await page.getByLabel('Chọn ảnh đại diện từ máy').setInputFiles({
      name: 'avatar-fixture.png',
      mimeType: 'image/png',
      buffer: Buffer.from(avatarPng, 'base64'),
    });
    await page
      .getByRole('button', { name: 'Dùng ảnh này', exact: true })
      .click();
    let drop = true;
    await page.route('**/api/v1/me/profile', async (r) => {
      if (r.request().method() !== 'PATCH') return r.continue();
      const response = await r.fetch();
      expect(response.status()).toBe(200);
      if (drop) {
        drop = false;
        await r.abort();
      } else await r.fulfill({ response });
    });
    await page.getByRole('button', { name: 'Lưu hồ sơ', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Không kết nối');
    await expect(page.getByLabel('Tên hiển thị', { exact: true })).toHaveValue(
      'Người du lịch mới',
    );
    await page.getByRole('button', { name: 'Lưu hồ sơ', exact: true }).click();
    await expect(
      page.getByText('Đã lưu hồ sơ.', { exact: true }),
    ).toBeVisible();
    await page.unroute('**/api/v1/me/profile');
    await expect(page.locator('.account-profile-head img')).toHaveAttribute(
      'src',
      'https://example.com/avatar.png',
    );
    await page.reload();
    await expect(page.getByLabel('Tên hiển thị', { exact: true })).toHaveValue(
      'Người du lịch mới',
    );
    // A concurrent profile edit must not overwrite the retained local input.
    const profile = (
      await (await second.request.get('/api/v1/me/profile')).json()
    ).data;
    expect(
      (
        await second.request.patch('/api/v1/me/profile', {
          headers,
          data: {
            displayName: 'Tên từ phiên khác',
            avatarUrl: null,
            expectedRevision: profile.revision,
          },
        })
      ).status(),
    ).toBe(200);
    await page.getByLabel('Tên hiển thị', { exact: true }).fill('Bản chưa lưu');
    await page.getByRole('button', { name: 'Lưu hồ sơ', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('đã thay đổi');
    await expect(page.getByLabel('Tên hiển thị', { exact: true })).toHaveValue(
      'Bản chưa lưu',
    );
    page.once('dialog', (d) => d.accept());
    await page
      .getByRole('button', { name: 'Tải lại hồ sơ', exact: true })
      .click();
    await expect(page.getByLabel('Tên hiển thị', { exact: true })).toHaveValue(
      'Tên từ phiên khác',
    );
    await expect(page.locator('.account-profile-head img')).toHaveAttribute(
      'src',
      images.defaultAvatar,
    );
    await page
      .getByLabel('Mật khẩu hiện tại', { exact: true })
      .fill('Wrong-browser-old-2026');
    await page.getByLabel('Mật khẩu mới', { exact: true }).fill(next);
    await page.getByLabel('Xác nhận mật khẩu mới', { exact: true }).fill(next);
    await page
      .getByRole('button', { name: 'Đổi mật khẩu', exact: true })
      .click();
    await expect(
      page.getByText('Mật khẩu hiện tại chưa đúng.', { exact: true }),
    ).toBeVisible();
    await page.getByLabel('Mật khẩu hiện tại', { exact: true }).fill(password);
    let passwordDrop = true;
    const keys: string[] = [];
    await page.route('**/api/v1/me/password', async (r) => {
      keys.push(r.request().headers()['idempotency-key']!);
      const response = await r.fetch();
      expect(response.status()).toBe(200);
      if (passwordDrop) {
        passwordDrop = false;
        await r.abort();
      } else await r.fulfill({ response });
    });
    await page
      .getByRole('button', { name: 'Đổi mật khẩu', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'Thử lại đổi mật khẩu', exact: true })
      .click();
    await expect(
      page.getByText(
        'Đã đổi mật khẩu và đăng xuất các phiên khác. Phiên hiện tại vẫn được giữ.',
        { exact: true },
      ),
    ).toBeVisible();
    expect(keys.length).toBe(2);
    expect(keys[0]).toBe(keys[1]);
    await expect(
      page.getByLabel('Mật khẩu hiện tại', { exact: true }),
    ).toHaveValue('');
    await expect(page.getByLabel('Mật khẩu mới', { exact: true })).toHaveValue(
      '',
    );
    expect((await second.request.get('/api/v1/me/profile')).status()).toBe(401);
    expect(
      (
        await second.request.post('/api/v1/auth/login', {
          headers,
          data: { email, password },
        })
      ).status(),
    ).toBe(401);
    expect(
      (
        await second.request.post('/api/v1/auth/login', {
          headers,
          data: { email, password: next },
        })
      ).status(),
    ).toBe(200);
    for (const width of [320, 390, 768]) {
      await page.setViewportSize({ width, height: 844 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await mkdir('.local/account-preview', { recursive: true });
    await page.screenshot({
      path: '.local/account-preview/profile-390.png',
      fullPage: true,
    });
    await page.reload();
    await expect(page.getByLabel('Tên hiển thị', { exact: true })).toHaveValue(
      'Tên từ phiên khác',
    );
  } finally {
    await second.close();
  }
});

test('live Gemini proposal applies saves reloads and preserves AI provenance', async ({
  page,
  browser,
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
  await page.getByRole('button', { name: '3 ngày', exact: true }).click();
  const generated = page.waitForResponse('**/api/v1/trips/ai-proposal', {
    timeout: 65000,
  });
  await page
    .getByRole('button', { name: 'Lên lịch giúp mình', exact: true })
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
    page.getByText('LỊCH GỢI Ý CỦA GOE', { exact: true }),
  ).toBeVisible();
  await mkdir('.local/ai-preview', { recursive: true });
  await page.screenshot({
    path: '.local/ai-preview/live-proposal.png',
    fullPage: true,
  });
  await expect(page.locator('.journey-stop-open')).toHaveCount(
    result.data.trip.days[0].activities.length,
  );
  await page.getByRole('button', { name: 'Giữ lịch này', exact: true }).click();
  await page.getByLabel('Ngày khởi hành', { exact: true }).fill('2026-11-12');
  await page.getByText('Đổi tên hoặc thêm ghi chú', { exact: false }).click();
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
  expect(stored.days.map((d) => d.activities)).toEqual(
    result.data.trip.days.map((d: TripInput['days'][number]) => d.activities),
  );
  expect(stored.startDate).toBe('2026-11-12');
  expect(stored.endDate).toBe('2026-11-14');
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
  const origin = new URL(page.url()).origin;
  const headers = () => ({
    Origin: origin,
    'X-GoEase-Client': 'web',
    'Idempotency-Key': crypto.randomUUID(),
  });
  const forged = inputFromTrip(stored);
  forged.days = structuredClone(forged.days);
  forged.days[0]!.activities[0]!.activityId = crypto.randomUUID();
  expect(
    (
      await page.request.patch(endpoint, {
        headers: headers(),
        data: { trip: forged, expectedRevision: stored.revision },
      })
    ).status(),
  ).toBe(400);
  const edited = {
    ...inputFromTrip(stored),
    title: 'Hội An – Gemini đã chỉnh sửa',
  };
  expect(
    (
      await page.request.patch(endpoint, {
        headers: headers(),
        data: { trip: edited, expectedRevision: stored.revision },
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await page.request.patch(endpoint, {
        headers: headers(),
        data: { trip: edited, expectedRevision: stored.revision },
      })
    ).status(),
  ).toBe(409);
  const other = await browser.newContext();
  try {
    expect(
      (
        await other.request.post(origin + '/api/v1/auth/register', {
          headers: headers(),
          data: {
            displayName: 'Other test traveler',
            email: `other-ai-${Date.now()}@example.invalid`,
            password: 'Other-AI-test-password-2026',
          },
        })
      ).status(),
    ).toBe(201);
    expect((await other.request.get(origin + endpoint)).status()).toBe(404);
    expect(
      (
        await other.request.post(origin + '/api/v1/trips', {
          headers: headers(),
          data: { trip: inputFromTrip(stored) },
        })
      ).status(),
    ).toBe(409);
  } finally {
    await other.close();
  }
  await page.reload();
  await page
    .getByRole('button', { name: 'Thông tin chuyến đi', exact: true })
    .click();
  await page.route('**/api/v1/trips/ai-proposal', (r) =>
    r.fulfill({
      status: 429,
      json: {
        ok: false,
        error: { code: 'AI_QUOTA', message: 'Đã hết lượt Goe AI hôm nay.' },
      },
    }),
  );
  await page
    .getByRole('button', { name: 'Để Goe xếp lịch', exact: true })
    .click();
  await expect(page.locator('.ai-planner').getByRole('alert')).toContainText(
    'Đã hết lượt',
  );
  await expect(
    page.getByText('Đề xuất của Goe · Chưa áp dụng', { exact: true }),
  ).toHaveCount(0);
  const unchanged = (await (await page.request.get(endpoint)).json()).data
    .trip as TripDto;
  expect(unchanged.days).toEqual(stored.days);
  expect(unchanged.revision).toBe(stored.revision + 1);
  // Real Goe adjustment reuses Gemini but only changes the selected day.
  await page.goto(`/goe?trip=${stored.id}&day=0`);
  await expect(
    page.getByLabel('Hỏi Goe về chuyến đi', { exact: true }),
  ).toBeEnabled();
  const chatResponse = page.waitForResponse('**/goe-proposal', {
    timeout: 65000,
  });
  await page.getByRole('button', { name: 'Đi chậm hơn', exact: true }).click();
  const chat = await chatResponse;
  const chatBody = await chat.json();
  expect(chat.status(), JSON.stringify(chatBody.error ?? {})).toBe(200);
  expect(chatBody.data.trip.days.slice(1)).toEqual(unchanged.days.slice(1));
  expect(
    (await (await page.request.get(endpoint)).json()).data.trip.revision,
  ).toBe(unchanged.revision);
  await page.getByRole('button', { name: 'Xem thay đổi', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Trước');
  await expect(page.getByRole('dialog')).toContainText('Sau');
  await page.screenshot({
    path: '.local/ai-preview/goe-real-proposal.png',
    fullPage: true,
  });
  // Simulate a lost response after the transaction committed, then retry same key.
  await page.route('**/goe-apply', async (route) => {
    await route.fetch();
    await route.abort();
  });
  await page
    .getByRole('button', { name: 'Xác nhận và lưu thay đổi', exact: true })
    .click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText(
    'Không kết nối',
  );
  await page.unroute('**/goe-apply');
  await page
    .getByRole('button', { name: 'Xác nhận và lưu thay đổi', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('log')).toContainText('Đã lưu thay đổi');
  const adjusted = (await (await page.request.get(endpoint)).json()).data
    .trip as TripDto;
  expect(adjusted.revision).toBe(unchanged.revision + 1);
  expect(adjusted.days).toEqual(chatBody.data.trip.days);
  expect(adjusted.aiRunId).toBe(chatBody.data.runId);
  expect(
    (
      await page.request.post(endpoint + '/goe-apply', {
        headers: headers(),
        data: {
          runId: chatBody.data.runId,
          expectedRevision: chatBody.data.baseRevision,
        },
      })
    ).status(),
  ).toBe(409);
  await page.getByRole('button', { name: 'Quay lại', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('status', { name: 'Trạng thái lưu' })).toHaveText(
    'Đã lưu',
  );
  expect(
    (await (await page.request.get(endpoint)).json()).data.trip.days,
  ).toEqual(adjusted.days);
  await page.screenshot({
    path: '.local/ai-preview/goe-saved-reloaded.png',
    fullPage: true,
  });
});

test('share link creation retry guest view map and revocation', async ({
  page,
  browser,
}) => {
  test.setTimeout(90000);
  await page.goto('/register');
  await page.getByLabel('Tên của bạn', { exact: true }).fill('Share traveler');
  await page
    .getByLabel('Email', { exact: true })
    .fill(`share-${Date.now()}@example.invalid`);
  await page
    .getByLabel('Mật khẩu', { exact: true })
    .fill('Share-browser-only-2026');
  await page
    .getByRole('button', { name: 'Tạo tài khoản', exact: false })
    .click();
  await expect(page).toHaveURL(/\/$/);
  const origin = new URL(page.url()).origin;
  const headers = {
    Origin: origin,
    'X-GoEase-Client': 'web',
    'Idempotency-Key': crypto.randomUUID(),
  };
  const destinationId = '000000000000000000000004';
  const input: TripInput = {
    title: 'Hội An chia sẻ',
    destinations: [{ destinationId, order: 0 }],
    startDate: '2026-11-12',
    endDate: '2026-11-12',
    timezone: 'Asia/Ho_Chi_Minh',
    travelers: { totalCount: 4 },
    budget: {
      amountMinor: 1000000,
      currency: 'VND',
      scope: 'group_total',
      includedCategories: [],
    },
    preferences: { interestCodes: [], pace: 'relaxed', transportModes: [] },
    generationMode: 'manual',
    notes: 'PRIVATE_NOTE_SENTINEL',
    days: [
      {
        dayId: crypto.randomUUID(),
        date: '2026-11-12',
        destinationId,
        activities: [100000, null].map((amountMinor, order) => ({
          activityId: crypto.randomUUID(),
          kind: 'visit',
          title: `Điểm ${order + 1}`,
          timezone: 'Asia/Ho_Chi_Minh',
          order,
          notes: 'PRIVATE_NOTE_SENTINEL',
          source: 'manual',
          estimatedCost: {
            amountMinor,
            currency: 'VND',
            basis: 'group_total',
            quantity: 1,
            confidence: 'user_entered',
          },
        })),
      },
    ],
  };

  const created = await page.request.post('/api/v1/trips', {
    headers,
    data: { trip: input },
  });
  expect(created.status()).toBe(201);
  const trip = (await created.json()).data.trip as TripDto;
  await page.goto(`/trips/${trip.id}`);
  await page
    .getByRole('button', { name: 'Thông tin chuyến đi', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Chia sẻ lịch trình', exact: true })
    .click();
  await page.route(`**/api/v1/trips/${trip.id}/shares`, async (route) => {
    if (route.request().method() === 'POST') {
      await route.fetch();
      await route.abort();
    } else await route.continue();
  });
  await page
    .getByRole('button', { name: 'Tạo link chỉ xem', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Thử lại tạo link', exact: true }),
  ).toBeVisible();
  await page.unroute(`**/api/v1/trips/${trip.id}/shares`);
  await page
    .getByRole('button', { name: 'Thử lại tạo link', exact: true })
    .click();
  const link = page.getByRole('textbox', {
    name: 'Link chia sẻ',
    exact: false,
  });
  await expect(link).toHaveValue(/\/share#[a-f0-9]{64}$/);
  const url = await link.inputValue();
  expect(
    (await (await page.request.get(`/api/v1/trips/${trip.id}/shares`)).json())
      .data.items,
  ).toHaveLength(1);
  const guest = await browser.newContext({ baseURL: origin });
  try {
    const view = await guest.newPage();
    await view.goto(url);
    await expect(
      view.getByRole('heading', { name: 'Hội An chia sẻ', exact: true }),
    ).toBeVisible();
    await expect(view.getByText('PRIVATE_NOTE_SENTINEL')).toHaveCount(0);
    await expect(
      view.getByRole('button', { name: 'Lưu chuyến đi', exact: true }),
    ).toHaveCount(0);
    await view.getByRole('button', { name: 'Bản đồ', exact: true }).click();
    await expect(
      view.getByRole('region', { name: 'Bản đồ lịch trình' }),
    ).toBeVisible();
    await expect(
      view.getByRole('button', { name: 'Xem / chỉnh điểm dừng' }),
    ).toHaveCount(0);
    await view.getByRole('button', { name: 'Lịch trình', exact: true }).click();
    await mkdir('.local/share-preview', { recursive: true });
    for (const width of [320, 390, 768]) {
      await view.setViewportSize({ width, height: 844 });
      expect(
        await view.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await view.screenshot({
        path: `.local/share-preview/shared-${width}.png`,
        fullPage: true,
      });
    }
    page.once('dialog', (dialog) => dialog.accept());
    await page
      .getByRole('button', { name: 'Thu hồi link 1', exact: true })
      .click();
    await expect(
      page.getByText('Đã thu hồi link.', { exact: true }),
    ).toBeVisible();
    await view.reload();
    await expect(
      view.getByRole('heading', { name: 'Chưa mở được lịch trình' }),
    ).toBeVisible();
    await expect(
      view.getByRole('heading', { name: 'Hội An chia sẻ', exact: true }),
    ).toHaveCount(0);
  } finally {
    await guest.close();
  }
});

test('password recovery UI with explicit delivered-token database fixture and unavailable SMTP', async ({
  page,
  browser,
}) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/register');
  const email = `recovery-browser-${Date.now()}@example.invalid`,
    password = 'Recovery-browser-old-2026',
    next = 'Recovery-browser-new-2026';
  await page
    .getByLabel('Tên của bạn', { exact: true })
    .fill('Recovery traveler');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page
    .getByRole('button', { name: 'Tạo tài khoản', exact: false })
    .click();
  await expect(page).toHaveURL(/\/$/);
  const origin = new URL(page.url()).origin;
  const guest = await browser.newContext({ baseURL: origin });
  const recover = await guest.newPage();
  try {
    await recover.goto('/login');
    await recover
      .getByRole('link', { name: 'Quên mật khẩu?', exact: true })
      .click();
    await recover.getByLabel('Email đăng ký', { exact: true }).fill(email);
    await recover
      .getByRole('button', { name: 'Gửi yêu cầu đặt lại', exact: true })
      .click();
    await expect(recover.getByRole('alert')).toContainText(
      'Gửi email chưa được cấu hình',
    );
    await expect(
      recover.getByLabel('Email đăng ký', { exact: true }),
    ).toHaveValue(email);
    // This fixture tests reset persistence/consume/UI only, not actual email delivery.
    const seedDeliveredToken = async () => {
      const token = randomBytes(32).toString('base64url');
      const connection = await mongoose
        .createConnection(
          'mongodb://127.0.0.1:27020/goease_f0_test?replicaSet=goease_e2e',
        )
        .asPromise();
      try {
        const user = (await connection
          .collection('users')
          .findOne({ emailNormalized: email }))!;
        const identity = (await connection
          .collection('auth_identities')
          .findOne({ userId: user._id, provider: 'password' }))!;
        await connection.collection('auth_challenges').insertOne({
          schemaVersion: 1,
          userId: user._id,
          purpose: 'reset_password',
          tokenHash: createHash('sha256').update(token).digest('hex'),
          context: {
            identityId: identity._id,
            securityVersionAtIssue: user.securityVersion,
            deliveryState: 'sent',
          },
          expiresAt: new Date(Date.now() + 900000),
          consumedAt: null,
          revokedAt: null,
          attemptCount: 0,
          maxAttempts: 1,
          requestId: crypto.randomUUID(),
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      } finally {
        await connection.close();
      }
      return token;
    };
    const token = await seedDeliveredToken();
    await recover.goto(`/reset-password#${token}`);
    await recover.getByLabel('Mật khẩu mới', { exact: true }).fill(next);
    await recover
      .getByLabel('Xác nhận mật khẩu mới', { exact: true })
      .fill('Wrong-confirmation-2026');
    await recover
      .getByRole('button', { name: 'Lưu mật khẩu mới', exact: true })
      .click();
    await expect(recover.getByRole('alert')).toContainText('trùng khớp');
    await recover
      .getByLabel('Xác nhận mật khẩu mới', { exact: true })
      .fill(next);
    await mkdir('.local/recovery-preview', { recursive: true });
    for (const width of [320, 390, 768]) {
      await recover.setViewportSize({ width, height: 844 });
      expect(
        await recover.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await recover.screenshot({
        path: `.local/recovery-preview/reset-${width}.png`,
        fullPage: true,
      });
    }
    // Simulate the reset committing, then losing its HTTP response. A retry must not reset twice.
    await recover.route('**/api/v1/auth/reset-password', async (route) => {
      await route.fetch();
      await route.abort();
    });
    await recover
      .getByRole('button', { name: 'Lưu mật khẩu mới', exact: true })
      .click();
    await expect(recover.getByRole('alert')).toContainText('Không kết nối');
    await recover.unroute('**/api/v1/auth/reset-password');
    await recover
      .getByRole('button', { name: 'Lưu mật khẩu mới', exact: true })
      .click();
    await expect(recover.getByRole('alert')).toContainText(
      'đã dùng hoặc đã hết hạn',
    );
    expect((await page.request.get('/api/v1/me/profile')).status()).toBe(401);
    const headers = { Origin: origin, 'X-GoEase-Client': 'web' };
    expect(
      (
        await guest.request.post('/api/v1/auth/login', {
          headers,
          data: { email, password },
        })
      ).status(),
    ).toBe(401);
    await recover
      .getByRole('link', { name: 'Về đăng nhập', exact: true })
      .click();
    await recover.getByLabel('Email', { exact: true }).fill(email);
    await recover.getByLabel('Mật khẩu', { exact: true }).fill(next);
    await recover
      .getByRole('button', { name: 'Đăng nhập', exact: false })
      .click();
    await expect(recover).toHaveURL(/\/$/);
    const finalToken = await seedDeliveredToken();
    await recover.goto(`/reset-password#${finalToken}`);
    await recover
      .getByLabel('Mật khẩu mới', { exact: true })
      .fill('Recovery-browser-final-2026');
    await recover
      .getByLabel('Xác nhận mật khẩu mới', { exact: true })
      .fill('Recovery-browser-final-2026');
    await recover
      .getByRole('button', { name: 'Lưu mật khẩu mới', exact: true })
      .click();
    await expect(recover.getByRole('status')).toContainText(
      'Đã đặt lại mật khẩu',
    );
    await expect(recover).toHaveURL(/\/reset-password$/);
    await expect(
      recover.getByLabel('Mật khẩu mới', { exact: true }),
    ).toHaveCount(0);
    await recover.goto('/reset-password');
    await expect(recover.getByRole('alert')).toContainText('Link không hợp lệ');
  } finally {
    await guest.close();
  }
});

test('offline itinerary survives network loss reload and clears across tabs on logout', async ({
  page,
  context,
}) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/register');
  await page.getByLabel('Tên của bạn', { exact: true }).fill('Khách offline');
  await page
    .getByLabel('Email', { exact: true })
    .fill('offline-' + Date.now() + '@example.invalid');
  await page
    .getByLabel('Mật khẩu', { exact: true })
    .fill('Offline-browser-only-2026');
  await page
    .getByRole('button', { name: 'Tạo tài khoản', exact: false })
    .click();
  await expect(page).toHaveURL(/\/$/);
  const headers = () => ({
    Origin: new URL(page.url()).origin,
    'X-GoEase-Client': 'web',
    'Idempotency-Key': crypto.randomUUID(),
  });
  const destinationId = '000000000000000000000004';
  const input: TripInput = {
    title: 'Hội An offline',
    destinations: [{ destinationId, order: 0 }],
    startDate: '2026-11-12',
    endDate: '2026-11-12',
    timezone: 'Asia/Ho_Chi_Minh',
    travelers: { totalCount: 4 },
    budget: {
      amountMinor: 1000000,
      currency: 'VND',
      scope: 'group_total',
      includedCategories: [],
    },
    preferences: { interestCodes: [], pace: 'relaxed', transportModes: [] },
    generationMode: 'manual',
    notes: 'Ghi chú riêng offline',
    days: [
      {
        dayId: crypto.randomUUID(),
        date: '2026-11-12',
        destinationId,
        activities: [
          {
            activityId: crypto.randomUUID(),
            kind: 'visit',
            title: 'Phố cổ Hội An',
            order: 0,
            timezone: 'Asia/Ho_Chi_Minh',
            notes: '<img src=x onerror=alert(1)> Ghi chú điểm dừng',
            source: 'manual',
            startLocalTime: '09:00',
            endLocalTime: '10:00',
            estimatedCost: {
              amountMinor: 120000,
              currency: 'VND',
              basis: 'per_person',
              quantity: 1,
              confidence: 'user_entered',
            },
          },
        ],
      },
    ],
  };
  const created = await page.request.post('/api/v1/trips', {
    headers: headers(),
    data: { trip: input },
  });
  expect(created.status()).toBe(201);
  const trip: TripDto = (await created.json()).data.trip;
  const apiPath = '/api/v1/trips/' + trip.id;
  await page.goto('/trips/' + trip.id);
  await page
    .getByRole('button', { name: 'Thông tin chuyến đi', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Lưu để xem offline', exact: true })
    .click();
  await expect(page.getByText(/Đã tải:/)).toBeVisible();
  const original = await page.evaluate(() =>
    localStorage.getItem('goease:offline:data:v1'),
  );
  expect(JSON.parse(original!).items[0].trip.days).toEqual(trip.days);
  // Failed refresh keeps the previous snapshot and timestamp intact.
  await page.route('**' + apiPath, (route) =>
    route.fulfill({
      status: 503,
      json: { ok: false, error: { message: 'Offline refresh test failure' } },
    }),
  );
  await page
    .getByRole('button', { name: 'Cập nhật bản offline', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText(
    'Offline refresh test failure',
  );
  expect(
    await page.evaluate(() => localStorage.getItem('goease:offline:data:v1')),
  ).toBe(original);
  await page.unroute('**' + apiPath);
  const changed = await page.request.patch(apiPath, {
    headers: headers(),
    data: {
      trip: { ...input, title: 'Hội An bản mới' },
      expectedRevision: trip.revision,
    },
  });
  expect(changed.status()).toBe(200);
  await page
    .getByRole('button', { name: 'Cập nhật bản offline', exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem('goease:offline:data:v1')!).items[0]
            .trip.title,
      ),
    )
    .toBe('Hội An bản mới');
  const cacheUrls = await page.evaluate(async () => {
    const keys = await caches.keys();
    return (
      await Promise.all(
        keys.map(async (key) =>
          (await (await caches.open(key)).keys()).map(
            (r) => new URL(r.url).pathname,
          ),
        ),
      )
    ).flat();
  });
  expect(cacheUrls.sort()).toEqual([
    '/offline.css',
    '/offline.html',
    '/offline.js',
  ]);
  // A deletion on another device/API call is removed when the reader reconnects.
  const doomedResult = await page.request.post('/api/v1/trips', {
    headers: headers(),
    data: { trip: { ...input, title: 'Chuyến đã xóa từ máy khác' } },
  });
  const doomed: TripDto = (await doomedResult.json()).data.trip;
  await page.goto('/trips/' + doomed.id);
  await page
    .getByRole('button', { name: 'Thông tin chuyến đi', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Lưu để xem offline', exact: true })
    .click();
  await expect(page.getByText(/Đã tải:/)).toBeVisible();
  expect(
    (
      await page.request.delete('/api/v1/trips/' + doomed.id, {
        headers: headers(),
        data: { expectedRevision: doomed.revision },
      })
    ).status(),
  ).toBe(200);
  await page.goto('/offline.html');
  await expect(
    page.getByRole('heading', { name: 'Hội An bản mới' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Chuyến đã xóa từ máy khác' }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('goease:offline:data:v1')!).items
          .length,
    ),
  ).toBe(1);
  await context.setOffline(true);
  await page.goto('/trips/' + trip.id);
  await expect(
    page.getByRole('heading', { name: 'Lịch trình bên bạn.' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Xem lịch trình', exact: true })
    .click();
  await expect(
    page.getByText('Ghi chú riêng offline', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('09:00 – 10:00', { exact: true })).toBeVisible();
  await expect(page.getByText(/Dự toán đã biết: 480.000đ/)).toBeVisible();
  expect(await page.locator('#content img').count()).toBe(0);
  expect(await page.locator('input, textarea').count()).toBe(0);
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await mkdir('.local/offline-preview', { recursive: true });
  await page.screenshot({
    path: '.local/offline-preview/itinerary-390.png',
    fullPage: true,
  });
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Hội An bản mới' }),
  ).toBeVisible();
  const second = await context.newPage();
  await second.goto('/offline.html');
  await expect(
    second.getByRole('heading', { name: 'Hội An bản mới' }),
  ).toBeVisible();
  await second.getByRole('button', { name: 'Đăng xuất & xóa dữ liệu' }).click();
  await expect(
    second.getByRole('heading', { name: 'Chưa có lịch trình tải xuống' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Chưa có lịch trình tải xuống' }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem('goease:offline:data:v1')),
  ).toBeNull();
  expect(
    await page.evaluate(() => localStorage.getItem('goease:offline:owner:v1')),
  ).toBeNull();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Chưa có lịch trình tải xuống' }),
  ).toBeVisible();
  await context.setOffline(false);
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem('goease:offline:logout:v1')),
    )
    .toBeNull();
  expect(
    (await (await page.request.get('/api/v1/auth/me')).json()).data.user,
  ).toBeNull();
  await second.close();
  await page.goto('/register');
  await page.getByLabel('Tên của bạn', { exact: true }).fill('Khách khác');
  await page
    .getByLabel('Email', { exact: true })
    .fill('offline-other-' + Date.now() + '@example.invalid');
  await page
    .getByLabel('Mật khẩu', { exact: true })
    .fill('Offline-browser-only-2026');
  await page
    .getByRole('button', { name: 'Tạo tài khoản', exact: false })
    .click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto('/offline.html');
  await expect(
    page.getByRole('heading', { name: 'Chưa có lịch trình tải xuống' }),
  ).toBeVisible();
  // The normal online logout and per-trip removal use the same deletion policy.
  const other = await page.request.post('/api/v1/trips', {
    headers: headers(),
    data: { trip: { ...input, title: 'Chuyến tài khoản mới' } },
  });
  expect(other.status()).toBe(201);
  const otherId = (await other.json()).data.trip.id;
  await page.goto('/trips/' + otherId);
  await page
    .getByRole('button', { name: 'Thông tin chuyến đi', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Lưu để xem offline', exact: true })
    .click();
  await expect(page.getByText(/Đã tải:/)).toBeVisible();
  await page
    .getByRole('button', { name: 'Xóa bản tải xuống', exact: true })
    .click();
  await expect(page.getByText(/Đã tải:/)).toHaveCount(0);
  expect((await page.request.get('/api/v1/trips/' + otherId)).status()).toBe(
    200,
  );
  await page
    .getByRole('button', { name: 'Lưu để xem offline', exact: true })
    .click();
  await expect(page.getByText(/Đã tải:/)).toBeVisible();
  await page.goto('/');
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem('goease:offline:data:v1')),
    )
    .toBeNull();
  await expect
    .poll(
      async () =>
        (await (await page.request.get('/api/v1/auth/me')).json()).data.user,
    )
    .toBeNull();
  await page.goto('/offline.html');
  await expect(
    page.getByRole('heading', { name: 'Chưa có lịch trình tải xuống' }),
  ).toBeVisible();
});

test('mobile newcomer resumes setup, sees unknown costs and recovers from failed Goe without losing the trip', async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Bắt đầu hành trình' }).click();
  await expect(
    page.getByRole('button', { name: 'Sa Pa · Chưa hỗ trợ lập lịch' }),
  ).toBeDisabled();
  await page
    .getByRole('button', { name: 'Lên kế hoạch đến Hội An', exact: true })
    .click();
  await expect(page).toHaveURL(/login\?next=\/trips\/new&destination=/);
  await expect(page.locator('.auth-card-sub')).toContainText(
    'tiếp tục tạo chuyến ngay',
  );
  await page.getByRole('link', { name: 'Tạo tài khoản', exact: true }).click();
  await page
    .getByLabel('Tên của bạn', { exact: true })
    .fill('Mobile newcomer fixture');
  await page
    .getByLabel('Email', { exact: true })
    .fill(`mobile-ux-${Date.now()}@example.invalid`);
  await page
    .getByLabel('Mật khẩu', { exact: true })
    .fill('Mobile-UX-fixture-2026');
  await page
    .getByRole('button', { name: 'Tạo tài khoản', exact: false })
    .click();
  await expect(page).toHaveURL(/\/trips\/new$/);
  await expect(
    page.getByRole('button', {
      name: 'Hội An Goe kiểm tra dữ liệu khi lập lịch',
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByText('Sở thích, nhịp đi & ngân sách', { exact: false })
    .click();
  await page
    .getByLabel('Ngân sách cả nhóm (VND)', { exact: true })
    .fill('6000000');
  // Explicit fault injection: failed output must not offer same-run recovery or mutate the draft.
  await page.route('**/api/v1/trips/ai-proposal', (r) =>
    r.fulfill({
      status: 502,
      json: {
        ok: false,
        error: {
          code: 'AI_PACE_LIMIT',
          message: 'Goe chưa xếp được trong nhịp độ đã chọn. Thử đổi một điểm.',
        },
      },
    }),
  );
  await page
    .getByRole('button', { name: 'Lên lịch giúp mình', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText('Thử đổi một điểm');
  await expect(
    page.getByRole('button', { name: 'Kiểm tra kết quả đang chờ' }),
  ).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Tự chọn điểm dừng', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Thêm Cơm gà Hội An', exact: true })
    .click();
  await page.getByRole('button', { name: 'Chi phí', exact: true }).click();
  await expect(page.locator('.budget-incomplete')).toContainText(
    'Chưa đủ dữ liệu',
  );
  await expect(page.locator('.budget-total')).toHaveText('Chưa có dự toán');
  await expect(page.locator('.budget-reserve')).not.toContainText('Còn');
  await expect(page.locator('.budget-breakdown')).toContainText('Chưa thêm');
  await expect(page.getByRole('meter')).toHaveCount(0);
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page
    .getByRole('button', { name: 'Bổ sung chi phí trong lịch', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toContainText(
    'Gợi ý món ăn, chưa chọn quán',
  );
  await page.getByLabel('Chi phí nhóm (VND)', { exact: true }).fill('120000');
  await page
    .getByRole('button', { name: 'Áp dụng thay đổi', exact: true })
    .click();
  await page.getByRole('button', { name: 'Giữ lịch này', exact: true }).click();
  await page.getByLabel('Ngày khởi hành', { exact: true }).fill('2026-11-12');
  await page.getByText('Đổi tên hoặc thêm ghi chú', { exact: false }).click();
  await page
    .getByLabel('Tên chuyến đi', { exact: true })
    .fill('Mobile UX regression');
  await page
    .getByRole('button', { name: 'Lưu chuyến đi', exact: true })
    .click();
  await expect(page).toHaveURL(/\/trips\/[a-f0-9]{24}$/);
  const tripUrl = page.url();
  await page.reload();
  await expect(page.getByRole('status', { name: 'Trạng thái lưu' })).toHaveText(
    'Đã lưu',
  );
  await page.getByText('Chuẩn bị trước khi đi', { exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Bổ sung chỗ ở vào ngày 1' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Lưu để xem offline', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: /Muốn đổi nhịp/ }).click();
  await page.route('**/goe-proposal', (r) =>
    r.fulfill({
      status: 502,
      json: {
        ok: false,
        error: {
          code: 'AI_SCHEDULE_CONFLICT',
          message: 'Goe cần đủ thời gian tham quan. Thử bớt hoặc đổi một điểm.',
        },
      },
    }),
  );
  await page
    .getByLabel('Hỏi Goe về chuyến đi')
    .fill('Giữ bữa ăn và thêm chỗ đi buổi tối');
  await page.getByRole('button', { name: 'Gửi tin nhắn' }).click();
  await expect(page.getByRole('alert')).toContainText(
    'Thử bớt hoặc đổi một điểm',
  );
  await expect(
    page.getByRole('button', { name: 'Kiểm tra kết quả đang chờ' }),
  ).toHaveCount(0);
  await expect(page.getByLabel('Hỏi Goe về chuyến đi')).toHaveValue(
    'Giữ bữa ăn và thêm chỗ đi buổi tối',
  );
  await page.getByRole('button', { name: 'Về lịch để tự chỉnh' }).click();
  await expect(page).toHaveURL(tripUrl + '?day=0');
  await expect(page.locator('.journey-stop-open')).toHaveCount(1);
  await page.getByRole('button', { name: 'Chi phí', exact: true }).click();
  await expect(page.locator('.budget-total')).toContainText('120.000');
});

test('quick mobile plan: recover proposal, swap or undo a stop, choose dates only at save and reload', async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/register');
  const origin = new URL(page.url()).origin;
  const registered = await page.request.post('/api/v1/auth/register', {
    headers: { Origin: origin, 'X-GoEase-Client': 'web' },
    data: {
      displayName: 'Quick plan fixture',
      email: `quick-plan-${Date.now()}@example.invalid`,
      password: 'Quick-plan-fixture-2026',
    },
  });
  expect(registered.status()).toBe(201);
  const user = (await registered.json()).data.user;
  await page.goto('/trips/new');
  await page
    .getByRole('button', { name: 'Hà Nội Goe kiểm tra dữ liệu khi lập lịch' })
    .click();
  await expect(
    page.getByRole('button', { name: 'Lên lịch giúp mình' }),
  ).toBeEnabled();
  await page
    .getByRole('button', { name: 'Hội An Goe kiểm tra dữ liệu khi lập lịch' })
    .click();
  await expect(
    page.getByRole('button', { name: '2 ngày', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('Ngày đi', { exact: true })).toHaveCount(0);
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(
      page.getByRole('button', { name: 'Lên lịch giúp mình' }),
    ).toBeInViewport();
  }
  const catalog = (
    await (
      await page.request.get(
        '/api/v1/places?destinationId=000000000000000000000004&limit=30',
      )
    ).json()
  ).data.items;
  const visit = catalog.find(
    (p: { name: string }) => p.name === 'Phố cổ Hội An',
  );
  const meal = catalog.find(
    (p: { name: string }) => p.name === 'Cơm gà Hội An',
  );
  const beach = catalog.find(
    (p: { name: string }) => p.name === 'Biển An Bàng',
  );
  const keys: string[] = [];
  let fixture: TripInput | undefined;
  const runId = crypto.randomUUID();
  // Explicit successful-provider fixture in the isolated test DB, never a claim of live AI.
  const connection = await mongoose
    .createConnection(
      'mongodb://127.0.0.1:27020/goease_f0_test?replicaSet=goease_e2e',
    )
    .asPromise();
  try {
    // A successful-provider fixture must satisfy the same price/hours/venue guards as a real proposal.
    // These changes are restricted to the test-owned database created by beforeAll.
    const referencePrice = {
      label: 'Explicit test price',
      amountMinor: 20000,
      basis: 'per_person' as const,
      maxTravelers: 1000,
      conditions: 'Test fixture',
      inclusions: 'Test fixture',
      exclusions: 'Test fixture',
      sourceUrl: 'https://example.invalid/fixture-price',
      checkedAt: catalogToday(),
      reviewAfter: '2099-12-31',
    };
    for (const p of catalog as PlaceDto[]) {
      p.referencePrice = referencePrice;
      p.openingHoursNote = '07:00–22:00';
      p.venueType = p.category === 'food' ? 'restaurant' : 'place';
      await connection.collection('places').updateOne(
        { _id: new mongoose.Types.ObjectId(p.id) },
        {
          $set: {
            referencePrice,
            openingHoursNote: p.openingHoursNote,
            venueType: p.venueType,
          },
        },
      );
    }
    await page.route('**/api/v1/trips/ai-proposal', async (route) => {
      keys.push(route.request().headers()['idempotency-key']!);
      const request = route.request().postDataJSON();
      expect(request.consent).toBe(true);
      if (!fixture) {
        fixture = request.trip as TripInput;
        fixture.generationMode = 'ai';
        fixture.aiRunId = runId;
        fixture.days = fixture.days.map((d, i) => ({
          ...d,
          activities: (i === 0 ? [visit, meal] : [beach]).map((p, n) => ({
            activityId: crypto.randomUUID(),
            placeId: p.id,
            kind: p.category === 'food' ? 'meal' : 'visit',
            title: p.name,
            timezone: 'Asia/Ho_Chi_Minh',
            order: n,
            startLocalTime: n === 0 ? '09:00' : '13:00',
            endLocalTime: n === 0 ? '12:00' : '14:00',
            notes: 'Explicit automated provider fixture',
            estimatedCost: {
              ...catalogCost(p),
            },
            source: 'ai',
          })),
        }));
        await connection.collection('ai_runs').insertOne({
          runId,
          userId: new mongoose.Types.ObjectId(user.id),
          status: 'succeeded',
          promptVersion: 'hoian-v2',
          proposal: { trip: fixture },
          fixture: true,
        });
        await route.abort(); // generation committed but browser lost response
      } else
        await route.fulfill({
          json: {
            ok: true,
            data: {
              runId,
              trip: fixture,
              budget: {},
              warnings: ['Explicit automated provider fixture'],
            },
          },
        });
    });
    await page.getByRole('button', { name: 'Lên lịch giúp mình' }).click();
    await expect(
      page.getByRole('button', { name: 'Kiểm tra kết quả đang chờ' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Một mình', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Kiểm tra kết quả đang chờ' }),
    ).toHaveCount(0);
    await page.getByRole('button', { name: '2 người', exact: true }).click();
    await page
      .getByRole('button', { name: 'Kiểm tra kết quả đang chờ' })
      .click();
    await expect(
      page.getByText('LỊCH GỢI Ý CỦA GOE', { exact: true }),
    ).toBeVisible();
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
    await expect(
      page.getByRole('button', { name: 'Dùng lịch này', exact: true }),
    ).toHaveCount(0);
    expect(
      (await (await page.request.get('/api/v1/trips')).json()).data.items,
    ).toHaveLength(0);
    await page
      .getByRole('button', { name: 'Đổi Phố cổ Hội An', exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: 'Đổi sang Biển An Bàng', exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole('button', { name: 'Đổi sang Làng rau Trà Quế', exact: true })
      .click();
    await expect(page.locator('.journey-stop-open').first()).toContainText(
      '09:00',
    );
    await expect(page.locator('.journey-stop-open').first()).toContainText(
      'Làng rau Trà Quế',
    );
    await page
      .getByRole('button', { name: 'Bỏ Cơm gà Hội An', exact: true })
      .click();
    await expect(page.locator('.journey-stop-open')).toHaveCount(1);
    await page.getByRole('button', { name: 'Hoàn tác', exact: true }).click();
    await expect(page.locator('.journey-stop-open')).toHaveCount(2);
    await page
      .getByRole('button', { name: 'Giữ lịch này', exact: true })
      .click();
    await expect(
      page.getByLabel('Ngày khởi hành', { exact: true }),
    ).toHaveValue('');
    await page
      .getByRole('button', { name: 'Lưu chuyến đi', exact: true })
      .click();
    expect(
      (await (await page.request.get('/api/v1/trips')).json()).data.items,
    ).toHaveLength(0);
    await page.getByLabel('Ngày khởi hành', { exact: true }).fill('2026-12-05');
    await page
      .getByRole('button', { name: 'Lưu chuyến đi', exact: true })
      .click();
    await expect(page).toHaveURL(/\/trips\/[a-f0-9]{24}$/);
    await page.reload();
    await expect(
      page.getByRole('status', { name: 'Trạng thái lưu' }),
    ).toHaveText('Đã lưu');
    const trip = (
      await (
        await page.request.get(
          new URL(page.url()).pathname.replace('/trips/', '/api/v1/trips/'),
        )
      ).json()
    ).data.trip as TripDto;
    expect(trip.startDate).toBe('2026-12-05');
    expect(trip.endDate).toBe('2026-12-06');
    expect(trip.days[0]!.activities[0]!.title).toBe('Làng rau Trà Quế');
    expect(trip.days[0]!.activities[0]!.source).toBe('manual');
    expect(trip.days[0]!.activities[0]!.startLocalTime).toBe('09:00');
    expect(trip.days[0]!.activities[1]).toEqual(
      fixture!.days[0]!.activities[1],
    );
    expect(trip.days[1]!.activities).toEqual(fixture!.days[1]!.activities);
    expect(trip.days.map((d) => d.dayId)).toEqual(
      fixture!.days.map((d) => d.dayId),
    );
    expect(trip.aiRunId).not.toBe(runId);
    const rescheduledRun = await connection
      .collection('ai_runs')
      .findOne({ runId: trip.aiRunId });
    expect(rescheduledRun?.promptVersion).toBe('date-reschedule-v1');
    expect(String(rescheduledRun?.userId)).toBe(user.id);
    expect(rescheduledRun?.status).toBe('succeeded');
  } finally {
    await connection.close();
  }
});

test('admin publishes reference prices and mobile customer gets automatic estimates with saved snapshots', async ({
  page,
  browser,
}) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(15000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const email = `catalog-admin-${Date.now()}@example.invalid`;
  const password = 'Catalog-browser-test-2026!';
  await page.goto('/register');
  await page.getByLabel('Tên của bạn', { exact: true }).fill('Admin kiểm thử');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page
    .getByRole('button', { name: 'Tạo tài khoản', exact: false })
    .click();
  await expect(page).toHaveURL(/\/$/);
  const connection = await mongoose
    .createConnection(
      'mongodb://127.0.0.1:27020/goease_f0_test?replicaSet=goease_e2e',
    )
    .asPromise();
  const customerContext = await browser.newContext({
    baseURL: new URL(page.url()).origin,
    viewport: { width: 390, height: 844 },
  });
  try {
    // Explicit test-only role bootstrap; never a public signup field.
    await connection.collection('users').updateOne(
      { emailNormalized: email },
      {
        $set: { roles: ['traveler', 'admin'] },
        $inc: { securityVersion: 1 },
      },
    );
    await page.goto('/login');
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Đăng nhập', exact: false }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(
      page.getByRole('link', { name: 'Chuyến đi của tôi', exact: true }),
    ).toHaveCount(0);
    await page.goto('/trips/new');
    await expect(page).toHaveURL(/\/admin$/);
    await page.reload();
    await expect(
      page.getByRole('heading', {
        name: 'Việc cần làm',
        exact: true,
      }),
    ).toBeVisible();
    await page.getByRole('link', { name: 'Địa điểm', exact: true }).click();
    await page
      .getByRole('button', { name: 'Thêm địa điểm / quán ăn', exact: true })
      .click();
    await page
      .getByLabel('Loại địa điểm', { exact: true })
      .selectOption('restaurant');
    const name = `Quán kiểm thử ${Date.now()}`;
    await page.getByLabel('Tên địa điểm / quán ăn', { exact: true }).fill(name);
    await page
      .getByLabel('Giới thiệu ngắn', { exact: true })
      .fill('Dữ liệu kiểm thử, không phải cơ sở thật.');
    await page
      .getByLabel('Địa chỉ / vị trí tìm trên bản đồ', { exact: true })
      .fill('Địa chỉ minh họa Hội An');
    await page
      .getByLabel('Link nguồn thông tin', { exact: true })
      .fill('https://example.invalid/catalog-test');
    await page
      .getByLabel('Có giá đủ căn cứ để tự tính', { exact: true })
      .check();
    await page
      .getByLabel('Tên khoản giá', { exact: true })
      .fill('Bữa ăn thử nghiệm');
    await page.getByLabel('Giá tham khảo (VND)', { exact: true }).fill('50000');
    await page
      .getByLabel('Bao gồm gì / điều kiện áp dụng', { exact: true })
      .fill('Một bữa/người. Chỉ là giá kiểm thử.');
    await page
      .getByLabel('Link nguồn giá', { exact: true })
      .fill('https://example.invalid/test-price');
    await page
      .getByLabel('Ngày đối chiếu giá', { exact: true })
      .fill(catalogToday());
    await page
      .getByLabel('Cần kiểm tra lại vào', { exact: true })
      .fill('2099-12-31');
    let lost = false;
    await page.route('**/api/v1/admin/places', async (route) => {
      if (route.request().method() === 'POST' && !lost) {
        lost = true;
        await route.fetch();
        await route.abort();
      } else await route.continue();
    });
    await page
      .getByRole('button', { name: 'Lưu bản nháp', exact: true })
      .click();
    await expect(page.getByRole('alert')).toContainText('Không kết nối');
    await expect(
      page.getByLabel('Tên địa điểm / quán ăn', { exact: true }),
    ).toHaveValue(name);
    await page
      .getByRole('button', { name: 'Lưu bản nháp', exact: true })
      .click();
    await expect(page.getByRole('status')).toContainText('Đã lưu bản nháp');
    expect(await connection.collection('places').countDocuments({ name })).toBe(
      1,
    );
    await page.unroute('**/api/v1/admin/places');
    await page
      .getByRole('button', { name: 'Xem trước để xuất bản', exact: true })
      .click();
    await expect(
      page.getByRole('region', { name: 'Xem trước nội dung' }),
    ).toContainText('50.000');
    await page
      .getByRole('button', { name: 'Đăng địa điểm', exact: true })
      .click();
    await expect(page.getByRole('status')).toContainText('Đã xuất bản');
    await page
      .getByRole('button', { name: '← Về danh sách', exact: true })
      .click();
    await page.reload();
    await page
      .getByRole('button', { name: `Chỉnh sửa ${name}`, exact: true })
      .click();
    await expect(
      page.getByLabel('Giá tham khảo (VND)', { exact: true }),
    ).toHaveValue('50000');
    await mkdir('.local/catalog-review', { recursive: true });
    await page.screenshot({
      path: '.local/catalog-review/admin-desktop.png',
      fullPage: true,
    });
    const customer = await customerContext.newPage();
    await customer.goto('/register');
    await customer
      .getByLabel('Tên của bạn', { exact: true })
      .fill('Khách mới kiểm thử');
    await customer
      .getByLabel('Email', { exact: true })
      .fill(`catalog-customer-${Date.now()}@example.invalid`);
    await customer.getByLabel('Mật khẩu', { exact: true }).fill(password);
    await customer
      .getByRole('button', { name: 'Tạo tài khoản', exact: false })
      .click();
    await expect(customer).toHaveURL(/\/$/);
    expect((await customer.request.get('/api/v1/admin/places')).status()).toBe(
      403,
    );
    await customer.goto('/trips/new');
    await customer
      .getByRole('button', { name: /Hội An Goe kiểm tra dữ liệu khi lập lịch/ })
      .click();
    await customer
      .getByRole('button', { name: 'Tự chọn điểm dừng', exact: true })
      .click();
    await customer
      .getByRole('button', { name: `Thêm ${name}`, exact: true })
      .click();
    await customer
      .getByRole('button', { name: 'Chi phí', exact: true })
      .click();
    await expect(customer.locator('.budget-total')).toContainText('100.000');
    await customer
      .getByText('Giá nào đang được dùng?', { exact: true })
      .click();
    await expect(customer.locator('.budget-price-sources')).toContainText(
      'Một bữa/người',
    );
    await expect(customer.locator('.budget-scope-note')).toContainText(
      'Chưa bao gồm chỗ ở',
    );
    await customer
      .getByRole('button', { name: 'Giữ lịch này', exact: true })
      .click();
    await customer
      .getByLabel('Ngày khởi hành', { exact: true })
      .fill('2026-11-07');
    await customer
      .getByRole('button', { name: 'Lưu chuyến đi', exact: true })
      .click();
    await expect(customer).toHaveURL(/\/trips\/[a-f0-9]{24}$/);
    const tripPath = new URL(customer.url()).pathname.replace(
      '/trips/',
      '/api/v1/trips/',
    );
    const original = (await (await customer.request.get(tripPath)).json()).data
      .trip as TripDto;
    expect(original.budgetSummary!.knownEstimatedMinor).toBe(100000);
    expect(original.days[0]!.activities[0]!.estimatedCost.confidence).toBe(
      'catalog_reference',
    );
    await page.getByLabel('Giá tham khảo (VND)', { exact: true }).fill('80000');
    await page
      .getByRole('button', { name: 'Xem trước để xuất bản', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'Cập nhật nội dung công khai', exact: true })
      .click();
    await expect(page.getByRole('status')).toContainText('Đã xuất bản');
    await customer.reload();
    await customer
      .getByRole('button', { name: 'Chi phí', exact: true })
      .click();
    await expect(customer.locator('.budget-total')).toContainText('100.000');
    await customer.screenshot({
      path: '.local/catalog-review/customer-390.png',
      fullPage: false,
    });
    for (const width of [320, 390]) {
      await page.setViewportSize({ width: 1440, height: 900 });
      await customer.setViewportSize({ width, height: 844 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect(
        await customer.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    await customer
      .getByRole('button', { name: 'Quay lại', exact: true })
      .click();
    await customer.locator('.journey-stop-open').first().click();
    await customer
      .getByRole('button', { name: 'Cập nhật giá tham khảo', exact: true })
      .click();
    await expect(
      customer.getByLabel('Chi phí mỗi người (VND)', { exact: true }),
    ).toHaveValue('80000');
    await customer
      .getByRole('button', { name: 'Áp dụng thay đổi', exact: false })
      .click();
    await customer
      .getByRole('button', { name: 'Lưu thay đổi', exact: true })
      .click();
    await expect(
      customer.getByRole('status', { name: 'Trạng thái lưu' }),
    ).toHaveText('Đã lưu');
    await customer
      .getByRole('button', { name: 'Chi phí', exact: true })
      .click();
    await expect(customer.locator('.budget-total')).toContainText('160.000');
    page.once('dialog', (dialog) => dialog.accept());
    await page
      .getByRole('button', { name: 'Ngừng hiển thị', exact: true })
      .click();
    await expect(page.getByRole('status')).toContainText('Đã ngừng hiển thị');
    await customer.reload();
    const final = (await (await customer.request.get(tripPath)).json()).data
      .trip as TripDto;
    expect(final.budgetSummary!.knownEstimatedMinor).toBe(160000);
    expect(
      (
        await customer.request.get(
          `/api/v1/places/${final.days[0]!.activities[0]!.placeId}`,
        )
      ).status(),
    ).toBe(404);
  } finally {
    await customerContext.close();
    await connection.close();
  }
});
