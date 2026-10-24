import { randomInt, timingSafeEqual } from 'node:crypto';
import { hash } from '@node-rs/argon2';
import type { Connection } from 'mongoose';
import type { Request } from 'express';
import type {
  RegistrationOtpInput,
  RegistrationPending,
} from '@goease/contracts';
import type { Config } from '../../config.js';
import { HttpError } from '../../http-error.js';
import type { Logger } from '../../observability/logger.js';
import { argonOptions, requestId, type authService } from './auth.service.js';
import { authLimiter, opaqueToken, tokenHash } from './security.js';
import type { RegistrationEmailSender } from './registration-email.js';

const ttlMs = 10 * 60 * 1000,
  cooldownMs = 60 * 1000,
  maxAttempts = 5;
const invalid = () =>
  new HttpError(
    400,
    'REGISTRATION_CODE_INVALID',
    'Mã không đúng, đã hết hạn hoặc đã dùng. Kiểm tra mã mới nhất hoặc đăng ký lại.',
  );
export function emailRegistration(
  connection: Connection,
  config: Config,
  auth: ReturnType<typeof authService>,
  sender: RegistrationEmailSender,
  logger: Logger,
) {
  const { Challenge, User } = auth.models;
  const requestLimit = authLimiter(
    config.AUTH_MAX_ATTEMPTS,
    config.AUTH_WINDOW_SECONDS,
  );
  const verifyLimit = authLimiter(30, 900);
  let active = 0;
  return {
    async request(
      req: Request,
      value: { email: string; password: string; displayName: string },
    ): Promise<RegistrationPending> {
      requestLimit(req, value.email);
      if (!sender.configured)
        throw new HttpError(
          503,
          'REGISTRATION_EMAIL_UNAVAILABLE',
          'Gửi email đăng ký chưa được cấu hình. Vui lòng thử lại sau.',
        );
      if (active >= 20)
        throw new HttpError(
          503,
          'REGISTRATION_BUSY',
          'Hệ thống đang bận. Hãy thử lại sau.',
        );
      active++;
      let issued: { id: string; key: string } | null = null;
      try {
        if (await User.exists({ emailNormalized: value.email }))
          throw new HttpError(
            409,
            'EMAIL_UNAVAILABLE',
            'Email này đã được sử dụng. Hãy đăng nhập hoặc đặt lại mật khẩu.',
          );
        const challenge = opaqueToken(),
          key = tokenHash(challenge);
        const code = String(randomInt(0, 1000000)).padStart(6, '0');
        const passwordHash = await hash(value.password, argonOptions);
        const now = new Date(),
          expiresAt = new Date(now.getTime() + ttlMs);
        let slot;
        try {
          slot = await Challenge.findOneAndUpdate(
            {
              purpose: 'verify_email',
              targetEmailNormalized: value.email,
              'context.registrationFlow': true,
              'context.registrationRequestedAt': {
                $lte: new Date(now.getTime() - cooldownMs),
              },
            },
            {
              $set: {
                tokenHash: key,
                targetEmailNormalized: value.email,
                purpose: 'verify_email',
                expiresAt,
                consumedAt: null,
                revokedAt: null,
                attemptCount: 0,
                maxAttempts,
                requestId: requestId(),
                context: {
                  registrationFlow: true,
                  registrationRequestedAt: now,
                  deliveryState: 'pending',
                  registrationOtpHash: tokenHash(`${challenge}:${code}`),
                  registrationPasswordHash: passwordHash,
                  registrationDisplayName: value.displayName,
                },
              },
            },
            { upsert: true, returnDocument: 'after', runValidators: true },
          );
        } catch (e) {
          if ((e as { code?: number }).code === 11000)
            throw new HttpError(
              429,
              'REGISTRATION_COOLDOWN',
              'Vui lòng chờ 60 giây trước khi yêu cầu mã mới.',
            );
          throw e;
        }
        if (!slot) throw new Error('Registration slot missing');
        issued = { id: String(slot._id), key };
        // SMTP is outside every transaction: transaction retries cannot resend email.
        await sender.send({ to: value.email, code, minutes: ttlMs / 60000 });
        const sent = await Challenge.updateOne(
          {
            _id: slot._id,
            tokenHash: key,
            consumedAt: null,
            revokedAt: null,
            expiresAt: { $gt: new Date() },
            'context.deliveryState': 'pending',
          },
          { $set: { 'context.deliveryState': 'sent' } },
        );
        if (sent.modifiedCount !== 1)
          throw new Error('Registration superseded');
        logger.write('email.registration_accepted');
        return {
          verificationRequired: true,
          challenge,
          expiresAt: expiresAt.toISOString(),
          retryAfterSeconds: cooldownMs / 1000,
        };
      } catch (e) {
        if (issued) {
          logger.write('email.registration_failed');
          await Challenge.updateOne(
            { _id: issued.id, tokenHash: issued.key, consumedAt: null },
            {
              $set: {
                revokedAt: new Date(),
                'context.deliveryState': 'failed',
              },
              $unset: {
                'context.registrationPasswordHash': '',
                'context.registrationOtpHash': '',
                'context.registrationDisplayName': '',
              },
            },
          ).catch(() => {});
          throw new HttpError(
            503,
            'REGISTRATION_EMAIL_FAILED',
            'Chưa gửi được mã xác nhận. Hãy thử lại sau.',
          );
        }
        throw e;
      } finally {
        active--;
      }
    },
    async verify(req: Request, value: RegistrationOtpInput) {
      verifyLimit(req, tokenHash(value.challenge));
      const key = tokenHash(value.challenge),
        now = new Date();
      // Count attempts atomically before checking a code; concurrent guesses share the same cap.
      const attempted = await Challenge.findOneAndUpdate(
        {
          tokenHash: key,
          purpose: 'verify_email',
          'context.registrationFlow': true,
          'context.deliveryState': 'sent',
          consumedAt: null,
          revokedAt: null,
          expiresAt: { $gt: now },
          attemptCount: { $lt: maxAttempts },
        },
        { $inc: { attemptCount: 1 } },
        { returnDocument: 'after' },
      ).select('+context.registrationOtpHash');
      const expected = attempted?.context.registrationOtpHash;
      const actual = tokenHash(`${value.challenge}:${value.code}`);
      if (
        !expected ||
        expected.length !== 64 ||
        !timingSafeEqual(
          Buffer.from(expected, 'hex'),
          Buffer.from(actual, 'hex'),
        )
      )
        throw invalid();
      try {
        return await connection.transaction(async (session) => {
          const consumed = await Challenge.findOneAndUpdate(
            {
              _id: attempted!._id,
              tokenHash: key,
              'context.deliveryState': 'sent',
              consumedAt: null,
              revokedAt: null,
              expiresAt: { $gt: new Date() },
              attemptCount: { $lte: maxAttempts },
            },
            { $set: { consumedAt: new Date() } },
            { returnDocument: 'after', session },
          ).select(
            '+targetEmailNormalized +context.registrationPasswordHash +context.registrationDisplayName',
          );
          if (
            !consumed?.targetEmailNormalized ||
            !consumed.context.registrationPasswordHash ||
            !consumed.context.registrationDisplayName
          )
            throw invalid();
          const result = await auth.registerVerified(
            {
              email: consumed.targetEmailNormalized,
              passwordHash: consumed.context.registrationPasswordHash,
              displayName: consumed.context.registrationDisplayName,
            },
            session,
          );
          await Challenge.updateOne(
            { _id: consumed._id },
            {
              $unset: {
                'context.registrationPasswordHash': '',
                'context.registrationOtpHash': '',
                'context.registrationDisplayName': '',
              },
            },
            { session },
          );
          return result;
        });
      } catch (e) {
        if ((e as { code?: number }).code === 11000)
          throw new HttpError(
            409,
            'EMAIL_UNAVAILABLE',
            'Email này đã được sử dụng. Hãy đăng nhập hoặc đặt lại mật khẩu.',
          );
        throw e;
      }
    },
  };
}
