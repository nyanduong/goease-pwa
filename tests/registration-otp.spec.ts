import { expect, test } from '@playwright/test';

for (const width of [320, 390]) {
  test(`mock OTP registration at ${width}px: retry, resend, success and private input stays out of storage`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    await page.clock.install();
    let requests = 0,
      verified = false;
    const user = {
      id: '507f1f77bcf86cd799439011',
      displayName: 'Bạn thử nghiệm',
      email: 'otp@example.invalid',
      emailVerified: true,
      avatarUrl: null,
      isAdmin: false,
    };
    await page.route('**/api/v1/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/auth/register')) {
        requests++;
        expect(route.request().postDataJSON()).toEqual({
          email: user.email,
          password: 'Private-password-2026',
          displayName: user.displayName,
        });
        return route.fulfill({
          status: 202,
          json: {
            ok: true,
            data: {
              verificationRequired: true,
              challenge: (requests === 1 ? 'A' : 'B').repeat(43),
              expiresAt: new Date(Date.now() + 600000).toISOString(),
              retryAfterSeconds: 60,
            },
          },
        });
      }
      if (path.endsWith('/auth/registration/verify')) {
        const body = route.request().postDataJSON();
        expect(body.challenge).toBe('B'.repeat(43));
        if (body.code !== '123456')
          return route.fulfill({
            status: 400,
            json: {
              ok: false,
              error: {
                code: 'REGISTRATION_CODE_INVALID',
                message: 'Mã không đúng hoặc đã hết hạn.',
              },
            },
          });
        verified = true;
        return route.fulfill({
          status: 201,
          json: { ok: true, data: { user } },
        });
      }
      return route.fulfill({
        json: {
          ok: true,
          data: path.endsWith('/auth/me')
            ? { user: verified ? user : null }
            : path.endsWith('/auth/options')
              ? { registrationOtpRequired: true, google: false }
              : { items: [] },
        },
      });
    });
    await page.goto('/register');
    await page.getByLabel('Tên của bạn').fill(user.displayName);
    await page.getByLabel('Email', { exact: true }).fill(user.email);
    await page
      .getByLabel('Mật khẩu', { exact: true })
      .fill('Private-password-2026');
    await page.getByRole('button', { name: 'Tạo tài khoản' }).click();
    await expect(
      page.getByRole('heading', { name: 'Xác nhận email' }),
    ).toBeVisible();
    const code = page.getByLabel('Mã xác nhận email');
    await expect(code).toBeFocused();
    await expect(
      page.getByRole('button', { name: /Gửi lại sau/ }),
    ).toBeDisabled();
    await page.clock.fastForward(61000);
    await page.getByRole('button', { name: 'Gửi mã mới' }).click();
    await expect.poll(() => requests).toBe(2);
    await code.fill('000000');
    await page
      .getByRole('button', { name: 'Xác nhận & tạo tài khoản' })
      .click();
    await expect(page.getByRole('alert')).toContainText('Mã không đúng');
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    const stored = await page.evaluate(() =>
      JSON.stringify({
        local: { ...localStorage },
        session: { ...sessionStorage },
      }),
    );
    expect(stored).not.toContain('Private-password-2026');
    expect(stored).not.toContain('B'.repeat(43));
    await page.screenshot({
      path: testInfo.outputPath(`otp-${width}.png`),
      fullPage: true,
    });
    await code.fill('123456');
    await page
      .getByRole('button', { name: 'Xác nhận & tạo tài khoản' })
      .click();
    await expect(page).toHaveURL(/\/$/);
    expect(verified).toBe(true);
  });
}

test('mock unavailable SMTP keeps registration data and does not show fake OTP success', async ({
  page,
}) => {
  await page.route('**/api/v1/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill(
      path.endsWith('/auth/register')
        ? {
            status: 503,
            json: {
              ok: false,
              error: {
                code: 'REGISTRATION_EMAIL_UNAVAILABLE',
                message: 'Gửi email đăng ký chưa được cấu hình.',
              },
            },
          }
        : {
            json: {
              ok: true,
              data: path.endsWith('/auth/me') ? { user: null } : { items: [] },
            },
          },
    );
  });
  await page.goto('/register');
  await page.getByLabel('Tên của bạn').fill('Thử SMTP');
  await page.getByLabel('Email', { exact: true }).fill('smtp@example.invalid');
  await page
    .getByLabel('Mật khẩu', { exact: true })
    .fill('Private-password-2026');
  await page.getByRole('button', { name: 'Tạo tài khoản' }).click();
  await expect(page.getByRole('alert')).toContainText('chưa được cấu hình');
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue(
    'smtp@example.invalid',
  );
  await expect(page.getByLabel('Mã xác nhận email')).toHaveCount(0);
});
