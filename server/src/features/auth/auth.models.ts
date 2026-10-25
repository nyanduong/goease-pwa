import { accountAvatarUrl } from './avatar.js';
import { Schema, type Connection, type Types } from 'mongoose';

export interface UserRecord {
  _id: Types.ObjectId;
  emailNormalized: string;
  emailVerifiedAt?: Date | null;
  displayName: string;
  avatarUrl?: string | null;
  status:
    | 'pending_verification'
    | 'active'
    | 'suspended'
    | 'deletion_pending'
    | 'anonymized';
  securityVersion: number;
  roles: string[];
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
export const mutableFields = {
  schemaVersion: { type: Number, default: 1 },
  revision: { type: Number, default: 0 },
  createdBy: { type: Schema.Types.ObjectId, default: null },
  updatedBy: { type: Schema.Types.ObjectId, default: null },
  createdByType: { type: String, enum: ['user', 'system'], default: 'system' },
  updatedByType: { type: String, enum: ['user', 'system'], default: 'system' },
};
export function authModels(connection: Connection) {
  const userSchema = new Schema(
    {
      ...mutableFields,
      emailNormalized: { type: String, required: true, maxlength: 254 },
      emailVerifiedAt: { type: Date, default: null },
      displayName: { type: String, required: true, maxlength: 100 },
      avatarUrl: {
        type: String,
        default: null,
        maxlength: 2048,
        validate: (value: string | null) =>
          value === null || accountAvatarUrl(value) !== null,
      },
      status: {
        type: String,
        enum: [
          'pending_verification',
          'active',
          'suspended',
          'deletion_pending',
          'anonymized',
        ],
        default: 'active',
      },
      roles: {
        type: [String],
        enum: ['traveler', 'admin'],
        default: ['traveler'],
      },
      securityVersion: { type: Number, default: 1 },
      recoverySequence: { type: Number, default: 0 },
      deletedAt: { type: Date, default: null },
      deletedBy: { type: Schema.Types.ObjectId, default: null },
      deletionReasonCode: { type: String, default: null },
      locale: { type: String, default: 'vi-VN' },
      timezone: { type: String, default: 'Asia/Ho_Chi_Minh' },
      privacySettings: {
        analytics: { type: Boolean, default: false },
        personalization: { type: Boolean, default: false },
        marketing: { type: Boolean, default: false },
      },
    },
    {
      collection: 'users',
      timestamps: true,
      strict: 'throw',
      versionKey: false,
      autoIndex: false,
      autoCreate: false,
    },
  );
  userSchema.index(
    { emailNormalized: 1 },
    {
      unique: true,
      partialFilterExpression: { emailNormalized: { $type: 'string' } },
    },
  );
  userSchema.index({ status: 1, createdAt: -1 });
  const identitySchema = new Schema(
    {
      ...mutableFields,
      userId: { type: Schema.Types.ObjectId, required: true },
      provider: { type: String, enum: ['password', 'google'], required: true },
      issuer: String,
      providerSubject: String,
      loginEmailNormalized: String,
      passwordHash: { type: String, select: false },
      passwordChangedAt: { type: Date, default: null },
      linkedAt: { type: Date, required: true },
      verifiedAt: { type: Date, default: null },
      lastUsedAt: { type: Date, default: null },
      unlinkedAt: { type: Date, default: null },
    },
    {
      collection: 'auth_identities',
      timestamps: true,
      strict: 'throw',
      versionKey: false,
      autoIndex: false,
      autoCreate: false,
    },
  );
  identitySchema.index(
    { provider: 1, issuer: 1, providerSubject: 1 },
    {
      unique: true,
      partialFilterExpression: {
        provider: 'google',
        unlinkedAt: null,
        issuer: { $type: 'string' },
        providerSubject: { $type: 'string' },
      },
    },
  );
  identitySchema.index(
    { provider: 1, loginEmailNormalized: 1 },
    {
      unique: true,
      partialFilterExpression: {
        provider: 'password',
        unlinkedAt: null,
        loginEmailNormalized: { $type: 'string' },
      },
    },
  );
  identitySchema.index(
    { userId: 1, provider: 1 },
    { unique: true, partialFilterExpression: { unlinkedAt: null } },
  );
  const sessionSchema = new Schema(
    {
      schemaVersion: { type: Number, default: 1 },
      userId: { type: Schema.Types.ObjectId, required: true },
      identityId: { type: Schema.Types.ObjectId, required: true },
      sessionTokenHash: { type: String, required: true, select: false },
      clientPlatform: { type: String, enum: ['web'], default: 'web' },
      securityVersionAtIssue: { type: Number, required: true },
      issuedAt: { type: Date, required: true },
      lastSeenAt: { type: Date, required: true },
      expiresAt: { type: Date, required: true },
      idleExpiresAt: { type: Date, required: true },
      revokedAt: { type: Date, default: null },
      revocationReason: {
        type: String,
        enum: ['logout', 'password_changed', 'password_reset'],
        default: null,
      },
      passwordChangeKey: { type: String, default: null },
    },
    {
      collection: 'auth_sessions',
      timestamps: true,
      strict: 'throw',
      versionKey: false,
      autoIndex: false,
      autoCreate: false,
    },
  );
  sessionSchema.index({ sessionTokenHash: 1 }, { unique: true });
  sessionSchema.index({ userId: 1, revokedAt: 1, lastSeenAt: -1 });
  sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  const context = new Schema(
    {
      identityId: Schema.Types.ObjectId,
      securityVersionAtIssue: Number,
      deliveryState: { type: String, enum: ['pending', 'sent', 'failed'] },
      nonceHash: String,
      encryptedPkceVerifier: String,
      bindingHash: String,
      registrationFlow: Boolean,
      registrationRequestedAt: Date,
      registrationOtpHash: { type: String, select: false },
      registrationPasswordHash: { type: String, select: false },
      registrationDisplayName: { type: String, maxlength: 100, select: false },
    },
    { _id: false, versionKey: false, strict: 'throw' },
  );
  const challengeSchema = new Schema(
    {
      schemaVersion: { type: Number, default: 1 },
      userId: Schema.Types.ObjectId,
      purpose: {
        type: String,
        enum: ['verify_email', 'oauth_state', 'reset_password'],
        required: true,
      },
      tokenHash: { type: String, required: true, select: false },
      targetEmailNormalized: { type: String, select: false },
      context: { type: context, required: true },
      expiresAt: { type: Date, required: true },
      consumedAt: { type: Date, default: null },
      revokedAt: { type: Date, default: null },
      attemptCount: { type: Number, default: 0 },
      maxAttempts: { type: Number, default: 1 },
      requestId: { type: String, required: true },
    },
    {
      collection: 'auth_challenges',
      timestamps: true,
      strict: 'throw',
      versionKey: false,
      autoIndex: false,
      autoCreate: false,
    },
  );
  challengeSchema.pre('validate', function () {
    if (
      this.purpose === 'reset_password' &&
      (!this.userId ||
        !this.context?.identityId ||
        !Number.isInteger(this.context.securityVersionAtIssue) ||
        (this.context.securityVersionAtIssue ?? 0) < 1 ||
        !this.context.deliveryState)
    )
      this.invalidate(
        'context',
        'Reset challenge requires identity, security version and delivery binding',
      );
  });
  challengeSchema.index({ tokenHash: 1 }, { unique: true });
  challengeSchema.index({ userId: 1, purpose: 1, createdAt: -1 });
  challengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  // One registration slot per email serializes concurrent requests and resend cooldowns.
  challengeSchema.index(
    { purpose: 1, targetEmailNormalized: 1 },
    {
      unique: true,
      partialFilterExpression: {
        purpose: 'verify_email',
        'context.registrationFlow': true,
      },
    },
  );
  return {
    User: connection.model('User', userSchema),
    Identity: connection.model('AuthIdentity', identitySchema),
    Session: connection.model('AuthSession', sessionSchema),
    Challenge: connection.model('AuthChallenge', challengeSchema),
  };
}
