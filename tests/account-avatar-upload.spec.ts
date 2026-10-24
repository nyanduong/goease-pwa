import { test, expect } from '@playwright/test';

test('mocked avatar crop/upload retry and personal-center layout preserve edits', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const avatarUrl = 'https://avatar.example.invalid/cropped.webp';
  let profile = {
    user: {
      id: '507f1f77bcf86cd799439011',
      displayName: 'Người du lịch',
      email: 'traveler@example.invalid',
      emailVerified: false,
      avatarUrl: null as string | null,
    },
    revision: 0,
    canChangePassword: true,
    createdAt: '2026-10-20T08:47:00Z',
    updatedAt: '2026-10-24T02:22:00Z',
  };
  let failUpload = true,
    conflict = false,
    uploads = 0,
    patches = 0;
  let bytes: Buffer = Buffer.alloc(0);
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/me/avatar')) {
      uploads++;
      bytes = route.request().postDataBuffer()!;
      expect(route.request().headers()['content-type']).toBe('image/jpeg');
      expect([...bytes.subarray(0, 3)]).toEqual([255, 216, 255]);
      return route.fulfill(
        failUpload
          ? {
              status: 502,
              json: {
                ok: false,
                error: {
                  code: 'AVATAR_UPLOAD_FAILED',
                  message: 'Chưa tải được ảnh.',
                },
              },
            }
          : { json: { ok: true, data: { avatarUrl } } },
      );
    }
    if (path.endsWith('/me/profile') && route.request().method() === 'PATCH') {
      patches++;
      if (conflict)
        return route.fulfill({
          status: 409,
          json: {
            ok: false,
            error: {
              code: 'PROFILE_CONFLICT',
              message: 'Hồ sơ đã thay đổi ở nơi khác.',
            },
          },
        });
      const body = route.request().postDataJSON();
      profile = {
        ...profile,
        user: {
          ...profile.user,
          avatarUrl: body.avatarUrl,
          displayName: body.displayName,
        },
        revision: profile.revision + 1,
      };
    }
    return route.fulfill({
      json: {
        ok: true,
        data: path.endsWith('/auth/me')
          ? { user: profile.user }
          : path.endsWith('/me/profile')
            ? profile
            : { items: [] },
      },
    });
  });
  await page.route(avatarUrl, (route) =>
    route.fulfill({ contentType: 'image/jpeg', body: bytes }),
  );
  await page.goto('/account');
  await expect(
    page.getByRole('heading', { name: 'Trung tâm cá nhân' }),
  ).toBeVisible();
  await expect(page.getByLabel('Ngày tham gia', { exact: true })).toHaveValue(
    /20\/10\/2026/,
  );
  await expect(
    page.getByLabel('Email (cố định)', { exact: true }),
  ).toHaveAttribute('readonly', '');
  await expect(page.locator('input[type=url]')).toHaveCount(0);
  const file = page.getByLabel('Chọn ảnh đại diện từ máy');
  await file.setInputFiles({
    name: 'bad.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from('<svg/>'),
  });
  await expect(page.getByRole('alert')).toContainText('Chọn ảnh JPG');
  const source = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 600;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#d79d5f';
    ctx.fillRect(0, 0, 450, 600);
    ctx.fillStyle = '#246653';
    ctx.fillRect(450, 0, 450, 600);
    return canvas.toDataURL().split(',')[1]!;
  });
  await file.setInputFiles({
    name: 'fixture.png',
    mimeType: 'image/png',
    buffer: Buffer.from(source, 'base64'),
  });
  const crop = page.getByRole('dialog', { name: 'Căn chỉnh ảnh đại diện' });
  await expect(crop).toBeVisible();
  const canvas = crop.locator('canvas');
  const before = await canvas.evaluate((el: HTMLCanvasElement) =>
    el.toDataURL(),
  );
  await crop.getByLabel('Phóng to', { exact: true }).fill('1.7');
  await crop.getByLabel('Căn ngang', { exact: true }).fill('0.6');
  const rect = (await canvas.boundingBox())!;
  await page.mouse.move(rect.x + 100, rect.y + 100);
  await page.mouse.down();
  await page.mouse.move(rect.x + 140, rect.y + 120, { steps: 5 });
  await page.mouse.up();
  await expect
    .poll(() => canvas.evaluate((el: HTMLCanvasElement) => el.toDataURL()))
    .not.toBe(before);
  await crop.getByRole('button', { name: 'Dùng ảnh này' }).click();
  const preview = page.locator('.avatar-picker-image img');
  await expect(preview).toHaveAttribute('src', /^blob:/);
  const save = page.getByRole('button', { name: 'Lưu hồ sơ', exact: true });
  await save.click();
  await expect(page.getByRole('alert')).toContainText('Chưa tải được ảnh');
  expect(patches).toBe(0);
  failUpload = false;
  conflict = true;
  await save.click();
  await expect(page.getByRole('alert')).toContainText('đã thay đổi');
  expect(uploads).toBe(2);
  conflict = false;
  await save.click();
  await expect(page.getByText('Đã lưu hồ sơ.', { exact: true })).toBeVisible();
  expect(uploads).toBe(2);
  await page.reload();
  await expect(preview).toHaveAttribute('src', avatarUrl);
  const password = page.getByLabel('Mật khẩu hiện tại', { exact: true });
  await password.fill('Fixture-password');
  await page
    .getByRole('button', { name: 'Hiện mật khẩu hiện tại', exact: true })
    .click();
  await expect(password).toHaveAttribute('type', 'text');
  await page
    .getByRole('button', { name: 'Ẩn mật khẩu hiện tại', exact: true })
    .click();
  await expect(password).toHaveAttribute('type', 'password');
  await password.fill('');
  for (const width of [320, 460, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page
    .getByRole('button', { name: 'Dùng ảnh mặc định', exact: true })
    .click();
  await save.click();
  await expect(page.getByText('Đã lưu hồ sơ.', { exact: true })).toBeVisible();
  expect(profile.user.avatarUrl).toBe(null);
});
