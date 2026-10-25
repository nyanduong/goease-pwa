import { test, expect } from '@playwright/test';
import type { TripInput } from '@goease/contracts';
import { mkdir } from 'node:fs/promises';
import { e2eWebOrigin } from './ports.js';

test('confirmation modal protects unsaved admin content, traps focus, cancels and discards on mobile', async ({
  page,
}) => {
  page.setDefaultTimeout(15000);
  const native: string[] = [];
  page.on('dialog', async (dialog) => {
    native.push(dialog.type());
    await dialog.dismiss();
  });
  expect(
    (
      await page.request.post('/api/v1/auth/login', {
        headers: { Origin: e2eWebOrigin, 'X-GoEase-Client': 'web' },
        data: {
          email: 'catalog-browser@example.invalid',
          password: 'Browser-fixture-2026!',
        },
      })
    ).ok(),
  ).toBe(true);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/admin#places?create=1');
  const name = page.getByLabel('Tên địa điểm / quán ăn', { exact: true });
  await name.fill('Bản nháp chưa lưu · thử modal');
  const back = page.getByRole('button', {
    name: '← Về danh sách',
    exact: true,
  });
  await back.click();
  const modal = page.getByRole('alertdialog', {
    name: 'Bỏ thay đổi chưa lưu?',
  });
  await expect(modal).toBeVisible();
  await expect(modal).toContainText(
    'Về danh sách? Thay đổi chưa lưu sẽ bị bỏ.',
  );
  const stay = modal.getByRole('button', { name: 'Ở lại', exact: true });
  await expect(stay).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(
    modal.getByRole('button', { name: 'Bỏ thay đổi', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(
    modal.getByRole('button', { name: 'Đóng xác nhận' }),
  ).toBeFocused();
  await mkdir('test-results/confirmation-evidence', { recursive: true });
  await page.screenshot({
    path: 'test-results/confirmation-evidence/admin-desktop.png',
  });
  await stay.click();
  await expect(modal).not.toBeVisible();
  await expect(name).toHaveValue('Bản nháp chưa lưu · thử modal');
  await expect(back).toBeFocused();
  await back.click();
  await page.keyboard.press('Escape');
  await expect(modal).not.toBeVisible();
  await expect(name).toHaveValue('Bản nháp chưa lưu · thử modal');
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await back.click();
    await expect(modal).toBeVisible();
    const bounds = await modal.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    expect(await modal.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: `test-results/confirmation-evidence/admin-${width}.png`,
    });
    await modal.getByRole('button', { name: 'Đóng xác nhận' }).click();
    await expect(name).toHaveValue('Bản nháp chưa lưu · thử modal');
  }
  await back.click();
  await modal.getByRole('button', { name: 'Bỏ thay đổi', exact: true }).click();
  await expect(name).not.toBeVisible();
  expect(native).toEqual([]);
});

test('confirmation above an expense sheet preserves the sheet on Escape and only deletes after acceptance', async ({
  page,
}) => {
  page.setDefaultTimeout(15000);
  const native: string[] = [];
  page.on('dialog', async (dialog) => {
    native.push(dialog.type());
    await dialog.dismiss();
  });
  const headers = {
    Origin: e2eWebOrigin,
    'X-GoEase-Client': 'web',
    'Idempotency-Key': crypto.randomUUID(),
  };
  expect(
    (
      await page.request.post('/api/v1/auth/register', {
        headers,
        data: {
          email: `modal-${Date.now()}@example.invalid`,
          password: 'Browser-fixture-2026!',
          displayName: 'Khách thử modal',
        },
      })
    ).ok(),
  ).toBe(true);
  const input: TripInput = {
    title: 'Chuyến thử xác nhận',
    destinations: [{ destinationId: '000000000000000000000004', order: 0 }],
    startDate: '2026-11-12',
    endDate: '2026-11-12',
    timezone: 'Asia/Ho_Chi_Minh',
    travelers: { totalCount: 2 },
    budget: {
      amountMinor: null,
      currency: 'VND',
      scope: 'group_total',
      includedCategories: [],
    },
    preferences: { interestCodes: [], pace: 'balanced', transportModes: [] },
    generationMode: 'manual',
    notes: '',
    days: [
      {
        dayId: crypto.randomUUID(),
        date: '2026-11-12',
        destinationId: '000000000000000000000004',
        activities: [],
      },
    ],
  };
  const created = await page.request.post('/api/v1/trips', {
    headers,
    data: { trip: input },
  });
  expect(created.ok()).toBe(true);
  const trip = (await created.json()).data.trip;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/trips/${trip.id}`);
  await page.getByRole('button', { name: 'Chi phí', exact: true }).click();
  await page
    .getByRole('button', { name: 'Ghi lại chi tiêu (tùy chọn)', exact: true })
    .click();
  await page
    .getByRole('button', { name: '+ Thêm khoản chi', exact: true })
    .click();
  const sheet = page.getByRole('dialog', {
    name: 'Thêm khoản chi',
    exact: true,
  });
  await sheet.getByLabel('Tên khoản chi').fill('Taxi thử modal');
  await sheet.getByRole('button', { name: 'Đóng', exact: true }).click();
  const discard = page.getByRole('alertdialog', {
    name: 'Bỏ khoản chi chưa lưu?',
  });
  await expect(discard).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(discard).not.toBeVisible();
  await expect(sheet).toBeVisible();
  await expect(sheet.getByLabel('Tên khoản chi')).toHaveValue('Taxi thử modal');
  await expect(
    sheet.getByRole('button', { name: 'Đóng', exact: true }),
  ).toBeFocused();
  await sheet
    .getByLabel('Số tiền đã chi (VND)', { exact: true })
    .fill('120000');
  await sheet
    .getByRole('button', { name: 'Lưu khoản chi', exact: true })
    .click();
  await expect(sheet).not.toBeVisible();
  let deletes = 0;
  page.on('request', (req) => {
    if (req.method() === 'DELETE' && req.url().includes('/expenses/'))
      deletes++;
  });
  const remove = page.getByRole('button', {
    name: 'Xóa Taxi thử modal',
    exact: true,
  });
  await remove.click();
  const modal = page.getByRole('alertdialog', {
    name: 'Xóa khoản chi?',
    exact: true,
  });
  await expect(modal).toContainText('Taxi thử modal');
  await modal.getByRole('button', { name: 'Hủy', exact: true }).click();
  expect(deletes).toBe(0);
  await expect(remove).toBeVisible();
  await remove.click();
  await mkdir('test-results/confirmation-evidence', { recursive: true });
  await page.screenshot({
    path: 'test-results/confirmation-evidence/expense-delete-mobile.png',
  });
  await modal
    .getByRole('button', { name: 'Xóa khoản chi', exact: true })
    .click();
  await expect(remove).not.toBeVisible();
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe(
    'hidden',
  );
  expect(deletes).toBe(1);
  expect(native).toEqual([]);
});
