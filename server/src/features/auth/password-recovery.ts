import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { hash } from '@node-rs/argon2';
import type { Connection } from 'mongoose';
import type { Request } from 'express';
import { resetRequestMessage } from '@goease/contracts';
import type { Config } from '../../config.js';
import { HttpError } from '../../http-error.js';
import type { Logger } from '../../observability/logger.js';
import { argonOptions, requestId, type authService } from './auth.service.js';
import { authLimiter, opaqueToken, tokenHash } from './security.js';
import type { businessAudit } from '../audit/business-audit.js';
import type { ResetEmailSender } from './reset-email.js';

export function passwordRecovery(
  connection: Connection,
  config: Config,
  auth: ReturnType<typeof authService>,
  audit: ReturnType<typeof businessAudit>,
  sender: ResetEmailSender,
  logger: Logger,
) {
  const { User, Identity, Session, Challenge } = auth.models;
  const requestLimit = authLimiter(
    config.AUTH_MAX_ATTEMPTS,
    config.AUTH_WINDOW_SECONDS,
  );
  const consumeLimit = authLimiter(
    config.AUTH_MAX_ATTEMPTS,
    config.AUTH_WINDOW_SECONDS,
  );
  const tasks = new Set<Promise<void>>();
  let accepting = true;
  let requests = 0;
  const invalid = () =>
    new HttpError(
      400,
      'RESET_LINK_INVALID',
      'Link không hợp lệ, đã dùng hoặc đã hết hạn. Nếu lần đổi trước bị mất kết nối, hãy thử đăng nhập bằng mật khẩu mới; hoặc yêu cầu link khác.',
    );
  async function deliver(id: string, email: string, token: string) {
    try {
      await sender.send({
        to: email,
        url: `${config.CLIENT_ORIGIN}/reset-password#${token}`,
        minutes: config.RESET_TOKEN_TTL_SECONDS / 60,
      });
      await Challenge.updateOne(
        {
          _id: id,
          revokedAt: null,
          consumedAt: null,
          expiresAt: { $gt: new Date() },
        },
        { $set: { 'context.deliveryState': 'sent' } },
      );
      logger.write('email.reset_accepted');
    } catch {
      logger.write('email.reset_failed');
      try {
        await Challenge.updateOne(
          { _id: id, consumedAt: null },
          {
            $set: { revokedAt: new Date(), 'context.deliveryState': 'failed' },
          },
        );
      } catch {
        logger.write('email.reset_cleanup_failed');
      }
    }
  }
  return {
    async drain() {
      accepting = false;
      await Promise.allSettled([...tasks]);
    },
    async waitForDeliveries() {
      await Promise.allSettled([...tasks]);
    },
    async request(req: Request, email: string) {
      requestLimit(req, email);
      if (!sender.configured)
        throw new HttpError(
          503,
          'RESET_EMAIL_UNAVAILABLE',
          'Gửi email chưa được cấu hình. Vui lòng thử lại sau.',
        );
      if (!accepting || requests + tasks.size >= 20)
        throw new HttpError(
          503,
          'RESET_BUSY',
          'Hệ thống đang bận. Vui lòng thử lại sau.',
        );
      requests++;
      try {
        const start = Date.now();
        const token = opaqueToken(),
          reqId = requestId();
        // No SMTP in a retriable transaction. Only hashes and delivery metadata are persisted.
        const issued = await connection.transaction(async (tx) => {
          const identity = await Identity.findOne({
            provider: 'password',
            loginEmailNormalized: email,
            unlinkedAt: null,
          })
            .select('+passwordHash')
            .session(tx);
          if (!identity?.passwordHash) return null;
          const user = await User.findOne({
            _id: identity.userId,
            emailNormalized: email,
            status: 'active',
            deletedAt: null,
          }).session(tx);
          if (!user) return null;
          const recent = await Challenge.exists({
            userId: user._id,
            purpose: 'reset_password',
            createdAt: { $gt: new Date(Date.now() - 60000) },
          }).session(tx);
          if (recent) return null;
          // Serialize requests with each other and password mutations without changing profile revision.
          await User.updateOne(
            { _id: user._id, securityVersion: user.securityVersion },
            { $inc: { recoverySequence: 1 } },
            { session: tx, timestamps: false },
          );
          await Challenge.updateMany(
            {
              userId: user._id,
              purpose: 'reset_password',
              consumedAt: null,
              revokedAt: null,
            },
            { $set: { revokedAt: new Date() } },
            { session: tx },
          );
          const challenge = await new Challenge({
            userId: user._id,
            purpose: 'reset_password',
            tokenHash: tokenHash(token),
            context: {
              identityId: identity._id,
              securityVersionAtIssue: user.securityVersion,
              deliveryState: 'pending',
            },
            expiresAt: new Date(
              Date.now() + config.RESET_TOKEN_TTL_SECONDS * 1000,
            ),
            requestId: reqId,
          }).save({ session: tx });
          return { id: String(challenge._id) };
        });
        if (issued) {
          const task = deliver(issued.id, email, token);
          tasks.add(task);
          void task.finally(() => tasks.delete(task));
        }
        // Equal response envelope and a timing floor; delivery latency never gates the HTTP response.
        await delay(Math.max(0, 400 - (Date.now() - start)));
        return { accepted: true, message: resetRequestMessage };
      } finally {
        requests--;
      }
    },
    async reset(req: Request, value: { token: string; newPassword: string }) {
      consumeLimit(req, tokenHash(value.token));
      const lookup = {
        purpose: 'reset_password',
        tokenHash: tokenHash(value.token),
        revokedAt: null,
        consumedAt: null,
        expiresAt: { $gt: new Date() },
        'context.deliveryState': 'sent',
      } as const;
      // Avoid expensive hashing for arbitrary invalid tokens; never disclose an account.
      if (!(await Challenge.exists(lookup))) throw invalid();
      const passwordHash = await hash(value.newPassword, argonOptions);
      const reqId = requestId(),
        operationId = randomUUID();
      return connection.transaction(async (tx) => {
        const now = new Date();
        const challenge = await Challenge.findOneAndUpdate(
          { ...lookup, expiresAt: { $gt: now }, attemptCount: { $lt: 1 } },
          { $set: { consumedAt: now }, $inc: { attemptCount: 1 } },
          { session: tx },
        );
        if (
          !challenge?.userId ||
          !challenge.context.identityId ||
          challenge.context.securityVersionAtIssue === undefined
        )
          throw invalid();
        const user = await User.findOne({
          _id: challenge.userId,
          status: 'active',
          deletedAt: null,
          securityVersion: challenge.context.securityVersionAtIssue,
        }).session(tx);
        const identity = await Identity.findOne({
          _id: challenge.context.identityId,
          userId: challenge.userId,
          provider: 'password',
          unlinkedAt: null,
        })
          .select('+passwordHash')
          .session(tx);
        if (
          !user ||
          !identity?.passwordHash ||
          identity.loginEmailNormalized !== user.emailNormalized
        )
          throw invalid();
        identity.passwordHash = passwordHash;
        identity.passwordChangedAt = now;
        await identity.save({ session: tx });
        user.securityVersion++;
        await user.save({ session: tx });
        await Session.updateMany(
          { userId: user._id, revokedAt: null },
          { $set: { revokedAt: now, revocationReason: 'password_reset' } },
          { session: tx },
        );
        await Challenge.updateMany(
          {
            userId: user._id,
            purpose: 'reset_password',
            _id: { $ne: challenge._id },
            revokedAt: null,
            consumedAt: null,
          },
          { $set: { revokedAt: now } },
          { session: tx },
        );
        await audit.append(
          {
            action: 'password.reset',
            actorUserId: String(user._id),
            entityId: String(user._id),
            requestId: reqId,
            operationId,
          },
          tx,
        );
        return { changed: true };
      });
    },
  };
}
