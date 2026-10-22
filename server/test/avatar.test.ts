import test from 'node:test';
import assert from 'node:assert/strict';
import { accountAvatarUrl } from '../src/features/auth/avatar.js';

test('account avatar accepts HTTPS and rejects missing, malformed, credentialed and unsafe URLs', () => {
  assert.equal(
    accountAvatarUrl('https://images.example.com/traveler.png'),
    'https://images.example.com/traveler.png',
  );
  for (const value of [
    null,
    undefined,
    '',
    'invalid',
    'http://example.com/a',
    'javascript:alert(1)',
    'data:image/png;base64,x',
    'https://user:secret@example.com/a',
    'https://example.com/' + 'a'.repeat(2049),
  ])
    assert.equal(accountAvatarUrl(value), null);
});
