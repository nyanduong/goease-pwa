import { accountAvatarUrl } from './avatar.js';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  randomUUID,
} from 'node:crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { Request, Response } from 'express';
import type { Connection } from 'mongoose';
import type { Config } from '../../config.js';
import { HttpError } from '../../http-error.js';
import { cookie, opaqueToken, tokenHash } from './security.js';
import { requestId, userDto, type authService } from './auth.service.js';

const jwks = createRemoteJWKSet(
  new URL('https://www.googleapis.com/oauth2/v3/certs'),
  { timeoutDuration: 5000 },
);
function seal(value: string, key: Buffer) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const bytes = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), bytes]
    .map((v) => v.toString('base64url'))
    .join('.');
}
function unseal(value: string, key: Buffer) {
  const [iv, tag, data] = value
    .split('.')
    .map((v) => Buffer.from(v, 'base64url'));
  if (!iv || !tag || !data) throw new Error('Invalid OAuth challenge');
  const cipher = createDecipheriv('aes-256-gcm', key, iv);
  cipher.setAuthTag(tag);
  return Buffer.concat([cipher.update(data), cipher.final()]).toString('utf8');
}
export function googleAuth(
  connection: Connection,
  config: Config,
  auth: ReturnType<typeof authService>,
) {
  const secureOrigins =
    config.NODE_ENV !== 'production' ||
    (new URL(config.CLIENT_ORIGIN).protocol === 'https:' &&
      new URL(config.GOOGLE_REDIRECT_URI).protocol === 'https:');
  const configured =
    secureOrigins &&
    Boolean(
      config.GOOGLE_CLIENT_ID?.trim() &&
      config.GOOGLE_CLIENT_SECRET?.trim() &&
      config.GOOGLE_PKCE_KEY &&
      /^[A-Za-z0-9+/]{43}=$/.test(config.GOOGLE_PKCE_KEY) &&
      Buffer.from(config.GOOGLE_PKCE_KEY, 'base64').length === 32,
    );
  const key = configured
    ? Buffer.from(config.GOOGLE_PKCE_KEY!, 'base64')
    : Buffer.alloc(0);
  const options = {
    httpOnly: true,
    secure: config.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/api/v1/auth/google',
    maxAge: 600000,
  };
  const { Challenge, User, Identity } = auth.models;
  return {
    configured,
    async begin(req: Request, res: Response) {
      auth.limitChallenge(req);
      if (!configured)
        throw new HttpError(
          503,
          'GOOGLE_UNAVAILABLE',
          'Google chưa được cấu hình trong môi trường này.',
        );
      const state = opaqueToken();
      const nonce = opaqueToken();
      const verifier = opaqueToken();
      const binding = opaqueToken();
      await new Challenge({
        purpose: 'oauth_state',
        tokenHash: tokenHash(state),
        context: {
          nonceHash: tokenHash(nonce),
          bindingHash: tokenHash(binding),
          encryptedPkceVerifier: seal(verifier, key),
        },
        expiresAt: new Date(Date.now() + 600000),
        requestId: requestId(),
      }).save();
      res.cookie('goease_oauth', binding, options);
      const params = new URLSearchParams({
        client_id: config.GOOGLE_CLIENT_ID!,
        redirect_uri: config.GOOGLE_REDIRECT_URI,
        response_type: 'code',
        scope: 'openid email profile',
        state,
        nonce,
        code_challenge: Buffer.from(tokenHash(verifier), 'hex').toString(
          'base64url',
        ),
        code_challenge_method: 'S256',
        prompt: 'select_account',
      });
      res.redirect(
        'https://accounts.google.com/o/oauth2/v2/auth?' + params.toString(),
      );
    },
    async callback(req: Request, res: Response) {
      res.clearCookie('goease_oauth', {
        httpOnly: options.httpOnly,
        secure: options.secure,
        sameSite: options.sameSite,
        path: options.path,
      });
      auth.limitChallenge(req);
      if (!configured) {
        res.redirect(`${config.CLIENT_ORIGIN}/login?google=unavailable`);
        return;
      }
      try {
        const state = req.query.state;
        const code = req.query.code;
        const binding = cookie(req, 'goease_oauth');
        if (
          typeof state !== 'string' ||
          !/^[a-zA-Z0-9_-]{43}$/.test(state) ||
          typeof code !== 'string' ||
          code.length > 4096 ||
          !binding
        )
          throw new Error('Invalid OAuth callback');
        const challenge = await Challenge.findOneAndUpdate(
          {
            purpose: 'oauth_state',
            tokenHash: tokenHash(state),
            'context.bindingHash': tokenHash(binding),
            expiresAt: { $gt: new Date() },
            consumedAt: null,
            revokedAt: null,
            attemptCount: { $lt: 1 },
          },
          { $set: { consumedAt: new Date() }, $inc: { attemptCount: 1 } },
          { returnDocument: 'after' },
        );
        if (
          !challenge?.context.encryptedPkceVerifier ||
          !challenge.context.nonceHash
        )
          throw new Error('Invalid OAuth state');
        const response = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          signal: AbortSignal.timeout(10000),
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: config.GOOGLE_CLIENT_ID!,
            client_secret: config.GOOGLE_CLIENT_SECRET!,
            redirect_uri: config.GOOGLE_REDIRECT_URI,
            code,
            code_verifier: unseal(challenge.context.encryptedPkceVerifier, key),
            grant_type: 'authorization_code',
          }),
        });
        if (!response.ok) throw new Error('OAuth exchange failed');
        const tokens = (await response.json()) as { id_token?: unknown };
        if (typeof tokens.id_token !== 'string')
          throw new Error('ID token missing');
        const { payload } = await jwtVerify(tokens.id_token, jwks, {
          issuer: ['https://accounts.google.com', 'accounts.google.com'],
          audience: config.GOOGLE_CLIENT_ID!,
          algorithms: ['RS256'],
          requiredClaims: [
            'exp',
            'iat',
            'sub',
            'email',
            'email_verified',
            'nonce',
          ],
          clockTolerance: 5,
          maxTokenAge: '10m',
        });
        if (
          (payload.azp !== undefined &&
            payload.azp !== config.GOOGLE_CLIENT_ID) ||
          (Array.isArray(payload.aud) &&
            payload.aud.length > 1 &&
            payload.azp !== config.GOOGLE_CLIENT_ID) ||
          !payload.sub ||
          payload.sub.length > 255 ||
          typeof payload.email !== 'string' ||
          payload.email.length > 254 ||
          payload.email_verified !== true ||
          typeof payload.nonce !== 'string' ||
          tokenHash(payload.nonce) !== challenge.context.nonceHash
        )
          throw new Error('Invalid Google identity');
        const email = payload.email.trim().toLowerCase();
        const subject = payload.sub;
        const reqId = requestId();
        const operationId = randomUUID();
        const result = await connection.transaction(async (session) => {
          let identity = await Identity.findOne({
            provider: 'google',
            issuer: 'https://accounts.google.com',
            providerSubject: subject,
            unlinkedAt: null,
          }).session(session);
          let user = identity
            ? await User.findOne({
                _id: identity.userId,
                status: 'active',
                deletedAt: null,
              }).session(session)
            : null;
          if (identity && !user)
            throw new HttpError(
              403,
              'ACCOUNT_UNAVAILABLE',
              'Tài khoản hiện không khả dụng.',
            );
          if (!identity) {
            if (await User.exists({ emailNormalized: email }).session(session))
              throw new HttpError(
                409,
                'ACCOUNT_LINK_REQUIRED',
                'Không tự liên kết tài khoản chỉ dựa email.',
              );
            user = await new User({
              emailNormalized: email,
              displayName:
                typeof payload.name === 'string'
                  ? payload.name.slice(0, 100) || 'Bạn đồng hành'
                  : 'Bạn đồng hành',
              avatarUrl: accountAvatarUrl(payload.picture),
              status: 'active',
              emailVerifiedAt: new Date(),
            }).save({ session });
            identity = await new Identity({
              userId: user._id,
              provider: 'google',
              issuer: 'https://accounts.google.com',
              providerSubject: subject,
              linkedAt: new Date(),
              verifiedAt: new Date(),
            }).save({ session });
          }
          if (!user || !identity)
            throw new Error('Google identity unavailable');
          const token = await auth.createSession(
            user,
            identity._id,
            session,
            reqId,
            operationId,
          );
          return { token, user: userDto(user) };
        });
        auth.setCookie(res, result.token);
        res.redirect(`${config.CLIENT_ORIGIN}/`);
      } catch (error) {
        res.redirect(
          `${config.CLIENT_ORIGIN}/login?google=${error instanceof HttpError && error.code === 'ACCOUNT_LINK_REQUIRED' ? 'link_required' : 'failed'}`,
        );
      }
    },
  };
}
