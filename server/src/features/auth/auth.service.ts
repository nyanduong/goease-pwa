import { accountAvatarUrl } from './avatar.js';
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
  avatarUrl: accountAvatarUrl(user.avatarUrl),
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
  async function requireAccount(req: Request) {
    const value = await authenticate(req);
    if (!value)
      throw new HttpError(
        401,
        'AUTH_REQUIRED',
        'Đăng nhập để quản lý tài khoản.',
      );
    return value;
  }
  async function activeAccount(req: Request, tx: ClientSession) {
    const token = cookie(req, 'goease_session');
    const now = new Date();
    const current = token
      ? await Session.findOne({
          sessionTokenHash: tokenHash(token),
          revokedAt: null,
          expiresAt: { $gt: now },
          idleExpiresAt: { $gt: now },
        }).session(tx)
      : null;
    const user = current
      ? await User.findOne({
          _id: current.userId,
          status: 'active',
          deletedAt: null,
          securityVersion: current.securityVersionAtIssue,
        }).session(tx)
      : null;
    const linked = current
      ? await Identity.exists({
          _id: current.identityId,
          userId: current.userId,
          unlinkedAt: null,
        }).session(tx)
      : null;
    if (!user || !current || !linked)
      throw new HttpError(401, 'SESSION_EXPIRED', 'Vui lòng đăng nhập lại.');
    return { user, current };
  }
  return {
    models,
    hasSessionCookie(req: Request) {
      return (
        req.headers.cookie
          ?.split(';')
          .some((value) => value.trim().startsWith('goease_session=')) ?? false
      );
    },
    clearSessionCookie(res: Response) {
      res.clearCookie('goease_session', cookieOptions);
    },
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
    async account(req: Request) {
      const value = await requireAccount(req);
      const canChangePassword = Boolean(
        await Identity.exists({
          userId: value.user._id,
          provider: 'password',
          unlinkedAt: null,
        }),
      );
      return {
        user: userDto(value.user),
        revision: value.user.revision,
        canChangePassword,
      };
    },
    async updateProfile(
      req: Request,
      value: {
        displayName: string;
        avatarUrl: string | null;
        expectedRevision: number;
      },
    ) {
      await requireAccount(req);
      const reqId = requestId(),
        operationId = randomUUID();
      await connection.transaction(async (tx) => {
        const { user } = await activeAccount(req, tx);
        const avatar =
          value.avatarUrl === null ? null : accountAvatarUrl(value.avatarUrl);
        if (
          user.displayName === value.displayName &&
          (user.avatarUrl ?? null) === avatar
        )
          return;
        if (user.revision !== value.expectedRevision)
          throw new HttpError(
            409,
            'PROFILE_CONFLICT',
            'Hồ sơ đã thay đổi ở nơi khác. Nội dung đang nhập vẫn được giữ; tải lại trước khi sửa.',
          );
        user.displayName = value.displayName;
        user.avatarUrl = avatar;
        user.revision++;
        user.updatedBy = user._id;
        user.updatedByType = 'user';
        await user.save({ session: tx });
        await audit.append(
          {
            action: 'profile.updated',
            actorUserId: String(user._id),
            entityId: String(user._id),
            entityRevision: user.revision,
            requestId: reqId,
            operationId,
          },
          tx,
        );
      });
      return this.account(req);
    },
    async changePassword(
      req: Request,
      value: { currentPassword: string; newPassword: string },
      key: string,
    ) {
      const account = await requireAccount(req);
      limit(req, `password-change:${account.user._id}`);
      const passwordHash = await hash(value.newPassword, argonOptions);
      const reqId = requestId(),
        operationId = randomUUID();
      return connection.transaction(async (tx) => {
        const { user, current } = await activeAccount(req, tx);
        const identity = await Identity.findOne({
          userId: user._id,
          provider: 'password',
          unlinkedAt: null,
        })
          .select('+passwordHash')
          .session(tx);
        if (!identity?.passwordHash)
          throw new HttpError(
            400,
            'PASSWORD_NOT_AVAILABLE',
            'Tài khoản này dùng Google và chưa có mật khẩu.',
          );
        if (current.passwordChangeKey === key) {
          if (!(await verify(identity.passwordHash, value.newPassword)))
            throw new HttpError(
              409,
              'IDEMPOTENCY_CONFLICT',
              'Nội dung đổi mật khẩu đã thay đổi.',
            );
          return { changed: true };
        }
        if (!(await verify(identity.passwordHash, value.currentPassword)))
          throw new HttpError(
            400,
            'PASSWORD_INCORRECT',
            'Mật khẩu hiện tại chưa đúng.',
          );
        identity.passwordHash = passwordHash;
        identity.passwordChangedAt = new Date();
        await identity.save({ session: tx });
        user.securityVersion++;
        await user.save({ session: tx });
        current.securityVersionAtIssue = user.securityVersion;
        current.passwordChangeKey = key;
        await current.save({ session: tx });
        await Session.updateMany(
          { userId: user._id, _id: { $ne: current._id }, revokedAt: null },
          {
            $set: {
              revokedAt: new Date(),
              revocationReason: 'password_changed',
            },
          },
          { session: tx },
        );
        await audit.append(
          {
            action: 'password.changed',
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
        // Recheck the credential verified before the transaction and serialize against a password change.
        const verifiedIdentity = await Identity.findOneAndUpdate(
          {
            _id: identity._id,
            userId: current._id,
            unlinkedAt: null,
            passwordHash: identity.passwordHash!,
          },
          { $set: { lastUsedAt: new Date() } },
          { session, returnDocument: 'after' },
        );
        if (!verifiedIdentity)
          throw new HttpError(
            401,
            'INVALID_CREDENTIALS',
            'Email hoặc mật khẩu chưa đúng.',
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
