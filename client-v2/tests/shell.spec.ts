import { expect, test } from '@playwright/test';

test('desktop shell connects to real Express health and supports keyboard navigation', async ({
  page,
  request,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 800 });
  const health = await request.get('/api/v1/health');
  expect(health.status()).toBe(200);
  expect(await health.json()).toEqual({
    ok: true,
    data: { status: 'up', service: 'goease-api' },
  });
  const database = await request.get('/api/v1/health/db');
  expect(database.status()).toBe(503);

  await page.goto('/');
  await expect(page.getByRole('status')).toContainText('Đã kết nối');
  const hero = page.getByRole('heading', { name: 'Nền tảng GoEase' });
  await expect(hero).toHaveCSS('color', 'rgb(255, 255, 255)');
  await expect(hero).toHaveCSS('font-size', '24px');
  await expect(hero).toHaveCSS('font-weight', '800');
  await expect(page.getByRole('region', { name: 'Nền tảng GoEase' })).toHaveCSS(
    'background-color',
    'rgb(25, 38, 77)',
  );
  const nav = page.getByRole('navigation', { name: 'Điều hướng chính' });
  await expect(nav.getByRole('link')).toHaveText([
    'Khám phá',
    'Đi chơi',
    'Dấu ấn',
    'Tôi',
  ]);
  await expect(nav.getByRole('link', { name: 'Khám phá' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  expect(
    await nav.evaluate((element) => getComputedStyle(element).position),
  ).toBe('static');
  await page.screenshot({ path: testInfo.outputPath('desktop.png') });

  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('link', { name: 'Đến nội dung chính' }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
  await nav.getByRole('link', { name: 'Đi chơi' }).click();
  await expect(page).toHaveURL(/\/di-choi$/);
  await expect(page.getByRole('heading', { name: 'Đi chơi' })).toBeVisible();
  await expect(page.getByRole('main')).toBeFocused();
  await expect(page).toHaveTitle('Đi chơi · GoEase');
  await page.goBack();
  await expect(
    page.getByRole('heading', { name: 'Nền tảng GoEase' }),
  ).toBeVisible();
});

test.describe('mobile', () => {
  test.use({
    isMobile: true,
    hasTouch: true,
    viewport: { width: 390, height: 844 },
  });

  test('bottom navigation fits narrow viewports and deep links reload', async ({
    page,
  }, testInfo) => {
    const nav = page.getByRole('navigation', { name: 'Điều hướng chính' });
    const main = page.getByRole('main');
    await page.goto('/');
    await expect(page.getByRole('status')).toContainText('Đã kết nối');

    for (const width of [320, 375, 390]) {
      await page.setViewportSize({ width, height: 844 });
      expect(
        await main.evaluate(() => document.documentElement.scrollWidth),
      ).toBe(width);
      expect(
        await nav.evaluate((element) => getComputedStyle(element).position),
      ).toBe('fixed');
      expect((await nav.boundingBox())?.y).toBeGreaterThan(750);
    }
    await page.screenshot({ path: testInfo.outputPath('mobile.png') });

    await nav.getByRole('link', { name: 'Dấu ấn' }).click();
    await expect(page).toHaveURL(/\/dau-an$/);
    await nav.getByRole('link', { name: 'Tôi' }).click();
    await expect(page).toHaveURL(/\/toi$/);
    await page.reload();
    await expect(main.getByRole('heading', { name: 'Tôi' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Tôi' })).toHaveAttribute(
      'aria-current',
      'page',
    );

    await page.goto('/trang-khong-ton-tai');
    await expect(
      main.getByRole('heading', { name: 'Không tìm thấy trang' }),
    ).toBeVisible();
    await expect(nav.locator('[aria-current]')).toHaveCount(0);
    await main.getByRole('link', { name: 'Về Khám phá' }).click();
    await expect(
      main.getByRole('heading', { name: 'Nền tảng GoEase' }),
    ).toBeVisible();
  });
});

test('API loading, network failure, malformed success and real recovery', async ({
  page,
}) => {
  const healthUrl = '**/api/v1/health';
  let releaseFailure!: () => void;
  const pendingFailure = new Promise<void>((resolve) => {
    releaseFailure = resolve;
  });
  await page.route(healthUrl, async (route) => {
    await pendingFailure;
    await route.abort('failed');
  });
  await page.goto('/');
  const status = page.getByRole('status');
  await expect(status).toContainText('Đang kiểm tra');
  await expect(
    page.getByRole('button', { name: 'Kiểm tra lại' }),
  ).toBeDisabled();
  releaseFailure();

  await expect(status).toContainText('Không kết nối được với API');
  await page.unroute(healthUrl);
  await page.route(healthUrl, (route) => route.fulfill({ json: { ok: true } }));
  await page.getByRole('button', { name: 'Thử lại' }).click();
  await expect(status).toContainText('phản hồi không hợp lệ');

  await page.unroute(healthUrl);
  await page.getByRole('button', { name: 'Thử lại' }).click();
  await expect(status).toContainText('Đã kết nối');
});
