import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { adminPlaceInputSchema } from '@goease/contracts';
import { fixturePhoto } from '../server/test/support/photo.js';
import { e2eWebOrigin } from './ports.js';

test('legacy budget price opens in the same single-price editor without re-entry', async ({
  page,
}) => {
  await page.goto('/login');
  await page
    .getByLabel('Email', { exact: true })
    .fill('catalog-browser@example.invalid');
  await page
    .getByLabel('Mật khẩu', { exact: true })
    .fill('Browser-fixture-2026!');
  await page.getByRole('button', { name: /^Đăng nhập/ }).click();
  await expect(
    page.getByRole('heading', { name: 'Tổng quan dữ liệu' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Địa điểm', exact: true }).click();
  await page.getByLabel('Tìm trong danh mục').fill('Vườn Cẩm');
  await page.getByRole('button', { name: /^Mở Vườn Cẩm/ }).click();
  await page
    .getByRole('tab', { name: 'Giá & giờ mở cửa', exact: true })
    .click();
  await expect(page.getByLabel('Giá từ (VND)', { exact: true })).toHaveCount(1);
  await expect(page.getByLabel('Giá từ (VND)', { exact: true })).toHaveValue(
    '10000',
  );
  await expect(page.getByLabel('Đơn vị áp dụng', { exact: true })).toHaveValue(
    'person',
  );
  await expect(page.getByLabel('Đã bao gồm', { exact: true })).toHaveValue(
    'Vào cửa',
  );
  await expect(page.getByLabel('Chưa bao gồm', { exact: true })).toHaveValue(
    'Dịch vụ thêm',
  );
  await expect(page.getByLabel('Số người tối đa', { exact: true })).toHaveValue(
    '10',
  );
  await expect(page.locator('.visit-price-eligibility')).toContainText(
    'Dùng để hiển thị và tính ngân sách',
  );
  await expect(page.locator('.visit-budget-advanced')).toHaveCount(0);
});
test('practical editor: unknown, manual free price, source confirmation, edit resets review and one price supplies display and budget', async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await mkdir('test-results/catalog-evidence', { recursive: true });
  await page.goto('/login');
  await page
    .getByLabel('Email', { exact: true })
    .fill('catalog-browser@example.invalid');
  await page
    .getByLabel('Mật khẩu', { exact: true })
    .fill('Browser-fixture-2026!');
  await page.getByRole('button', { name: /^Đăng nhập/ }).click();
  await expect(
    page.getByRole('heading', { name: 'Tổng quan dữ liệu' }),
  ).toBeVisible();
  const response = await page.request.post('/api/v1/admin/places', {
    headers: {
      Origin: e2eWebOrigin,
      'X-GoEase-Client': 'web',
      'Idempotency-Key': randomUUID(),
    },
    data: {
      place: {
        destinationId: '000000000000000000000004',
        name: 'Giờ và giá UX fixture',
        category: 'culture',
        venueType: 'place',
        description: 'Nội dung kiểm thử giao diện, không phải địa điểm thật.',
        locationQuery: 'Địa chỉ fixture',
        durationMinutes: 60,
        openingHoursNote: '',
        sourceUrl: 'https://www.openstreetmap.org/node/123',
        referencePrice: null,
        publicationStatus: 'draft',
        images: [fixturePhoto],
      },
      intent: 'save',
    },
  });
  expect(response.ok()).toBeTruthy();
  const created = (await response.json()).data.place;
  let sourceReady = false;
  const evidence = {
    sourceUrl: 'https://example.com/tickets',
    observedAt: new Date().toISOString(),
    reviewed: false,
  };
  const facts = {
    hours: { ...evidence, text: 'Thứ Ba – Chủ nhật 08:00–17:00' },
    price: {
      ...evidence,
      amount: 40000,
      currency: 'VND',
      unit: 'person',
      conditions: 'Vé người lớn; không gồm dịch vụ riêng.',
    },
  };
  await page.route(`**/api/v1/admin/places/${created.id}/visit-info`, (r) =>
    r.fulfill({
      json: {
        ok: true,
        data: {
          state: sourceReady ? 'ready' : 'empty',
          result: sourceReady ? facts : null,
          message: 'Fixture',
          checkedAt: new Date().toISOString(),
        },
      },
    }),
  );
  await page.route(
    `**/api/v1/admin/places/${created.id}/visit-info/search`,
    (r) =>
      r.fulfill({
        json: {
          ok: true,
          data: {
            state: 'pending',
            result: null,
            message: 'Fixture',
            checkedAt: null,
          },
        },
      }),
  );
  await page.getByRole('link', { name: 'Địa điểm', exact: true }).click();
  await page.getByLabel('Tìm trong danh mục').fill(created.name);
  await page
    .getByRole('button', { name: 'Mở ' + created.name, exact: true })
    .click();
  await page
    .getByRole('tab', { name: 'Giá & giờ mở cửa', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Thông tin khách sẽ thấy', exact: true }),
  ).toBeVisible();
  const practical = page.locator('#place-panel-practical');
  await expect(
    practical.locator('textarea[aria-label="Giờ mở cửa hiển thị cho khách"]'),
  ).toHaveCount(1);
  await expect(practical.locator('.visit-budget-advanced')).toHaveCount(0);
  await page.screenshot({
    path: 'test-results/catalog-evidence/shared-price-empty.png',
    fullPage: true,
  });
  await expect(
    page.getByRole('button', { name: 'Chưa rõ giá', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Có thu phí', exact: true }).click();
  await page.getByLabel('Giá từ (VND)', { exact: true }).fill('30000');
  await page
    .getByLabel('Đơn vị áp dụng', { exact: true })
    .selectOption('person');
  await page
    .getByLabel('Đối tượng và điều kiện áp dụng', { exact: true })
    .fill('Vé người lớn fixture.');
  await page
    .getByLabel('Nguồn để kiểm tra giá', { exact: true })
    .fill('https://example.com/manual-ticket');
  await page
    .getByRole('button', { name: 'Xác nhận giá này', exact: true })
    .click();
  await expect(page.locator('.visit-customer-preview strong')).toHaveText(
    'Từ 30.000đ/người',
  );
  await page.getByRole('button', { name: 'Chưa rõ giá', exact: true }).click();
  await page.getByRole('button', { name: 'Miễn phí', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Xác nhận giá này', exact: true }),
  ).toBeDisabled();
  await page
    .getByLabel('Nguồn để kiểm tra giá', { exact: true })
    .fill('https://example.com/free-entry');
  await page
    .getByRole('button', { name: 'Xác nhận giá này', exact: true })
    .click();
  await expect(page.locator('.visit-customer-preview strong')).toHaveText(
    'Miễn phí',
  );
  await page.getByRole('button', { name: 'Chưa rõ giá', exact: true }).click();
  sourceReady = true;
  await page.getByRole('button', { name: 'Tìm lại', exact: true }).click();
  await page
    .getByRole('button', { name: 'Xem giá gợi ý đã tìm được', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Xem gợi ý giờ đã tìm được', exact: true })
    .click();
  await page.getByRole('button', { name: 'Dùng giờ này', exact: true }).click();
  await page
    .getByRole('button', { name: 'Xác nhận giá này', exact: true })
    .click();
  await expect(page.locator('.visit-customer-preview strong')).toHaveText(
    'Từ 40.000đ/người',
  );
  await page
    .getByLabel('Đối tượng của giá', { exact: true })
    .selectOption('standard');
  await page.getByLabel('Đã bao gồm', { exact: true }).fill('Vé vào cửa');
  await page.getByLabel('Chưa bao gồm', { exact: true }).fill('Hướng dẫn viên');
  await page
    .getByLabel('Kiểm tra giá lại vào ngày', { exact: true })
    .fill('2099-12-31');
  await page.getByLabel('Giá từ (VND)', { exact: true }).fill('45000');
  await expect(
    page.getByRole('button', { name: 'Xác nhận giá này', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Xác nhận giá này', exact: true })
    .click();
  await expect(page.locator('.visit-price-eligibility')).toContainText(
    'Dùng để hiển thị và tính ngân sách',
  );
  await expect(
    practical.getByLabel('Giá từ (VND)', { exact: true }),
  ).toHaveCount(1);
  const saved = page.waitForResponse(
    (r) =>
      r.url().endsWith(`/admin/places/${created.id}`) &&
      r.request().method() === 'PATCH',
  );
  await page.getByRole('button', { name: 'Lưu đề xuất', exact: true }).click();
  expect((await saved).ok()).toBeTruthy();
  const read = (
    await (await page.request.get(`/api/v1/admin/places/${created.id}`)).json()
  ).data.place;
  expect(read.visitInfo.price.amount).toBe(45000);
  expect(read.visitInfo.price.reviewed).toBe(true);
  expect(read.visitInfo.hours.reviewed).toBe(true);
  expect(read.openingHoursNote).toBe(facts.hours.text);
  expect(read.referencePrice.amountMinor).toBe(45000);
  expect(read.referencePrice.basis).toBe('per_person');
  expect(read.visitInfo.pricingVersion).toBe(1);
  expect(
    adminPlaceInputSchema.safeParse({
      destinationId: read.destinationId,
      name: read.name,
      category: read.category,
      venueType: read.venueType,
      description: read.description,
      locationQuery: read.locationQuery,
      durationMinutes: read.durationMinutes,
      openingHoursNote: read.openingHoursNote,
      sourceUrl: read.sourceUrl,
      publicationStatus: 'published',
      referencePrice: null,
      images: read.images,
      visitInfo: read.visitInfo,
    }).success,
  ).toBe(true);
  await page.screenshot({
    path: 'test-results/catalog-evidence/shared-price-confirmed.png',
    fullPage: true,
  });
  expect(errors).toEqual([]);
  for (const width of [1366, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      )
      .toBe(true);
  }
});
