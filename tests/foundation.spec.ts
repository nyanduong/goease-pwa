import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { once } from 'node:events';

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
    ['--dbpath', dbPath, '--bind_ip', '127.0.0.1', '--port', '27020'],
    { stdio: 'ignore', windowsHide: true },
  );
  await once(mongo, 'spawn');
  await expect
    .poll(
      async () => {
        if (mongo.exitCode !== null)
          throw new Error('Dedicated test mongod exited; check port 27020');
        return (await fetch('http://127.0.0.1:3000/api/v1/health/db')).status;
      },
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
    await page.goto('/');
    expect((await api).status()).toBe(200);
    expect((await database).status()).toBe(200);
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
  await page.goto('/');
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
  await page.goto('/');
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
