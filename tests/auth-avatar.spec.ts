import { images } from '@goease/media';
import { test, expect } from '@playwright/test';

// Mocked auth responses isolate browser routing/avatar presentation from provider setup.
for (const avatar of ['missing', 'account', 'broken'] as const) {
  test(`mocked login opens Home with ${avatar} avatar`, async ({ page }) => {
    const avatarUrl =
      avatar === 'missing'
        ? null
        : `https://avatar.example.invalid/${avatar}.png`;
    const user = {
      id: '507f1f77bcf86cd799439011',
      displayName: 'Bạn du lịch',
      email: 'traveler@example.invalid',
      emailVerified: false,
      avatarUrl,
    };
    let signedIn = false;
    await page.route('**/api/v1/auth/me', (r) =>
      r.fulfill({ json: { ok: true, data: { user: signedIn ? user : null } } }),
    );
    await page.route('**/api/v1/auth/login', (r) => {
      signedIn = true;
      return r.fulfill({ json: { ok: true, data: { user } } });
    });
    await page.route('**/api/v1/destinations', (r) =>
      r.fulfill({ json: { ok: true, data: { items: [] } } }),
    );
    await page.route('**/api/v1/trips', (r) =>
      r.fulfill({ json: { ok: true, data: { items: [] } } }),
    );
    await page.route('https://avatar.example.invalid/**', (r) =>
      avatar === 'broken'
        ? r.abort()
        : r.fulfill({
            contentType: 'image/svg+xml',
            body: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="green"/></svg>',
          }),
    );
    // This is a mocked routing/avatar test. CDN availability is verified separately.
    await page.route(images.defaultAvatar, (r) =>
      r.fulfill({
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><circle cx="20" cy="20" r="20" fill="teal"/></svg>',
      }),
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(
      avatar === 'missing' ? '/login?next=https://example.invalid' : '/login',
    );
    await page.getByLabel('Email', { exact: true }).fill(user.email);
    await page
      .getByLabel('Mật khẩu', { exact: true })
      .fill('Mocked-login-password-2026');
    await page.getByRole('button', { name: 'Đăng nhập', exact: false }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByRole('heading', { name: 'Hôm nay, mình đi đâu?' }),
    ).toBeVisible();
    const image = page.getByRole('img', {
      name: `Ảnh đại diện của ${user.displayName}`,
    });
    await expect(image).toHaveAttribute(
      'src',
      avatar === 'account' ? avatarUrl! : images.defaultAvatar,
    );
    await expect
      .poll(() =>
        image.evaluate(
          (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
        ),
      )
      .toBe(true);
    await page.reload();
    await expect(page).toHaveURL(/\/$/);
    await expect(image).toHaveAttribute(
      'src',
      avatar === 'account' ? avatarUrl! : images.defaultAvatar,
    );
  });
}
