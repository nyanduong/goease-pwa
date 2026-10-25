import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import nodemailer from 'nodemailer';
import { registrationOtpSchema } from '@goease/contracts';
import { parseConfig } from '../src/config.js';
import { registrationEmailSender } from '../src/features/auth/registration-email.js';

const env = {
  CLIENT_ORIGIN: 'http://localhost:5180',
  MONGODB_URI: 'mongodb://localhost:27017/goease',
};
test('registration rollout is explicit and parses false correctly', () => {
  assert.equal(parseConfig(env).REGISTRATION_OTP_REQUIRED, false);
  assert.equal(
    parseConfig({ ...env, REGISTRATION_OTP_REQUIRED: 'false' })
      .REGISTRATION_OTP_REQUIRED,
    false,
  );
  assert.equal(
    parseConfig({ ...env, REGISTRATION_OTP_REQUIRED: 'true' })
      .REGISTRATION_OTP_REQUIRED,
    true,
  );
  assert.throws(
    () => parseConfig({ ...env, REGISTRATION_OTP_REQUIRED: 'yes' }),
    /REGISTRATION_OTP_REQUIRED/,
  );
});
test('registration accepts exact six digits and a browser binding only', () => {
  const value = { challenge: 'A'.repeat(43), code: '012345' };
  assert.equal(registrationOtpSchema.safeParse(value).success, true);
  for (const code of [
    '12345',
    '1234567',
    '12345x',
    '12345\n',
    '１２３４５６',
  ]) {
    assert.equal(
      registrationOtpSchema.safeParse({ ...value, code }).success,
      false,
    );
  }
  assert.equal(
    registrationOtpSchema.safeParse({ ...value, emailVerified: true }).success,
    false,
  );
  assert.equal(
    registrationOtpSchema.safeParse({
      ...value,
      challenge: 'A'.repeat(42) + '\n',
    }).success,
    false,
  );
});
test('registration email cannot report success when SMTP is missing', async () => {
  const sender = registrationEmailSender(parseConfig(env));
  assert.equal(sender.configured, false);
  await assert.rejects(
    sender.send({ to: 'test@example.invalid', code: '123456', minutes: 10 }),
    /REGISTRATION_EMAIL_UNAVAILABLE/,
  );
});

test('OTP SMTP requires TLS and rejects delivery errors without leaking credentials', async () => {
  let options: unknown,
    message: unknown,
    fail = false,
    reject = false;
  const mocked = mock.method(
    nodemailer,
    'createTransport',
    (value: unknown) => {
      options = value;
      return {
        sendMail: async (mail: unknown) => {
          message = mail;
          if (fail) throw new Error('PRIVATE_SMTP_PASSWORD');
          return {
            accepted: reject ? [] : ['otp@example.invalid'],
            rejected: reject ? ['otp@example.invalid'] : [],
          };
        },
      } as unknown as ReturnType<typeof nodemailer.createTransport>;
    },
  );
  try {
    const config = parseConfig({
      ...env,
      SMTP_HOST: 'smtp.example.invalid',
      SMTP_USER: 'sender@example.invalid',
      SMTP_PASS: 'PRIVATE_SMTP_PASSWORD',
      MAIL_FROM: 'sender@example.invalid',
    });
    const sender = registrationEmailSender(config),
      value = { to: 'otp@example.invalid', code: '012345', minutes: 10 };
    await sender.send(value);
    assert.equal((options as { secure: boolean }).secure, true);
    assert.equal((options as { debug: boolean }).debug, false);
    assert.equal(
      (options as { disableUrlAccess: boolean }).disableUrlAccess,
      true,
    );
    assert.deepEqual((message as { to: unknown }).to, [
      { address: value.to, name: '' },
    ]);
    assert.match((message as { text: string }).text, /012345/);
    assert.match((message as { text: string }).text, /10 phút/);
    registrationEmailSender({ ...config, SMTP_PORT: 587 });
    assert.equal((options as { requireTLS: boolean }).requireTLS, true);
    assert.deepEqual((options as { tls: unknown }).tls, {
      minVersion: 'TLSv1.2',
      rejectUnauthorized: true,
    });
    fail = true;
    await assert.rejects(
      sender.send(value),
      /^Error: REGISTRATION_EMAIL_DELIVERY_FAILED$/,
    );
    fail = false;
    reject = true;
    await assert.rejects(
      sender.send(value),
      /^Error: REGISTRATION_EMAIL_DELIVERY_FAILED$/,
    );
  } finally {
    mocked.mock.restore();
  }
});
