import { randomUUID } from 'node:crypto';
import { hash, verify, Algorithm } from '@node-rs/argon2';
import { Types, type ClientSession, type Connection } from 'mongoose';
import type { Request, Response } from 'express';
import type { UserDto } from '@goease/contracts';
import type { Config } from '../../config.js';
import { HttpError } from '../../http-error.js';
import { getRequestContext } from '../../observability/context.js';
import { authModels, type UserRecord } from './auth.models.js';
import { authLimiter, cookie, opaqueToken, tokenHash } from './security.js';
import type { businessAudit } from '../audit/business-audit.js';

export const userDto = (user: UserRecord): UserDto => ({
  id: user._id.toHexString(),
  displayName: user.displayName,
  email: user.emailNormalized,
  emailVerified: Boolean(user.emailVerifiedAt),
});
export const requestId = () => getRequestContext()?.requestId ?? randomUUID();
const argonOptions = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
};
export function authService(
  connection: Connection,
  config: Config,
  audit: ReturnType<typeof businessAudit>,
) {
  const models = authModels(connection);
  const { User, Identity, Session } = models;
  const limit = authLimiter(
    config.AUTH_MAX_ATTEMPTS,
    config.AUTH_WINDOW_SECONDS,
  );
  const dummyHash = hash(opaqueToken(), argonOptions);
  const cookieOptions = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: config.NODE_ENV === 'production',
    path: '/api/v1',
  };
  async function authenticate(req: Request) {
    const token = cookie(req, 'goease_session');
    if (!token) return null;
    const now = new Date();
    const session = await Session.findOne({
      sessionTokenHash: tokenHash(token),
      revokedAt: null,
      expiresAt: { $gt: now },
      idleExpiresAt: { $gt: now },
    });
    if (!session) return null;
    const user = await User.findOne({
      _id: session.userId,
      status: 'active',
      deletedAt: null,
      securityVersion: session.securityVersionAtIssue,
    });
    const identity = await Identity.findOne({
      _id: session.identityId,
      userId: session.userId,
      unlinkedAt: null,
    });
    if (!user || !identity) return null;
    if (Date.now() - session.lastSeenAt.getTime() > 60000)
      await Session.updateOne(
        {
          _id: session._id,
          revokedAt: null,
          expiresAt: { $gt: now },
          idleExpiresAt: { $gt: now },
        },
        {
          $set: {
            lastSeenAt: now,
            idleExpiresAt: new Date(
              Math.min(
                session.expiresAt.getTime(),
                Date.now() + config.SESSION_IDLE_SECONDS * 1000,
              ),
            ),
          },
        },
      );
    return { user, session };
  }
  async function createSession(
    user: UserRecord,
    identityId: Types.ObjectId,
    session: ClientSession,
    reqId: string,
    operationId: string,
  ) {
    const now = new Date();
    const token = opaqueToken();
    const value = await new Session({
      userId: user._id,
      identityId,
      sessionTokenHash: tokenHash(token),
      securityVersionAtIssue: user.securityVersion,
      issuedAt: now,
      lastSeenAt: now,
      expiresAt: new Date(Date.now() + config.SESSION_TTL_SECONDS * 1000),
      idleExpiresAt: new Date(
        Date.now() +
          Math.min(config.SESSION_IDLE_SECONDS, config.SESSION_TTL_SECONDS) *
            1000,
      ),
    }).save({ session });
    await audit.append(
      {
        action: 'session.created',
        actorUserId: user._id.toHexString(),
        entityId: value._id.toHexString(),
        requestId: reqId,
        operationId,
      },
      session,
    );
    return token;
  }
  return {
    models,
    authenticate,
    createSession,
    limitChallenge(req: Request) {
      limit(req, 'challenge');
    },
    setCookie(res: Response, token: string) {
      res.cookie('goease_session', token, {
        ...cookieOptions,
        maxAge: config.SESSION_TTL_SECONDS * 1000,
      });
    },
    async register(
      req: Request,
      value: { email: string; password: string; displayName: string },
    ) {
      limit(req, value.email);
      const existing = await User.findOne({ emailNormalized: value.email });
      const reqId = requestId();
      const operationId = randomUUID();
      if (existing) {
        const identity = await Identity.findOne({
          userId: existing._id,
          provider: 'password',
          unlinkedAt: null,
        }).select('+passwordHash');
        if (
          existing.status !== 'pending_verification' ||
          existing.deletedAt ||
          !identity?.passwordHash ||
          !(await verify(identity.passwordHash, value.password))
        )
          throw new HttpError(
            409,
            'EMAIL_UNAVAILABLE',
            'Email này chưa dùng được cho đăng ký. Thử đăng nhập hoặc dùng email khác.',
          );
        const issued = await connection.transaction(async (session) => {
          const user = await User.findOneAndUpdate(
            {
              _id: existing._id,
              status: 'pending_verification',
              deletedAt: null,
              emailVerifiedAt: null,
            },
            {
              $set: {
                status: 'active',
                updatedBy: existing._id,
                updatedByType: 'user',
              },
              $inc: { revision: 1 },
            },
            { session, returnDocument: 'after' },
          );
          if (!user)
            throw new HttpError(
              409,
              'EMAIL_UNAVAILABLE',
              'Email này chưa dùng được cho đăng ký. Thử đăng nhập hoặc dùng email khác.',
            );
          await audit.append(
            {
              action: 'auth.registered',
              actorUserId: user._id.toHexString(),
              entityId: user._id.toHexString(),
              requestId: reqId,
              operationId,
            },
            session,
          );
          const token = await createSession(
            user,
            identity._id,
            session,
            reqId,
            operationId,
          );
          return { user, token };
        });
        return { user: userDto(issued.user), token: issued.token };
      }

      const passwordHash = await hash(value.password, argonOptions);
      const issued = await connection.transaction(async (session) => {
        const user = await new User({
          emailNormalized: value.email,
          displayName: value.displayName,
          status: 'active',
          emailVerifiedAt: null,
        }).save({ session });
        const identity = await new Identity({
          userId: user._id,
          provider: 'password',
          loginEmailNormalized: value.email,
          passwordHash,
          linkedAt: new Date(),
        }).save({ session });
        await audit.append(
          {
            action: 'auth.registered',
            entityId: user._id.toHexString(),
            requestId: reqId,
            operationId,
          },
          session,
        );
        const token = await createSession(
          user,
          identity._id,
          session,
          reqId,
          operationId,
        );
        return { user, token };
      });
      return { user: userDto(issued.user), token: issued.token };
    },
    async login(req: Request, value: { email: string; password: string }) {
      limit(req, value.email);
      const identity = await Identity.findOne({
        provider: 'password',
        loginEmailNormalized: value.email,
        unlinkedAt: null,
      }).select('+passwordHash');
      const valid = await verify(
        identity?.passwordHash ?? (await dummyHash),
        value.password,
      );
      let user =
        valid && identity
          ? await User.findOne({ _id: identity.userId, deletedAt: null })
          : null;
      if (!user || !identity) {
        await audit.append({
          action: 'auth.failed',
          entityId: new Types.ObjectId().toHexString(),
          requestId: requestId(),
          operationId: randomUUID(),
        });
        throw new HttpError(
          401,
          'INVALID_CREDENTIALS',
          'Email hoặc mật khẩu chưa đúng.',
        );
      }
      if (user.status === 'pending_verification' && !user.emailVerifiedAt) {
        const activated = await User.findOneAndUpdate(
          {
            _id: user._id,
            status: 'pending_verification',
            deletedAt: null,
            emailVerifiedAt: null,
          },
          {
            $set: {
              status: 'active',
              updatedBy: user._id,
              updatedByType: 'user',
            },
            $inc: { revision: 1 },
          },
          { returnDocument: 'after' },
        );
        if (!activated)
          throw new HttpError(
            403,
            'ACCOUNT_UNAVAILABLE',
            'Tài khoản hiện không khả dụng.',
          );
        user = activated;
      }
      if (user.status !== 'active')
        throw new HttpError(
          403,
          'ACCOUNT_UNAVAILABLE',
          'Tài khoản hiện không khả dụng.',
        );
      const reqId = requestId();
      const operationId = randomUUID();
      const token = await connection.transaction(async (session) => {
        const current = await User.findOne({
          _id: user._id,
          status: 'active',
          deletedAt: null,
          securityVersion: user.securityVersion,
        }).session(session);
        if (!current)
          throw new HttpError(
            401,
            'SESSION_EXPIRED',
            'Vui lòng đăng nhập lại.',
          );
        return createSession(
          current,
          identity._id,
          session,
          reqId,
          operationId,
        );
      });
      return { user: userDto(user), token };
    },
    async logout(req: Request, res: Response) {
      const auth = await authenticate(req);
      const operationId = randomUUID();
      const reqId = requestId();
      if (auth)
        await connection.transaction(async (session) => {
          const value = await Session.updateOne(
            { _id: auth.session._id, revokedAt: null },
            { $set: { revokedAt: new Date(), revocationReason: 'logout' } },
            { session },
          );
          if (value.modifiedCount)
            await audit.append(
              {
                action: 'session.revoked',
                actorUserId: auth.user._id.toHexString(),
                entityId: auth.session._id.toHexString(),
                requestId: reqId,
                operationId,
              },
              session,
            );
        });
      res.clearCookie('goease_session', cookieOptions);
    },
  };
}
