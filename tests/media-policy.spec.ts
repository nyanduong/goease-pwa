import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { e2eWebOrigin } from './ports.js';

test('a broken source gallery image is hidden while the cached cover remains visible', async ({
  page,
}) => {
  const headers = {
    Origin: e2eWebOrigin,
    'X-GoEase-Client': 'web',
    'Idempotency-Key': crypto.randomUUID(),
  };
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
  const coverUrl =
    'https://res.cloudinary.com/fixture/image/upload/cached-cover.webp';
  const sourceUrl =
    'https://upload.wikimedia.org/wikipedia/commons/a/ab/removed-fixture.png';
  const photo = {
    url: coverUrl,
    originalUrl:
      'https://upload.wikimedia.org/wikipedia/commons/a/ab/cover-fixture.png',
    storage: 'cloudinary',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:cover-fixture.png',
    credit: 'GoEase photo fixture',
    license: 'CC-BY-SA-4.0',
    reviewed: true,
    selection: 'admin',
    kind: 'photo',
  };
  const place = {
    destinationId: '000000000000000000000004',
    name: 'Bìa lưu riêng fixture',
    category: 'culture',
    venueType: 'place',
    description: 'Dữ liệu kiểm thử ảnh có nguồn, không phải địa điểm thực.',
    locationQuery: 'Đà Nẵng fixture',
    durationMinutes: 60,
    openingHoursNote: '',
    sourceUrl: 'https://www.openstreetmap.org/node/1234',
    referencePrice: null,
    publicationStatus: 'draft',
    images: [
      photo,
      {
        ...photo,
        url: sourceUrl,
        originalUrl: sourceUrl,
        storage: 'source',
        sourceUrl:
          'https://commons.wikimedia.org/wiki/File:removed-fixture.png',
      },
    ],
  };
  const response = await page.request.post('/api/v1/admin/places', {
    headers,
    data: { place },
  });
  expect(response.ok()).toBe(true);
  const created = (await response.json()).data.place;
  expect(
    (
      await page.request.patch(`/api/v1/admin/places/${created.id}`, {
        headers: { ...headers, 'Idempotency-Key': crypto.randomUUID() },
        data: {
          place: { ...place, publicationStatus: 'published' },
          intent: 'publish',
          expectedRevision: created.revision,
        },
      })
    ).ok(),
  ).toBe(true);
  await page.request.post('/api/v1/auth/logout', { headers });
  await page.route(coverUrl, (route) =>
    route.fulfill({
      contentType: 'image/png',
      body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        'base64',
      ),
    }),
  );
  await page.route(sourceUrl, (route) => route.abort());
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto(`/places/${created.id}`);
  await expect(page.locator('.place-source-gallery figure')).toHaveCount(1);
  await expect(
    page.getByRole('img', { name: place.name, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('img', { name: `${place.name} · ảnh 2`, exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText('Ảnh minh họa AI ·', { exact: true }),
  ).toHaveCount(0);
  await page.request.post('/api/v1/auth/login', {
    headers,
    data: {
      email: 'catalog-browser@example.invalid',
      password: 'Browser-fixture-2026!',
    },
  });
  const oldError =
    'Chưa lưu được ảnh bìa Wikimedia vào Cloudinary. Hãy thử lại.';
  await page.route(`**/api/v1/admin/places/${created.id}/images`, (route) =>
    route.fulfill({
      json: {
        ok: true,
        data: {
          state: 'failed',
          candidates: [],
          defaultCover: null,
          message: oldError,
          checkedAt: new Date().toISOString(),
        },
      },
    }),
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/admin#places?q=${encodeURIComponent(place.name)}`);
  await page
    .getByRole('button', { name: `Chỉnh sửa ${place.name}`, exact: true })
    .click();
  await page.getByRole('tab', { name: /Ảnh địa điểm/ }).click();
  const photos = page.getByRole('region', { name: 'Ảnh gợi ý Wikimedia' });
  await expect(
    photos.getByRole('img', { name: `Ảnh bìa đã chọn: ${place.name}` }),
  ).toBeVisible();
  await expect(
    photos.getByText(
      'Ảnh bìa đã chọn vẫn được giữ. Lượt tìm ảnh bổ sung chưa thành công; bạn có thể thử lại.',
      { exact: true },
    ),
  ).toBeVisible();
  await expect(photos.getByText(oldError, { exact: true })).toHaveCount(0);
  await mkdir('test-results/media-policy', { recursive: true });
  await photos.screenshot({
    path: 'test-results/media-policy/selected-cover-search-failed.png',
  });
});
test('AI cover metadata persists and customer sees explicit illustration label at desktop/mobile', async ({
  page,
}) => {
  page.setDefaultTimeout(15000);
  const headers = {
    Origin: e2eWebOrigin,
    'X-GoEase-Client': 'web',
    'Idempotency-Key': crypto.randomUUID(),
  };
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
  const image = {
    url: 'https://res.cloudinary.com/fixture/image/upload/ai-cover-fixture.webp',
    sourceUrl: 'https://example.com/ai-generation-fixture',
    credit: 'GoEase AI test fixture',
    license: 'owned',
    reviewed: true,
    selection: 'admin',
    kind: 'ai_illustration',
  };
  const place = {
    destinationId: '000000000000000000000004',
    name: 'Ảnh minh họa fixture',
    category: 'culture',
    venueType: 'place',
    description:
      'Nội dung kiểm thử hiển thị, không phải thông tin địa điểm thực.',
    locationQuery: 'Địa chỉ fixture Đà Nẵng',
    durationMinutes: 60,
    openingHoursNote: '',
    sourceUrl: 'https://www.openstreetmap.org/node/123',
    referencePrice: null,
    publicationStatus: 'draft',
    images: [image],
  };
  const response = await page.request.post('/api/v1/admin/places', {
    headers,
    data: { place },
  });
  expect(response.ok()).toBe(true);
  const created = (await response.json()).data.place;
  const published = await page.request.patch(
    `/api/v1/admin/places/${created.id}`,
    {
      headers: { ...headers, 'Idempotency-Key': crypto.randomUUID() },
      data: {
        place: { ...place, publicationStatus: 'published' },
        expectedRevision: created.revision,
        intent: 'publish',
      },
    },
  );
  expect(published.ok()).toBe(true);
  const publicPlace = (
    await (await page.request.get(`/api/v1/places/${created.id}`)).json()
  ).data.place;
  expect(publicPlace.images).toHaveLength(1);
  expect(publicPlace.images[0].kind).toBe('ai_illustration');
  await page.request.post('/api/v1/auth/logout', { headers });
  await page.route(image.url, (route) =>
    route.fulfill({
      contentType: 'image/png',
      body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        'base64',
      ),
    }),
  );
  await page.goto(`/places/${created.id}`);
  await mkdir('test-results/media-policy', { recursive: true });
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(
      page.getByText('Ảnh minh họa AI ·', { exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole('img', { name: 'Ảnh minh họa fixture — ảnh minh họa AI' }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/media-policy/ai-cover-${width}.png`,
      fullPage: true,
    });
  }
  // Admin can identify the illustration in the editor and cannot mix it with another AI image.
  await page.request.post('/api/v1/auth/login', {
    headers,
    data: {
      email: 'catalog-browser@example.invalid',
      password: 'Browser-fixture-2026!',
    },
  });
  await page.goto('/admin#places');
  await page.getByPlaceholder('Tìm tên hoặc địa chỉ…').fill(place.name);
  const adminCover = page
    .getByRole('button', { name: `Mở ${place.name}`, exact: true })
    .getByRole('img', { name: `${place.name} — ảnh minh họa AI` });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(adminCover).toBeVisible();
    await expect(adminCover).toHaveAttribute('src', image.url);
    await expect
      .poll(() =>
        adminCover.evaluate((img: HTMLImageElement) => img.naturalWidth),
      )
      .toBeGreaterThan(0);
  }
  await page.unroute(image.url);
  await page.route(image.url, (route) => route.abort());
  await page.reload();
  await page.getByPlaceholder('Tìm tên hoặc địa chỉ…').fill(place.name);
  await expect(
    page
      .getByRole('button', { name: `Mở ${place.name}`, exact: true })
      .getByRole('img', { name: 'Ảnh lỗi tải', exact: true }),
  ).toBeVisible();
  await page.goto('/admin#places?create=1');
  await page.getByRole('tab', { name: /Ảnh địa điểm/ }).click();
  await page.getByText('Ảnh đã chọn (0/5)', { exact: true }).click();
  await page.getByLabel('Loại ảnh thêm vào').selectOption('ai_illustration');
  await page.getByLabel('Đường dẫn ảnh HTTPS').fill(image.url);
  await page.getByLabel('Tác giả / ghi công').fill(image.credit);
  await page
    .getByLabel('Nguồn hoặc bằng chứng quyền sử dụng')
    .fill(image.sourceUrl);
  await page
    .getByRole('checkbox', {
      name: 'Tôi có quyền dùng ảnh AI này và đồng ý hiển thị nhãn ảnh minh họa',
    })
    .check();
  await page
    .getByRole('button', { name: 'Thêm vào bản chỉnh sửa', exact: true })
    .click();
  await expect(
    page.getByText('Ảnh đã chọn (1/1)', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Thêm vào bản chỉnh sửa', exact: true }),
  ).toBeDisabled();
});
