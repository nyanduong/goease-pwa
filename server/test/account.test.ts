import assert from 'node:assert/strict';
import { test } from 'node:test';
import { profileUpdateSchema, passwordChangeSchema } from '@goease/contracts';
test('profile and password contracts reject forged fields unsafe avatars and invalid passwords', () => {
  const p = { displayName: ' Traveler ', avatarUrl: null, expectedRevision: 0 };
  assert.equal(profileUpdateSchema.parse(p).displayName, 'Traveler');
  for (const avatarUrl of [
    'http://example.com/a.png',
    'javascript:alert(1)',
    'https://user:secret@example.com/a.png',
  ])
    assert.equal(
      profileUpdateSchema.safeParse({ ...p, avatarUrl }).success,
      false,
    );
  assert.equal(
    profileUpdateSchema.safeParse({
      ...p,
      avatarUrl: 'https://example.com/a.png',
    }).success,
    true,
  );
  assert.equal(
    profileUpdateSchema.safeParse({ ...p, roles: ['admin'] }).success,
    false,
  );
  assert.equal(
    passwordChangeSchema.safeParse({
      currentPassword: 'Old-password-2026',
      newPassword: 'Old-password-2026',
    }).success,
    false,
  );
  assert.equal(
    passwordChangeSchema.safeParse({
      currentPassword: 'Old-password-2026',
      newPassword: 'short',
    }).success,
    false,
  );
  assert.equal(
    passwordChangeSchema.safeParse({
      currentPassword: 'Old-password-2026',
      newPassword: 'New-password-2026',
      userId: 'forged',
    }).success,
    false,
  );
});
import { authLimiter } from '../src/features/auth/security.js';
import type { Request } from 'express';
import { HttpError } from '../src/http-error.js';
test('auth limiter rejects repeated account attempts before password work', () => {
  const limit = authLimiter(2, 60);
  const request = { socket: { remoteAddress: '127.0.0.1' } } as Request;
  limit(request, 'test-only-account');
  limit(request, 'test-only-account');
  assert.throws(
    () => limit(request, 'test-only-account'),
    (e: unknown) => e instanceof HttpError && e.status === 429,
  );
});
