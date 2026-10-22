import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import nodemailer from 'nodemailer';
import { forgotPasswordSchema, resetPasswordSchema } from '@goease/contracts';
import { parseConfig } from '../src/config.js';
import { resetEmailSender } from '../src/features/auth/reset-email.js';
import { authLimiter } from '../src/features/auth/security.js';
import type { Request } from 'express';

test('recovery strict input and independent abuse limiter', () => {
  assert.equal(
    forgotPasswordSchema.parse({ email: 'TEST@example.com' }).email,
    'test@example.com',
  );
  assert.equal(
    forgotPasswordSchema.safeParse({
      email: 'test@example.com',
      returnTo: 'https://evil.invalid',
    }).success,
    false,
  );
  assert.equal(
    resetPasswordSchema.safeParse({
      token: 'a'.repeat(43),
      newPassword: 'Long-password-2026',
    }).success,
    true,
  );
  assert.equal(
    resetPasswordSchema.safeParse({
      token: 'short',
      newPassword: 'Long-password-2026',
    }).success,
    false,
  );
  assert.equal(
    resetPasswordSchema.safeParse({
      token: 'a'.repeat(43),
      newPassword: 'short',
    }).success,
    false,
  );
  const limit = authLimiter(2, 60),
    req = { socket: { remoteAddress: '127.0.0.1' } } as Request;
  limit(req, 'a');
  limit(req, 'b');
  assert.throws(() => limit(req, 'c'), /quá nhiều/);
});

test('SMTP adapter config requires TLS, fixed content, one recipient and sanitizes rejection', async () => {
  const env = {
    CLIENT_ORIGIN: 'http://localhost:5180',
    MONGODB_URI: 'mongodb://127.0.0.1:27019/goease',
    SMTP_HOST: 'smtp.example.invalid',
    SMTP_USER: 'sender@example.invalid',
    SMTP_PASS: 'PRIVATE_SMTP_SECRET',
    MAIL_FROM: 'sender@example.invalid',
  };
  const config = parseConfig(env);
  assert.equal(
    resetEmailSender(parseConfig({ ...env, SMTP_HOST: '' })).configured,
    false,
  );
  assert.throws(() => parseConfig({ ...env, NODE_ENV: 'production' }), /HTTPS/);
  let options: unknown,
    message: unknown,
    reject = false;
  const mocked = mock.method(
    nodemailer,
    'createTransport',
    (value: unknown) => {
      options = value;
      return {
        sendMail: async (mail: unknown) => {
          message = mail;
          if (reject) throw new Error('PRIVATE_SMTP_SECRET');
          return { accepted: ['receiver@example.invalid'], rejected: [] };
        },
      } as unknown as ReturnType<typeof nodemailer.createTransport>;
    },
  );
  try {
    const sender = resetEmailSender(config);
    await sender.send({
      to: 'receiver@example.invalid',
      url: 'http://localhost:5180/reset-password#fixture-token',
      minutes: 15,
    });
    assert.equal((options as { secure: boolean }).secure, true);
    assert.equal((options as { debug: boolean }).debug, false);
    assert.deepEqual((message as { to: unknown }).to, [
      { address: 'receiver@example.invalid', name: '' },
    ]);
    assert.ok((message as { text: string }).text.includes('15 phút'));
    resetEmailSender({ ...config, SMTP_PORT: 587 });
    assert.equal((options as { requireTLS: boolean }).requireTLS, true);
    assert.deepEqual((options as { tls: unknown }).tls, {
      minVersion: 'TLSv1.2',
      rejectUnauthorized: true,
    });
    reject = true;
    await assert.rejects(
      sender.send({
        to: 'receiver@example.invalid',
        url: 'https://example.invalid/reset-password#fixture',
        minutes: 15,
      }),
      /^Error: RESET_EMAIL_DELIVERY_FAILED$/,
    );
  } finally {
    mocked.mock.restore();
  }
});
